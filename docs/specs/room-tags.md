# Room tags

Admins record what a room has (TV, whiteboard, standing desks) as free-form tags. Everyone sees them on the rooms page, and the free-room query can filter on them.

## Decisions (from the interview)

- Free-form tags, not a fixed checklist.
- Only admins can set tags.
- Tags are set when a room is added and can be replaced later on any room, archived rooms included.
- UI is the rooms page only. The free-room filter is API-only (`rooms.free`); no new finder screen and no tag filter in the booking form.

## Tag rules

- Trimmed, 1-30 characters, any characters allowed.
- At most 10 tags per room.
- Duplicates are dropped case-insensitively ("tv" and "TV" are one tag). The first spelling entered is kept.
- Order is preserved as entered.
- Constants `ROOM_TAG_MAX_LENGTH = 30` and `ROOM_TAGS_MAX = 10` go in `packages/db/src/shared.ts`.
- Input that is over a limit is rejected with a clear message, not silently truncated. Duplicates are the only thing silently dropped.

## Data

- `rooms` gets a `tags` column: text, not null, default `'[]'`, a JSON array of strings. Add it in `schema.ts`, then `cd packages/db && bun run generate` and commit the new migration with `meta/`.
- Existing rooms get `[]`.
- `Room` in `shared.ts` gains `tags: string[]`.
- `packages/db/src/rooms.ts`: select and map `tags` (parse JSON), `insertRoom` takes tags, and add `setRoomTags(db, id, tags)`. No validation in this layer.

## Service (`@repo/services/rooms`)

- `addRoomInput` gains `tags`, defaulting to `[]`, using a shared zod `tagsSchema` that does the trimming, length and count checks and the case-insensitive de-duplication.
- New `rooms.setTags(actorId, roomId, tags)`: admin only ("Only admins can edit room tags."), unknown room gives "Room X does not exist.", and the tag list is replaced wholesale. It returns a `RoomResult`, like the other methods in this file.
- `rooms.ts` keeps its result-object style rather than throwing, to stay consistent with the file as it is.

## Filtering (`@repo/services/availability`)

- `freeRoomsInput` gains optional `tags: string[]` (default `[]`).
- A room matches only if it has **all** the requested tags, compared case-insensitively. With no tags requested, behaviour is unchanged.
- The tag filter runs before the booking-overlap query, so non-matching rooms cost nothing.
- Expose `tags` on the `rooms.free` tRPC input.

## tRPC (`rooms` router)

- `add` already takes `addRoomInput`, so tags come through with no router change.
- New `setTags`: `{ actorId, roomId, tags }`, one service call, `BAD_REQUEST` on `!ok`.
- `free` accepts `tags`.

## UI (`apps/web/src/routes/rooms.tsx`)

- Each room shows its tags as small badges.
- The add-room form gets a tags field: comma-separated text, split and passed to `rooms.add`.
- Each room gets an "Edit tags" action with the same comma-separated input, prefilled with the current tags. Saving calls `rooms.setTags`. Clearing the field removes all tags.
- Server errors (over a limit, not an admin) show in the existing form error area.
- The browser imports only `@repo/db/shared`, which is why the limits live there.

## Tests

Use `createTestDatabase()` and the `fixtures.ts` team (an admin and members, and two rooms).

- Add a room with tags, then list it and see the tags.
- Reject a tag over 30 characters and more than 10 tags.
- "TV, tv, Tv" gives one tag, "TV".
- Whitespace is trimmed, and empty or blank tags are rejected or dropped consistently (pick one in the build: reject).
- `setTags` as admin replaces the list; as a non-admin returns the error; unknown room returns the error; works on an archived room.
- `freeRooms` with `tags: ["tv"]` returns only rooms that have a TV (case-insensitive) and are free; with two tags it requires both; a room with the tags that is booked in the slot is excluded.

## Out of scope

- A free-room finder screen and a tag filter on the booking form's room picker.
- Tag autocomplete or suggestions, a tag catalogue, and renaming a tag across rooms.
- Member-editable tags and a tag edit history.
- Any auth work. `actorId` is trusted as it is today.
