// Rooms return a result object instead of throwing. Callers check `ok`.
import type { Database } from "@repo/db";
import { isUniqueViolation } from "@repo/db";
import { getMember } from "@repo/db/members";
import {
  getRoom,
  insertRoom,
  listRooms,
  setRoomArchived,
  setRoomTags,
} from "@repo/db/rooms";
import {
  ROOM_CAPACITY_MAX,
  ROOM_NAME_MAX_LENGTH,
  ROOM_TAG_MAX_LENGTH,
  ROOM_TAGS_MAX,
  type Room,
} from "@repo/db/shared";
import { z } from "zod";

export const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, "Tags cannot be blank.")
      .max(
        ROOM_TAG_MAX_LENGTH,
        `Tags can be at most ${ROOM_TAG_MAX_LENGTH} characters.`
      )
  )
  .transform((tags) => {
    const seen = new Set<string>();
    return tags.filter((tag) => {
      const key = tag.toLowerCase();
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  })
  .pipe(
    z.array(z.string()).max(ROOM_TAGS_MAX, `Use at most ${ROOM_TAGS_MAX} tags.`)
  );

export const addRoomInput = z.object({
  capacity: z.int().min(1).max(ROOM_CAPACITY_MAX),
  name: z.string().trim().min(1).max(ROOM_NAME_MAX_LENGTH),
  tags: tagsSchema.default([]),
});

export type AddRoomInput = z.input<typeof addRoomInput>;

export type RoomResult =
  | { ok: true; room: Room }
  | { ok: false; error: string };

export interface RoomsService {
  add: (actorId: string, input: AddRoomInput) => Promise<RoomResult>;
  archive: (actorId: string, roomId: string) => Promise<RoomResult>;
  list: (opts?: { includeArchived?: boolean }) => Promise<Room[]>;
  setTags: (
    actorId: string,
    roomId: string,
    tags: string[]
  ) => Promise<RoomResult>;
}

async function isAdmin(db: Database, actorId: string): Promise<boolean> {
  const actor = await getMember(db, actorId);
  return actor?.role === "admin";
}

export const createRoomsService = (db: Database): RoomsService => ({
  add: async (actorId, input) => {
    if (!(await isAdmin(db, actorId))) {
      return { error: "Only admins can add rooms.", ok: false };
    }
    const parsed = addRoomInput.safeParse(input);
    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((issue) => issue.message).join(" "),
        ok: false,
      };
    }
    try {
      const room = await insertRoom(
        db,
        parsed.data.name,
        parsed.data.capacity,
        parsed.data.tags
      );
      return { ok: true, room };
    } catch (error) {
      if (isUniqueViolation(error)) {
        return {
          error: `A room called ${parsed.data.name} exists.`,
          ok: false,
        };
      }
      throw error;
    }
  },
  archive: async (actorId, roomId) => {
    if (!(await isAdmin(db, actorId))) {
      return { error: "Only admins can archive rooms.", ok: false };
    }
    const room = await getRoom(db, roomId);
    if (!room) {
      return { error: `Room ${roomId} does not exist.`, ok: false };
    }
    await setRoomArchived(db, roomId, true);
    return { ok: true, room: { ...room, archived: true } };
  },
  list: (opts) => listRooms(db, opts),
  setTags: async (actorId, roomId, tags) => {
    if (!(await isAdmin(db, actorId))) {
      return { error: "Only admins can edit room tags.", ok: false };
    }
    const parsed = tagsSchema.safeParse(tags);
    if (!parsed.success) {
      return {
        error: parsed.error.issues.map((issue) => issue.message).join(" "),
        ok: false,
      };
    }
    const room = await getRoom(db, roomId);
    if (!room) {
      return { error: `Room ${roomId} does not exist.`, ok: false };
    }
    await setRoomTags(db, roomId, parsed.data);
    return { ok: true, room: { ...room, tags: parsed.data } };
  },
});
