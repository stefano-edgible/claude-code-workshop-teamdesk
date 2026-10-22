import type { Room } from "@repo/db/shared";
import { ROOM_TAG_MAX_LENGTH } from "@repo/db/shared";
import { type FormEvent, type MouseEvent, useCallback, useState } from "react";
import { Badge } from "#/components/ui/badge";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";

interface RoomListProps {
  disabled: boolean;
  onArchive: (roomId: string) => void;
  onSetTags: (roomId: string, text: string) => Promise<boolean>;
  rooms: readonly Room[];
}

export default function RoomList({
  disabled,
  onArchive,
  onSetTags,
  rooms,
}: RoomListProps) {
  const [editingId, setEditingId] = useState<string | null>(null);

  const handleArchive = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      onArchive(event.currentTarget.value),
    [onArchive]
  );
  const handleEdit = useCallback(
    (event: MouseEvent<HTMLButtonElement>) =>
      setEditingId(event.currentTarget.value),
    []
  );
  const handleCancel = useCallback(() => setEditingId(null), []);
  const handleSave = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const roomId = event.currentTarget.dataset.roomId ?? "";
      const text = String(new FormData(event.currentTarget).get("tags") ?? "");
      if (await onSetTags(roomId, text)) {
        setEditingId(null);
      }
    },
    [onSetTags]
  );

  if (rooms.length === 0) {
    return <p className="text-muted-foreground text-sm">No rooms yet.</p>;
  }
  return (
    <ul className="m-0 list-none space-y-4 p-0">
      {rooms.map((room) => (
        <li className="border-border border-t pt-4" key={room.id}>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="m-0 font-semibold text-foreground">{room.name}</p>
              <p className="m-0 text-muted-foreground text-sm">
                Seats {room.capacity}
              </p>
              {room.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {room.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                disabled={disabled}
                onClick={handleEdit}
                size="sm"
                value={room.id}
                variant="outline"
              >
                Edit tags
              </Button>
              <Button
                disabled={disabled}
                onClick={handleArchive}
                size="sm"
                value={room.id}
                variant="outline"
              >
                Archive
              </Button>
            </div>
          </div>
          {editingId === room.id && (
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              data-room-id={room.id}
              onSubmit={handleSave}
            >
              <Input
                aria-label={`Tags for ${room.name}`}
                defaultValue={room.tags.join(", ")}
                name="tags"
                placeholder={`Tags, comma separated (up to ${ROOM_TAG_MAX_LENGTH} characters each)`}
              />
              <Button disabled={disabled} size="sm" type="submit">
                Save
              </Button>
              <Button
                disabled={disabled}
                onClick={handleCancel}
                size="sm"
                type="button"
                variant="outline"
              >
                Cancel
              </Button>
            </form>
          )}
        </li>
      ))}
    </ul>
  );
}
