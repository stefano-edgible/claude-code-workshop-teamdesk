# @repo/services

The service layer: business rules and input validation, on top of the query functions in [`@repo/db`](../db). The web app calls it through tRPC (`apps/web/src/server/trpc/`), but nothing here knows about tRPC or Hono. A script or a test can use a service the same way.

## Entry points

| Import | Contents |
| --- | --- |
| `@repo/services/<module>` (`notes`, `members`, `rooms`, `availability`, `bookings`, `tasks`, `announcements`) | `create<Module>Service`, its input schemas (zod) and types |
| `@repo/services/errors` | `ServiceError` and its subclasses |

One entry per module, no barrel file, same as `@repo/db`. Everything here is server-only: services import drizzle-backed modules.

## Using it

A service is a factory that takes a drizzle instance:

```ts
import { createNotesService } from "@repo/services/notes";
import { openDatabase } from "@repo/db/sqlite";

const notes = createNotesService(openDatabase("./data/teamdesk.db"));
await notes.create({ text: "  hello  " }); // stored as "hello"
await notes.list();
```

In the app, `apps/web/src/server/trpc/context.ts` builds the services once per call and puts them on `ctx.services`.

## Writing a service

`src/notes.ts` is the template:

- Export the input schema (zod). The tRPC router passes it to `.input()`, and the service parses with it again, so a caller that skips tRPC still gets validated input.
- Methods are `async`, so a validation error rejects the promise rather than throwing synchronously.
- Take a `Database` from `@repo/db`. Never read `env`, bindings or the request; the caller passes in what the service needs, including the user id when a rule depends on it.
- Return the plain JSON shapes from `@repo/db/shared`.
- Fail by throwing a subclass of `ServiceError` from `src/errors.ts` (`NotFoundError`, `ValidationError`, `ConflictError`, `ForbiddenError`). The tRPC layer turns the error code into the HTTP status.
- Mutations take the acting member's id first and check what that member may do (`requireMember`, `requireAdmin` in `src/members.ts`).

A new service also needs a line in `apps/web/src/server/trpc/context.ts`.

## Tests

```bash
bun test
```

Like `@repo/db`, each test gets a fresh in-memory `bun:sqlite` database with the real migrations applied, so the tests cover the service, the queries and the schema together. `src/fixtures.ts` sets up a small team and two rooms.
