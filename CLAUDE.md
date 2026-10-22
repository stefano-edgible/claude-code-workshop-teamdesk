# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Bun workspaces + Turborepo; TanStack Start on a plain Bun server with a SQLite file. Request flow:
route component → tRPC router → service (`@repo/services/<module>`) → query functions (`@repo/db/<module>`) → Drizzle on `bun:sqlite`.

## Commands (repo root)

- `bun run dev`: migrates and seeds the SQLite file `data/teamdesk.db`, then serves :3000. Delete `data` for a clean slate.
- `bun test`: all tests. One package: `cd packages/services && bun test`. One file: `bun test src/bookings.test.ts`.
- `bun run check`: Ultracite (Biome) lint plus `tsc --noEmit`. `bun run fix` formats. The pre-commit hook runs `fix`, so unfixable lint blocks commits.
- `bun run db:apply` / `db:seed`: migrate or seed the file at `DB_PATH`.
- `bun run build` then `bun run start`: the production server (`apps/web/serve.ts`, `Bun.serve`) on `PORT`.
- After a `schema.ts` change: `cd packages/db && bun run generate`.
- `apps/web`: `generate-routes` rebuilds `routeTree.gen.ts`.

## Rules

- **Commit `packages/db/migrations/` including `meta/`.**
  Why: drizzle diffs against the snapshot there; without it the next `generate` recreates existing tables. `openDatabase` (`@repo/db/sqlite`), not drizzle-kit, applies them.
- **Browser code imports only `@repo/db/shared`.**
  Why: every other db/services entry imports drizzle and would pull it into the client bundle. Put UI-needed types and limits in `shared.ts`.
- **Keep tRPC routers thin: an input schema from the service, then one service call.**
  Why: rules live in services so scripts and tests get them too, without tRPC.
- **Open the database only in `apps/web/src/server/trpc/context.ts` (via `openDatabase`); register new services there.**
  Why: services and db functions take a drizzle instance, so the same code runs on the app's file and on in-memory SQLite in tests.
- **Services re-parse input with the same zod schema the router uses.**
  Why: a caller that skips tRPC still gets validated input.
- **Mutations take `actorId` first and check it (`requireMember`/`requireAdmin`); fail with `ServiceError` subclasses from `errors.ts`.**
  Why: there is no auth (`ctx.userId` is always null, `protectedProcedure` always 401s), so permission checks live in the service; `init.ts` maps the error classes to tRPC codes.
- **`@repo/db` functions do no validation and return plain JSON (string ids, ISO dates).**
  Why: results cross tRPC as JSON, and row types must not leak out of the module.
- **One `exports` entry per module, no barrel files; a new table needs `src/<name>.ts` plus an `exports` line.**
  Why: a barrel would drag drizzle into browser imports.
- **Timestamps are UTC ISO strings; booking slots are `[startsAt, endsAt)`.**
  Why: back-to-back bookings must not clash, and string comparison in SQL only works on one format.
- **Tests use `createTestDatabase()` from `@repo/db/testing` (fresh in-memory SQLite, real migrations).**
  Why: service tests then cover the service, queries and schema together. `packages/services/src/fixtures.ts` has a small team and two rooms.

## App notes

- `apps/web/src/server.ts` is a Hono app: Hono routes, then `/api/trpc/*` (CSRF-protected), then TanStack Start SSR.
- `getTrpc()` is an HTTP client in the browser but runs the router in-process during SSR, so loaders don't fetch their own server.
- The `#/*` import alias maps to `apps/web/src/`.
