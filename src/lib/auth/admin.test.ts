import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/auth/session", () => ({ getCurrentUserId: vi.fn() }));

import { isAdminEmail, parseAdminEmails } from "./admin";

describe("ADMIN_EMAILS (docs/SPEC_QUOTAS_ADMIN.md)", () => {
  it("reads a comma-separated list, ignoring spaces and case", () => {
    const admins = parseAdminEmails(" Moi@Exemple.fr, test@exemple.fr ,,");
    expect([...admins]).toEqual(["moi@exemple.fr", "test@exemple.fr"]);
    expect(isAdminEmail("MOI@exemple.FR", admins)).toBe(true);
    expect(isAdminEmail("autre@exemple.fr", admins)).toBe(false);
  });

  it("personne n'est admin sans la variable", () => {
    expect(isAdminEmail("moi@exemple.fr", parseAdminEmails(undefined))).toBe(false);
  });
});
