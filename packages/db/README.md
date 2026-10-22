# @repo/db

The database layer of the monorepo: a [Drizzle](https://orm.drizzle.team) schema for SQLite (`bun:sqlite`), the generated migrations, and the query functions for each table.

## Entry points

| Import | Contents | Where it may run |
| --- | --- | --- |
| `@repo/db` | the tables, the `Database` type, `isUniqueViolation` | Server only: it imports drizzle |
| `@repo/db/<table>` (`notes`, `members`, `rooms`, `bookings`, `tasks`, `announcements`) | query functions for that table | Server only, called by `@repo/services` |
| `@repo/db/shared` | the JSON types (`Member`, `Booking`, ...) and limits | Anywhere, including React components |
| `@repo/db/sqlite` | `openDatabase(path)`: opens the app's SQLite file and applies the migrations | Server only (Bun) |
| `@repo/db/testing` | `createTestDatabase()` | Tests only (`bun:sqlite`) |

One entry per module, no barrel file: a new table gets its own `src/<name>.ts` and its own `exports` line in `package.json`. Keep the server/browser split. Importing a drizzle-backed entry from a route component pulls drizzle into the browser bundle. Anything the UI needs goes in `src/shared.ts`.

## Using it

The query functions take a drizzle instance rather than making one, so the same
code runs against the app's database file and against in-memory `bun:sqlite` in the tests. The
app does not call them directly. It goes through [`@repo/services`](../services),
which validates input first:

```ts
import { createNote, listNotes } from "@repo/db/notes";
import { openDatabase } from "@repo/db/sqlite";

const db = openDatabase("./data/teamdesk.db");
const notes = await listNotes(db);
const note = await createNote(db, { text: "hello" });
```

`openDatabase` takes the path as an argument; only `MIGRATIONS_DIR` is read from the environment, for the built server. Open the database once and keep it: the app does that in `apps/web/src/server/trpc/context.ts`.

### Table modules

`src/notes.ts` and `src/bookings.ts` are the template for new tables:

- The stored row shape stays private to the module.
- Functions return plain JSON (`Note`, with `id: string` and an ISO date). tRPC serializes results as JSON, so the row types should not leak.
- No validation here. The service in `@repo/services` validates input before it reaches these functions.
- The parameter type is `Database` from `@repo/db`, which is any drizzle SQLite instance, sync or async. That is what lets the tests use an in-memory database.

## Schema and migrations

`src/schema.ts` defines the tables. After changing it, generate a migration:

```bash
bun run generate            # drizzle-kit generate, writes migrations/
```

Migrations are applied by `openDatabase`, not by drizzle-kit, so a new volume or a new release needs no separate step. From the repo root, `bun run db:apply` does the same for `DB_PATH` without starting the app, and `bun run dev` runs it before the dev server.

Commit `migrations/`, including `migrations/meta/`. Drizzle diffs the schema against the snapshot in there, so without it the next `generate` would try to create the tables again.

## Tests

```bash
bun test
```

Each test gets a fresh in-memory `bun:sqlite` database with the migrations applied (`createTestDatabase()` from `src/testing.ts`). No server, no network, and the migrations are exercised alongside the queries.

`seed.sql` holds the demo data `bun run dev` loads locally. It is not a migration.
