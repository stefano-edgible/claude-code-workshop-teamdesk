import { beforeEach, describe, expect, test } from "bun:test";
import {
  getRoom,
  insertRoom,
  listRooms,
  setRoomArchived,
  setRoomTags,
} from "./rooms.ts";
import type { Database } from "./schema.ts";
import { createTestDatabase } from "./testing.ts";

let db: Database;

beforeEach(() => {
  db = createTestDatabase();
});

describe("rooms", () => {
  test("insertRoom returns the stored room", async () => {
    const room = await insertRoom(db, "Harbour", 8);

    expect(room).toEqual({
      archived: false,
      capacity: 8,
      id: room.id,
      name: "Harbour",
      tags: [],
    });
    expect(await getRoom(db, room.id)).toEqual(room);
  });

  test("insertRoom stores tags and getRoom returns them", async () => {
    const room = await insertRoom(db, "Harbour", 8, ["TV", "Whiteboard"]);

    expect(room.tags).toEqual(["TV", "Whiteboard"]);
    expect((await getRoom(db, room.id))?.tags).toEqual(["TV", "Whiteboard"]);
    expect((await listRooms(db))[0]?.tags).toEqual(["TV", "Whiteboard"]);
  });

  test("setRoomTags replaces the list, including on archived rooms", async () => {
    const room = await insertRoom(db, "Harbour", 8, ["TV"]);
    await setRoomArchived(db, room.id, true);

    await setRoomTags(db, room.id, ["Whiteboard", "Standing desk"]);
    expect((await getRoom(db, room.id))?.tags).toEqual([
      "Whiteboard",
      "Standing desk",
    ]);

    await setRoomTags(db, room.id, []);
    expect((await getRoom(db, room.id))?.tags).toEqual([]);
  });

  test("listRooms hides archived rooms unless asked", async () => {
    const harbour = await insertRoom(db, "Harbour", 8);
    await insertRoom(db, "Bridge", 4);
    await setRoomArchived(db, harbour.id, true);

    expect((await listRooms(db)).map((r) => r.name)).toEqual(["Bridge"]);
    expect(
      (await listRooms(db, { includeArchived: true })).map((r) => r.name)
    ).toEqual(["Bridge", "Harbour"]);
  });
});
