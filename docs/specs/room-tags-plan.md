# Room tags: implementation plan

## Context

Spec: `docs/specs/room-tags.md` (the only file in `docs/specs/`, so I took it as the "[your-spec]" in the request). Admins record free-form tags per room (TV, whiteboard). Everyone sees them on the rooms page, and `rooms.free` can filter on them. Layers follow the repo flow: db query functions, then services, then tRPC, then UI.

## Phase 1: Data layer (`@repo/db`)

Outcome: rooms carry `tags` end to end through the db package, and old rooms read as `[]`.

- `packages/db/src/shared.ts`: add `ROOM_TAG_MAX_LENGTH = 30`, `ROOM_TAGS_MAX = 10`, and `tags: string[]` on `Room`.
- `packages/db/src/schema.ts`: `tags: text("tags").notNull().default("[]")` on `rooms`.
- `cd packages/db && bun run generate`; commit the new `0002_*.sql` plus `meta/` (snapshot and `_journal.json`).
- `packages/db/src/rooms.ts` (raw `sql` templates, left in that style):
  - add `tags: string` to `RoomRecord`; `mapRoom` does `JSON.parse` into `string[]`.
  - add `tags` to all four select lists (`listRooms` x2, `getRoom`) and the `insert ... returning`.
  - `insertRoom(db, name, capacity, tags = [])` stores `JSON.stringify(tags)`.
  - new `setRoomTags(db, id, tags)`: `update rooms set tags = ... where id = ...`, no validation.
- Tests (`rooms.test.ts`): existing `toEqual` on a room gains `tags: []`; add insert-with-tags round trip, `setRoomTags` replace, and a default `[]` check.

Check: `cd packages/db && bun test`.

## Phase 2: Services and tRPC

Outcome: tags can be set and filtered through the services and the API, fully tested without the UI.

- `packages/services/src/rooms.ts`:
  - export `tagsSchema`: array of `z.string().trim().min(1).max(ROOM_TAG_MAX_LENGTH)` with clear messages, then a transform that drops case-insensitive duplicates (first spelling wins, order kept), then the `ROOM_TAGS_MAX` check on the de-duplicated list. Blank tags are rejected (the spec leaves "reject or drop" to the build; reject).
  - `addRoomInput` gains `tags: tagsSchema.default([])`; `add` passes `parsed.data.tags` to `insertRoom`.
  - `RoomsService.setTags(actorId, roomId, tags)`: admin check ("Only admins can edit room tags."), then parse with `tagsSchema` (same issue-join error style as `add`), then `getRoom` ("Room X does not exist."), then `setRoomTags`; return `{ ok: true, room: { ...room, tags } }`. No archived check, so archived rooms work.
- `packages/services/src/availability.ts`: `freeRoomsInput` gains `tags: z.array(z.string()).default([])`. Filter `candidates` (after the capacity filter, before `findOverlappingBookings`) to rooms whose lowercased tags include every requested tag lowercased and trimmed. Empty list means no change. The filter is lenient and does not reuse `tagsSchema`, so a search never fails on limits.
- `apps/web/src/server/trpc/routers/rooms.ts`: add `setTags` (`{ actorId, roomId, tags: z.array(z.string()) }`, one service call, `BAD_REQUEST` on `!ok`, returns `result.room`); add `tags: z.array(z.string()).default([])` to `free`'s input. `add` needs no change; nothing to register in `context.ts`.
- Tests, using `createTeam()` (`fixtures.ts` needs no change):
  - `services/rooms.test.ts`: add with tags then `list` shows them; >30 chars rejected; >10 rejected; "TV, tv, Tv" gives `["TV"]`; trimming; blank rejected; `setTags` as admin replaces, as member errors, unknown room errors, archived room works.
  - `services/availability.test.ts`: `["tv"]` matches case-insensitively; two tags require both; a tagged room booked in the slot is excluded; no tags is unchanged.

Check: `cd packages/services && bun test`, then `bun run check` (types will flag any `Room` literal missing `tags`, e.g. in `bookings.test.ts`).

## Phase 3: UI (`apps/web`)

Outcome: the rooms page shows tags, and admins can add and edit them.

- Shared helper for comma-separated input: split on `,`, trim, drop empty pieces (so a cleared field sends `[]` and a trailing comma does not trigger the blank-tag rejection). Put it in `rooms.tsx` or a small `#/lib` file, whichever matches nearby code.
- `apps/web/src/routes/rooms.tsx`:
  - add a `tags` text input to the add form (`name="tags"`, placeholder "Tags, comma separated"), passed to `rooms.add` as `tags`.
  - `handleSetTags(roomId, text)` calling `rooms.setTags.mutate({ actorId, roomId, tags })` via a third `useAction()`; show its `error` in a `FormError` next to the archive one.
  - the limits (`ROOM_TAG_MAX_LENGTH`, `ROOM_TAGS_MAX`) come from `@repo/db/shared` only, for hint text or input `maxLength`.
- `apps/web/src/components/room-list.tsx`: render `room.tags` as badges (reuse `#/components/ui/badge`); add an "Edit tags" button that toggles an inline form with an `Input` prefilled from `room.tags.join(", ")`, plus Save and Cancel; Save calls `onSetTags`. Local state for which room is editing; props `onSetTags` and the shared `disabled`.
- `bookings.tsx` also uses `Room`; confirm it still typechecks (no UI change there).
- The rooms page loader uses the default `rooms.list`, which hides archived rooms. Archived-room editing is therefore service/API level only. The spec requires nothing more in the UI.

Check: `bun run check`, then `bun run dev`, open `/rooms` as Kim (admin): add a room with "TV, tv, Whiteboard", see two badges; edit tags; clear the field to remove them; over-limit input and acting as a member show the error.

## Final verification

`bun test` (all packages), `bun run check`, then the manual walk-through above. Confirm `packages/db/migrations/` including `meta/` is staged for commit.
