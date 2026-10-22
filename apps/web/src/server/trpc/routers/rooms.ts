import { addRoomInput } from "@repo/services/rooms";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "../init.ts";

export const roomsRouter = router({
  add: publicProcedure
    .input(z.object({ actorId: z.string(), room: addRoomInput }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.services.rooms.add(input.actorId, input.room);
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return result.room;
    }),
  archive: publicProcedure
    .input(z.object({ actorId: z.string(), roomId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.services.rooms.archive(
        input.actorId,
        input.roomId
      );
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return result.room;
    }),
  free: publicProcedure
    .input(
      z.object({
        attendees: z.int().min(1),
        endsAt: z.string(),
        startsAt: z.string(),
        tags: z.array(z.string()).default([]),
      })
    )
    .query(async ({ ctx, input }) => {
      const result = await ctx.services.availability.freeRooms(input);
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return result.rooms;
    }),
  list: publicProcedure
    .input(z.object({ includeArchived: z.boolean().default(false) }).optional())
    .query(({ ctx, input }) => ctx.services.rooms.list(input)),
  setTags: publicProcedure
    .input(
      z.object({
        actorId: z.string(),
        roomId: z.string(),
        tags: z.array(z.string()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.services.rooms.setTags(
        input.actorId,
        input.roomId,
        input.tags
      );
      if (!result.ok) {
        throw new TRPCError({ code: "BAD_REQUEST", message: result.error });
      }
      return result.room;
    }),
});
