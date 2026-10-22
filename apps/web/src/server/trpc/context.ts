// What every tRPC procedure receives as `ctx`: the services, built on the
// app's SQLite database, and who is calling. There is no sign-in yet, so
// `userId` is always null and every `protectedProcedure` answers UNAUTHORIZED.
// Team procedures take the acting member's id as input instead.
import type { Database } from "@repo/db";
import { openDatabase } from "@repo/db/sqlite";
import { createAnnouncementsService } from "@repo/services/announcements";
import { createAvailabilityService } from "@repo/services/availability";
import { createBookingsService } from "@repo/services/bookings";
import { createMembersService } from "@repo/services/members";
import { createNotesService } from "@repo/services/notes";
import { createRoomsService } from "@repo/services/rooms";
import { createTasksService } from "@repo/services/tasks";
import type { Context as HonoContext } from "hono";

const createServices = (db: Database) => ({
  announcements: createAnnouncementsService(db),
  availability: createAvailabilityService(db),
  bookings: createBookingsService(db),
  members: createMembersService(db),
  notes: createNotesService(db),
  rooms: createRoomsService(db),
  tasks: createTasksService(db),
});

// The one place the database is opened: once, on first use, at DB_PATH. Opening
// applies any pending migrations, so a fresh volume needs no setup step.
// A new database has no members, and only an admin can add one, so while the
// team is empty TEAMDESK_ADMIN_EMAIL (and TEAMDESK_ADMIN_NAME) make the first
// admin. Both are ignored once anyone exists.
let services: Promise<ReturnType<typeof createServices>> | undefined;
const getServices = () => {
  services ??= (async () => {
    const created = createServices(
      openDatabase(process.env.DB_PATH ?? "./data/teamdesk.db")
    );
    const email = process.env.TEAMDESK_ADMIN_EMAIL;
    if (email) {
      await created.members.bootstrapAdmin({
        email,
        name: process.env.TEAMDESK_ADMIN_NAME || "Admin",
      });
    }
    return created;
  })();
  return services;
};

// A type, not an interface: see the biome-ignore. Over HTTP,
// @hono/trpc-server also adds `env` to ctx, but the SSR path does not, so
// procedures use `ctx.services` and never `ctx.env`.
// biome-ignore lint/style/useConsistentTypeDefinitions: @hono/trpc-server needs a Record<string, unknown>, which an interface is not
export type Context = {
  services: ReturnType<typeof createServices>;
  /** Signed-in user, or null for anonymous callers. */
  userId: string | null;
};

const createContext = async (userId: string | null): Promise<Context> => ({
  services: await getServices(),
  userId,
});

/** Calls over HTTP: /api/trpc, mounted in src/server.ts. */
export const createHonoContext = (_c: HonoContext): Promise<Context> =>
  createContext(null);

/** In-process calls from route loaders during SSR (src/integrations/trpc). */
export const createSsrContext = (): Promise<Context> => createContext(null);
