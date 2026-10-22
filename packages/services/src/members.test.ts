import { beforeEach, describe, expect, test } from "bun:test";
import { createTestDatabase } from "@repo/db/testing";
import { createTeam, type Team } from "./fixtures.ts";
import { createMembersService, type MembersService } from "./members.ts";

let team: Team;
let members: MembersService;

beforeEach(async () => {
  team = await createTeam();
  members = createMembersService(team.db);
});

describe("members service", () => {
  test("an admin adds a member, email normalised", async () => {
    const member = await members.add(team.admin.id, {
      email: "  Dee@Example.com ",
      name: "Dee",
    });

    expect(member).toMatchObject({ email: "dee@example.com", role: "member" });
  });

  test("a member cannot add members", async () => {
    await expect(
      members.add(team.ana.id, { email: "dee@example.com", name: "Dee" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("a taken email is a conflict", async () => {
    await expect(
      members.add(team.admin.id, { email: "ana@example.com", name: "Ana 2" })
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("get throws NOT_FOUND for an unknown id", async () => {
    await expect(members.get("999")).rejects.toMatchObject({
      code: "NOT_FOUND",
    });
  });

  test("an admin cannot demote themselves", async () => {
    await expect(
      members.setRole(team.admin.id, team.admin.id, "member")
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(
      (await members.setRole(team.admin.id, team.ana.id, "admin")).role
    ).toBe("admin");
  });

  test("bootstrapAdmin makes an admin on an empty team, once", async () => {
    const service = createMembersService(createTestDatabase());

    const first = await service.bootstrapAdmin({
      email: "Boss@Example.com",
      name: "Boss",
    });
    expect(first).toMatchObject({ email: "boss@example.com", role: "admin" });

    const second = await service.bootstrapAdmin({
      email: "other@example.com",
      name: "Other",
    });
    expect(second).toBeNull();
    expect(await service.list()).toHaveLength(1);
  });

  test("bootstrapAdmin does nothing once the team has members", async () => {
    expect(
      await members.bootstrapAdmin({ email: "x@example.com", name: "X" })
    ).toBeNull();
  });
});
