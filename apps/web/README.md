# web

A [TanStack Start](https://tanstack.com/start) app served by Bun, with [Hono](https://hono.dev) as the top-level `fetch` handler and a local SQLite file for data.

There is no sign-in. Team procedures take the acting member as `actorId` in their input.

## Architecture

`src/server.ts` is the server entry that `vite build` bundles into `dist/server/server.js`. It's a Hono app, and `serve.ts` runs it with `Bun.serve`, serving `dist/client` first:

- Hono handles its own routes first (e.g. `/api/health`).
- `/api/trpc/*` is the [tRPC](https://trpc.io) API, mounted with `@hono/trpc-server`.
- Everything else falls through to `app.all('*', ...)`, which delegates to TanStack Start's request handler (`@tanstack/react-start/server-entry`) for SSR pages and static assets.

## tRPC

`src/server/trpc/` holds the API:

- `context.ts` builds `ctx` for each call: the services from [`@repo/services`](../../packages/services) on the app's SQLite database, and `userId`, the signed-in user or null. With no auth, `userId` is always null.
- `init.ts` defines `publicProcedure` (anyone) and `protectedProcedure` (signed-in users only, 401 otherwise). Both map a thrown `ServiceError` from `@repo/services/errors` to the matching tRPC error (404, 409, 403, 400).
- `router.ts` is the app router: one sub-router per area (`members`, `rooms`, `bookings`, `tasks`, `announcements`, `notes`) and `me` (protected, the example).
- `routers/<name>.ts` holds one router per area. Keep them thin: an input schema from the service, then one service call.

`src/integrations/trpc/client.ts` exports `getTrpc()`. In the browser it is an HTTP client for `/api/trpc`. During SSR it runs the router in-process (`unstable_localLink`), so loaders do not fetch their own server. Call it from loaders and event handlers: `getTrpc().notes.list.query()`.

## SQLite

Database access goes through the workspace package [`@repo/db`](../../packages/db) (see its README for the schema, the migrations and the test setup). In this app:

- `src/server/trpc/context.ts` calls `openDatabase(process.env.DB_PATH ?? "./data/teamdesk.db")` from `@repo/db/sqlite` the first time a request needs it, and hands the result to the services. That is the one place the database is opened. Opening applies any pending migrations.
- `src/routes/notes.tsx` is the example page: the loader calls `notes.list`, the form calls `notes.create` and invalidates the router. Its `errorComponent` renders a "could not open the database" panel.
- Browser code imports only `@repo/db/shared`. The other entries import drizzle and belong behind tRPC.

`bun run dev` migrates and seeds `data/teamdesk.db` before starting Vite (under Bun, because `bun:sqlite` does not exist in Node). The `data` folder is gitignored; delete it for a clean slate.

## Develop

```bash
bun install
bun run dev
```

The database needs no configuration for local work.

## Build & run

```bash
bun run build     # vite build -> dist/client and dist/server
bun run start     # Bun.serve on PORT (default 3000)
```

| Variable | Default | Meaning |
| --- | --- | --- |
| `PORT` | `3000` | Port to listen on |
| `HOST` | `0.0.0.0` | Address to listen on |
| `DB_PATH` | `./data/teamdesk.db` | The SQLite file; its folder is created if needed |
| `MIGRATIONS_DIR` | next to `@repo/db` | Set by `bun run start` and the Dockerfile, because the built server is one bundle in another folder |

The first start creates the tables. Load the demo team and rooms with `bun run db:seed` (from the repo root, with the same `DB_PATH`); without members nobody can book.
