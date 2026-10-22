# Teamdesk

Rooms, bookings and tasks for a small team. A [TanStack Start](https://tanstack.com/start) app on Bun with a local SQLite file, built from [cf-tanstack-boilerplate](https://github.com/codewithpassion/cf-tanstack-boilerplate).

## Develop

```bash
bun install
bun test
bun run dev
```

`bun run dev` applies the migrations and the demo data (`packages/db/seed.sql`) to the SQLite file `data/teamdesk.db` and starts the app on http://localhost:3000. No account and no environment variables are needed. Delete the `data` folder for a clean slate.

There is no sign-in yet. Pages that change data have a member picker, and the chosen member is sent as `actorId` with every mutation.

## Layout

- [`apps/web`](apps/web): the TanStack Start app. Hono is the server's `fetch` handler, run by `Bun.serve` in production, tRPC is mounted at `/api/trpc`. See its [README](apps/web/README.md).
- [`packages/db`](packages/db) (`@repo/db`): the Drizzle schema, migrations and query functions. See its [README](packages/db/README.md).
- [`packages/services`](packages/services) (`@repo/services`): business rules and validation on top of `@repo/db`. See its [README](packages/services/README.md).

A request goes route component, then tRPC router (`apps/web/src/server/trpc/routers/`), then service (`@repo/services/<module>`), then query functions (`@repo/db/<module>`).

## Commands

- `bun test`: every test in the repo, against in-memory SQLite.
- `bun run check`: lint (Ultracite, which is Biome) and typecheck.
- `bun run fix`: format and apply safe lint fixes.
- `bun run build`: production build.
- `bun run start`: serve the production build (`bun run build` first) on `PORT` (default 3000), with the database at `DB_PATH` (default `data/teamdesk.db`). It applies pending migrations when it first opens the database.
- `bun run db:apply`: create the database file and apply the migrations.
- `bun run db:seed`: load the demo data into it (safe to repeat).

## Run it in a container

The `Dockerfile` builds the image the [Edgible card](card/teamdesk/README.md) runs. The database is a single file on a volume mounted at `/data`.

## Stack

Bun and SQLite (`bun:sqlite`), Hono, TanStack Start and Router, tRPC, Drizzle ORM, zod, shadcn/ui with Tailwind CSS v4, Bun, Turborepo, Ultracite.
