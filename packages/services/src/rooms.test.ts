import { beforeEach, describe, expect, test } from "bun:test";
import { createTeam, type Team } from "./fixtures.ts";
import { createRoomsService, type RoomsService } from "./rooms.ts";

let team: Team;
let rooms: RoomsService;

beforeEach(async () => {
  team = await createTeam();
  rooms = createRoomsService(team.db);
});

describe("rooms service", () => {
  test("an admin adds a room", async () => {
    const result = await rooms.add(team.admin.id, {
      capacity: 6,
      name: "Quay",
    });

    expect(result.ok).toBe(true);
    expect((await rooms.list()).map((r) => r.name)).toContain("Quay");
  });

  test("members cannot add rooms", async () => {
    const result = await rooms.add(team.ana.id, { capacity: 6, name: "Quay" });

    expect(result).toEqual({ error: "Only admins can add rooms.", ok: false });
  });

  test("duplicate names are refused", async () => {
    const result = await rooms.add(team.admin.id, {
      capacity: 6,
      name: "Harbour",
    });

    expect(result.ok).toBe(false);
  });

  test("archiving hides a room from the default list", async () => {
    const result = await rooms.archive(team.admin.id, team.bigRoom.id);

    expect(result.ok).toBe(true);
    expect((await rooms.list()).map((r) => r.name)).toEqual(["Bridge"]);
  });

  describe("tags", () => {
    const add = (tags: string[]) =>
      rooms.add(team.admin.id, { capacity: 6, name: "Quay", tags });
    const quayTags = async () =>
      (await rooms.list()).find((r) => r.name === "Quay")?.tags;

    test("a room is added with tags and list shows them", async () => {
      const result = await add(["TV", "Whiteboard"]);

      expect(result.ok).toBe(true);
      expect(await quayTags()).toEqual(["TV", "Whiteboard"]);
    });

    test("a tag over 30 characters is rejected", async () => {
      const result = await add(["x".repeat(31)]);

      expect(result.ok).toBe(false);
      expect(await quayTags()).toBeUndefined();
    });

    test("more than 10 tags are rejected", async () => {
      const result = await add(Array.from({ length: 11 }, (_, i) => `t${i}`));

      expect(result.ok).toBe(false);
    });

    test("case-insensitive duplicates collapse, first spelling wins", async () => {
      await add(["TV", "tv", "Tv"]);

      expect(await quayTags()).toEqual(["TV"]);
    });

    test("duplicates do not count towards the limit", async () => {
      const tags = Array.from({ length: 10 }, (_, i) => `t${i}`);
      const result = await add([...tags, "T0"]);

      expect(result.ok).toBe(true);
    });

    test("tags are trimmed", async () => {
      await add(["  TV  "]);

      expect(await quayTags()).toEqual(["TV"]);
    });

    test("blank tags are rejected", async () => {
      expect((await add(["TV", "   "])).ok).toBe(false);
      expect((await add([""])).ok).toBe(false);
    });

    test("an admin replaces tags with setTags", async () => {
      await rooms.setTags(team.admin.id, team.bigRoom.id, ["TV"]);
      const result = await rooms.setTags(team.admin.id, team.bigRoom.id, [
        "Whiteboard",
      ]);

      expect(result.ok && result.room.tags).toEqual(["Whiteboard"]);
      expect(
        (await rooms.list()).find((r) => r.id === team.bigRoom.id)?.tags
      ).toEqual(["Whiteboard"]);
    });

    test("members cannot set tags", async () => {
      const result = await rooms.setTags(team.ana.id, team.bigRoom.id, ["TV"]);

      expect(result).toEqual({
        error: "Only admins can edit room tags.",
        ok: false,
      });
    });

    test("an unknown room is an error", async () => {
      const result = await rooms.setTags(team.admin.id, "nope", ["TV"]);

      expect(result).toEqual({ error: "Room nope does not exist.", ok: false });
    });

    test("setTags works on an archived room", async () => {
      await rooms.archive(team.admin.id, team.bigRoom.id);
      const result = await rooms.setTags(team.admin.id, team.bigRoom.id, [
        "TV",
      ]);

      expect(result.ok).toBe(true);
      const all = await rooms.list({ includeArchived: true });
      expect(all.find((r) => r.id === team.bigRoom.id)?.tags).toEqual(["TV"]);
    });
  });
});
