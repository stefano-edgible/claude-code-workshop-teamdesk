import { beforeEach, describe, expect, test } from "bun:test";
import { insertBooking } from "@repo/db/bookings";
import { setRoomTags } from "@repo/db/rooms";
import {
  type AvailabilityService,
  createAvailabilityService,
} from "./availability.ts";
import { at, createTeam, type Team } from "./fixtures.ts";

let team: Team;
let availability: AvailabilityService;

beforeEach(async () => {
  team = await createTeam();
  availability = createAvailabilityService(team.db);
});

describe("availability service", () => {
  test("a booked room is not free, a touching slot is", async () => {
    await insertBooking(team.db, {
      attendees: 2,
      endsAt: at("10:00"),
      memberId: team.ana.id,
      roomId: team.bigRoom.id,
      startsAt: at("09:00"),
      title: "Planning",
    });

    const during = await availability.freeRooms({
      endsAt: at("09:45"),
      startsAt: at("09:15"),
    });
    const after = await availability.freeRooms({
      endsAt: at("11:00"),
      startsAt: at("10:00"),
    });

    expect(during.ok && during.rooms.map((r) => r.name)).toEqual(["Bridge"]);
    expect(after.ok && after.rooms.map((r) => r.name)).toEqual([
      "Bridge",
      "Harbour",
    ]);
  });

  test("rooms too small for the group are left out", async () => {
    const result = await availability.freeRooms({
      attendees: 5,
      endsAt: at("10:00"),
      startsAt: at("09:00"),
    });

    expect(result.ok && result.rooms.map((r) => r.name)).toEqual(["Harbour"]);
  });

  test("an inverted slot is an error", async () => {
    const result = await availability.freeRooms({
      endsAt: at("09:00"),
      startsAt: at("10:00"),
    });

    expect(result.ok).toBe(false);
  });

  describe("tag filter", () => {
    const slot = { endsAt: at("10:00"), startsAt: at("09:00") };
    const names = (r: Awaited<ReturnType<AvailabilityService["freeRooms"]>>) =>
      r.ok && r.rooms.map((room) => room.name);

    beforeEach(async () => {
      await setRoomTags(team.db, team.bigRoom.id, ["TV", "Whiteboard"]);
      await setRoomTags(team.db, team.smallRoom.id, ["Whiteboard"]);
    });

    test("a tag matches case-insensitively", async () => {
      const result = await availability.freeRooms({ ...slot, tags: ["tv"] });

      expect(names(result)).toEqual(["Harbour"]);
    });

    test("several tags require all of them", async () => {
      const one = await availability.freeRooms({
        ...slot,
        tags: ["whiteboard"],
      });
      const both = await availability.freeRooms({
        ...slot,
        tags: ["whiteboard", "TV"],
      });

      expect(names(one)).toEqual(["Bridge", "Harbour"]);
      expect(names(both)).toEqual(["Harbour"]);
    });

    test("a matching room booked in the slot is excluded", async () => {
      await insertBooking(team.db, {
        attendees: 2,
        endsAt: at("10:00"),
        memberId: team.ana.id,
        roomId: team.bigRoom.id,
        startsAt: at("09:00"),
        title: "Planning",
      });
      const result = await availability.freeRooms({ ...slot, tags: ["tv"] });

      expect(names(result)).toEqual([]);
    });

    test("no tags leaves the result unchanged", async () => {
      const result = await availability.freeRooms(slot);

      expect(names(result)).toEqual(["Bridge", "Harbour"]);
    });
  });
});
