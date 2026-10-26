import { beforeEach, describe, expect, it, vi } from "vitest";

const { callStructuredMock } = vi.hoisted(() => ({ callStructuredMock: vi.fn() }));
vi.mock("./provider", () => ({ callStructured: callStructuredMock }));

import { buildRepoCardMessage, describeRepoCard } from "./repoCard";

beforeEach(() => callStructuredMock.mockReset());

describe("describeRepoCard", () => {
  it("renvoie les cinq champs nettoyés", async () => {
    callStructuredMock.mockResolvedValue({
      name: " RelayKit ",
      tagline: "Webhook delivery for SaaS",
      building: "A tool to deliver webhooks.",
      who: "Backend developers.",
      problem: "Webhook failures are hard to debug.",
    });
    const card = await describeRepoCard({ fullName: "a/relaykit", repoDescription: null, language: "TypeScript", excerpt: "README" });
    expect(card.name).toBe("RelayKit");
    expect(card.problem).toBe("Webhook failures are hard to debug.");
  });

  it("complète par des chaînes vides les champs que le modèle omet", async () => {
    callStructuredMock.mockResolvedValue({ name: "X" });
    const card = await describeRepoCard({ fullName: "a/x", repoDescription: null, language: null, excerpt: "" });
    expect(card).toEqual({ name: "X", tagline: "", building: "", who: "", problem: "", phase: "build", phaseReason: "" });
  });
});

describe("buildRepoCardMessage", () => {
  it("n'écrit que les lignes connues", () => {
    const message = buildRepoCardMessage({ fullName: "a/x", repoDescription: null, language: null, excerpt: "hello" });
    expect(message).toContain("Repository: a/x");
    expect(message).not.toContain("GitHub description");
    expect(message).toContain("hello");
  });
});
