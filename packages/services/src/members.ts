// Who is on the team. There is no sign-in yet, so every mutation elsewhere
// takes the acting member's id and looks them up here.
import type { Database } from "@repo/db";
import {
  createMember,
  getMember,
  getMemberByEmail,
  listMembers,
  updateMemberRole,
} from "@repo/db/members";
import {
  MEMBER_NAME_MAX_LENGTH,
  MEMBER_ROLES,
  type Member,
  type MemberRole,
} from "@repo/db/shared";
import { z } from "zod";
import { ConflictError, ForbiddenError, NotFoundError } from "./errors.ts";

export const addMemberInput = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Enter a valid email address.")),
  name: z
    .string()
    .trim()
    .min(1, "Name must not be empty.")
    .max(
      MEMBER_NAME_MAX_LENGTH,
      `Name must be at most ${MEMBER_NAME_MAX_LENGTH} characters.`
    ),
  role: z.enum(MEMBER_ROLES).default("member"),
});

export type AddMemberInput = z.input<typeof addMemberInput>;

export interface MembersService {
  /** Admins only. Throws ConflictError when the email is taken. */
  add: (actorId: string, input: AddMemberInput) => Promise<Member>;
  /**
   * First-run setup: creates an admin only while the team is empty, and does
   * nothing otherwise. Returns the new admin, or null when nobody was added.
   */
  bootstrapAdmin: (
    input: Omit<AddMemberInput, "role">
  ) => Promise<Member | null>;
  /** Throws NotFoundError for an unknown id. */
  get: (id: string) => Promise<Member>;
  list: () => Promise<Member[]>;
  /** Admins only. An admin cannot demote themselves. */
  setRole: (
    actorId: string,
    memberId: string,
    role: MemberRole
  ) => Promise<Member>;
}

/** Loads the acting member, so callers can check what they may do. */
export async function requireMember(db: Database, id: string): Promise<Member> {
  const member = await getMember(db, id);
  if (!member) {
    throw new NotFoundError("Member", id);
  }
  return member;
}

export async function requireAdmin(db: Database, id: string): Promise<Member> {
  const member = await requireMember(db, id);
  if (member.role !== "admin") {
    throw new ForbiddenError("Only admins can do that.");
  }
  return member;
}

export const createMembersService = (db: Database): MembersService => ({
  add: async (actorId, input) => {
    await requireAdmin(db, actorId);
    const data = addMemberInput.parse(input);
    if (await getMemberByEmail(db, data.email)) {
      throw new ConflictError(`${data.email} is already on the team.`);
    }
    return await createMember(db, data);
  },
  bootstrapAdmin: async (input) => {
    if ((await listMembers(db)).length > 0) {
      return null;
    }
    return await createMember(
      db,
      addMemberInput.parse({ ...input, role: "admin" })
    );
  },
  get: (id) => requireMember(db, id),
  list: () => listMembers(db),
  setRole: async (actorId, memberId, role) => {
    await requireAdmin(db, actorId);
    if (actorId === memberId && role !== "admin") {
      throw new ForbiddenError("Admins cannot demote themselves.");
    }
    const member = await updateMemberRole(db, memberId, role);
    if (!member) {
      throw new NotFoundError("Member", memberId);
    }
    return member;
  },
});
