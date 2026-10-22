// Which rooms are free for a slot. Returns a result object, like rooms.ts.
import type { Database } from "@repo/db";
import { findOverlappingBookings } from "@repo/db/bookings";
import { listRooms } from "@repo/db/rooms";
import type { Room } from "@repo/db/shared";
import { z } from "zod";

export const freeRoomsInput = z.object({
  attendees: z.int().min(1).default(1),
  endsAt: z.iso.datetime(),
  startsAt: z.iso.datetime(),
  tags: z.array(z.string()).default([]),
});

export type FreeRoomsInput = z.input<typeof freeRoomsInput>;

export type FreeRoomsResult =
  | { ok: true; rooms: Room[] }
  | { ok: false; error: string };

export interface AvailabilityService {
  /** Unarchived rooms big enough and with nothing booked in the slot. */
  freeRooms: (input: FreeRoomsInput) => Promise<FreeRoomsResult>;
}

export const createAvailabilityService = (
  db: Database
): AvailabilityService => ({
  freeRooms: async (input) => {
    const parsed = freeRoomsInput.safeParse(input);
    if (!parsed.success) {
      return { error: "Give a start and end time.", ok: false };
    }
    const startsAt = new Date(parsed.data.startsAt).toISOString();
    const endsAt = new Date(parsed.data.endsAt).toISOString();
    if (endsAt <= startsAt) {
      return { error: "The slot must end after it starts.", ok: false };
    }
    const wanted = parsed.data.tags.map((tag) => tag.trim().toLowerCase());
    const candidates = (await listRooms(db)).filter((room) => {
      if (room.capacity < parsed.data.attendees) {
        return false;
      }
      const have = room.tags.map((tag) => tag.toLowerCase());
      return wanted.every((tag) => have.includes(tag));
    });
    const clashes = await Promise.all(
      candidates.map((room) =>
        findOverlappingBookings(db, { endsAt, roomId: room.id, startsAt })
      )
    );
    const free = candidates.filter((_, i) => clashes[i]?.length === 0);
    return { ok: true, rooms: free };
  },
});
