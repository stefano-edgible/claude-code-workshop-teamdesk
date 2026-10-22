import { ServiceError, type ServiceErrorCode } from "@repo/services/errors";
import { initTRPC, TRPCError } from "@trpc/server";
import type { Context } from "./context.ts";

const TRPC_CODES: Record<ServiceErrorCode, TRPCError["code"]> = {
  CONFLICT: "CONFLICT",
  FORBIDDEN: "FORBIDDEN",
  NOT_FOUND: "NOT_FOUND",
  VALIDATION: "BAD_REQUEST",
};

const t = initTRPC.context<Context>().create({
  // A failed input check carries the schema library's issue list as its
  // message. Send the first issue's text instead, so the UI can show it.
  errorFormatter: ({ shape, error }) => {
    const cause: unknown = error.cause;
    if (
      error.code === "BAD_REQUEST" &&
      typeof cause === "object" &&
      cause !== null &&
      "issues" in cause &&
      Array.isArray(cause.issues)
    ) {
      const [first] = cause.issues as { message?: unknown }[];
      if (typeof first?.message === "string") {
        return { ...shape, message: first.message };
      }
    }
    // Unexpected errors can carry internals (SQL, binding names). Keep their
    // text in development, hide it in production; server.ts logs it.
    if (error.code === "INTERNAL_SERVER_ERROR" && !import.meta.env.DEV) {
      return { ...shape, message: "Internal server error" };
    }
    return shape;
  },
  // tRPC's own default reads process.env.NODE_ENV, which may not be
  // set, and would then send stack traces to production clients.
  isDev: import.meta.env.DEV,
});

export const { router } = t;

// Services throw ServiceError subclasses. Turn them into the matching tRPC
// error so the client gets a 404/409/403/400 with the service's message
// instead of a 500.
const serviceErrors = t.middleware(async ({ next }) => {
  const result = await next();
  if (!result.ok && result.error.cause instanceof ServiceError) {
    const { cause } = result.error;
    throw new TRPCError({
      cause,
      code: TRPC_CODES[cause.code],
      message: cause.message,
    });
  }
  return result;
});

/** Anyone, signed in or not. `ctx.userId` may be null. */
export const publicProcedure = t.procedure.use(serviceErrors);

/** Signed-in users only. Narrows `ctx.userId` to a string. */
export const protectedProcedure = publicProcedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({ ctx: { ...ctx, userId: ctx.userId } });
});
