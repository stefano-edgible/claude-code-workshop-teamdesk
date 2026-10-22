import {
  ROOM_CAPACITY_MAX,
  ROOM_NAME_MAX_LENGTH,
  ROOM_TAG_MAX_LENGTH,
  ROOM_TAGS_MAX,
} from "@repo/db/shared";
import { createFileRoute } from "@tanstack/react-router";
import { type FormEvent, useCallback } from "react";
import FormError from "#/components/form-error";
import MemberPicker from "#/components/member-picker";
import PageError from "#/components/page-error";
import RoomList from "#/components/room-list";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { useActingMember } from "#/hooks/use-acting-member";
import { useAction } from "#/hooks/use-action";
import { getTrpc } from "#/integrations/trpc/client";
import { parseTags } from "#/lib/tags";

export const Route = createFileRoute("/rooms")({
  loader: async () => {
    const trpc = getTrpc();
    const [members, rooms] = await Promise.all([
      trpc.members.list.query(),
      trpc.rooms.list.query(),
    ]);
    return { members, rooms };
  },
  component: RoomsPage,
  errorComponent: PageError,
});

function RoomsPage() {
  const { members, rooms } = Route.useLoaderData();
  const { actingMember, setActingMemberId } = useActingMember(members);
  const addRoom = useAction();
  const archiveRoom = useAction();
  const setRoomTags = useAction();
  const actorId = actingMember?.id ?? "";

  const handleAdd = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const form = event.currentTarget;
      const data = new FormData(form);
      const ok = await addRoom.run(() =>
        getTrpc().rooms.add.mutate({
          actorId,
          room: {
            capacity: Number(data.get("capacity")),
            name: String(data.get("name") ?? ""),
            tags: parseTags(String(data.get("tags") ?? "")),
          },
        })
      );
      if (ok) {
        form.reset();
      }
    },
    [actorId, addRoom.run]
  );

  const handleArchive = useCallback(
    (roomId: string) =>
      archiveRoom.run(() =>
        getTrpc().rooms.archive.mutate({ actorId, roomId })
      ),
    [actorId, archiveRoom.run]
  );

  const handleSetTags = useCallback(
    (roomId: string, text: string) =>
      setRoomTags.run(() =>
        getTrpc().rooms.setTags.mutate({
          actorId,
          roomId,
          tags: parseTags(text),
        })
      ),
    [actorId, setRoomTags.run]
  );

  return (
    <main className="page-wrap px-4 py-12">
      <section className="flex max-w-3xl flex-col gap-4">
        <p className="island-kicker m-0">Teamdesk</p>
        <h1 className="display-title m-0 text-4xl text-foreground sm:text-5xl">
          Rooms
        </h1>
        <p className="m-0 text-base text-muted-foreground leading-8">
          The rooms the team can book. Only admins can add or archive them.
        </p>
        <MemberPicker
          members={members}
          onChange={setActingMemberId}
          value={actingMember?.id}
        />
      </section>

      <form className="island-shell mt-10 p-6 sm:p-8" onSubmit={handleAdd}>
        <p className="island-kicker mb-3">Add room</p>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Input
            aria-label="Room name"
            maxLength={ROOM_NAME_MAX_LENGTH}
            name="name"
            placeholder="Room name"
            required
          />
          <Input
            aria-label="Capacity"
            max={ROOM_CAPACITY_MAX}
            min={1}
            name="capacity"
            placeholder="Capacity"
            required
            type="number"
          />
          <Input
            aria-label="Tags"
            name="tags"
            placeholder="Tags, comma separated"
          />
          <Button disabled={addRoom.pending} type="submit">
            {addRoom.pending ? "Adding…" : "Add room"}
          </Button>
        </div>
        <p className="mt-2 mb-0 text-muted-foreground text-xs">
          Up to {ROOM_TAGS_MAX} tags, {ROOM_TAG_MAX_LENGTH} characters each.
        </p>
        <FormError message={addRoom.error} />
      </form>

      <section className="mt-10">
        <FormError message={archiveRoom.error} />
        <FormError message={setRoomTags.error} />
        <RoomList
          disabled={archiveRoom.pending || setRoomTags.pending}
          onArchive={handleArchive}
          onSetTags={handleSetTags}
          rooms={rooms}
        />
      </section>
    </main>
  );
}
