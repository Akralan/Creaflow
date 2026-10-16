import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { nextEpisode, releaseOrphanedBeats, type NarrativeBeat } from "./narrativeDirector";

const beat = (id: string, status: NarrativeBeat["status"], scriptId: string | null): NarrativeBeat =>
  ({ id, status, scriptId, title: id, angle: "", rationale: "", kind: "episode", focusDocIds: [] }) as unknown as NarrativeBeat;

describe("releaseOrphanedBeats", () => {
  it("remet à rédiger l'épisode dont le script a été supprimé, sans toucher aux autres", () => {
    const beats = [beat("1", "drafted", "s1"), beat("2", "drafted", "s2"), beat("3", "planned", null)];
    const next = releaseOrphanedBeats(beats, new Set(["s1"]));
    expect(next?.map((b) => [b.id, b.status, b.scriptId])).toEqual([
      ["1", "drafted", "s1"],
      ["2", "planned", null],
      ["3", "planned", null],
    ]);
  });

  it("laisse un épisode publié tel quel : c'est de l'historique", () => {
    expect(releaseOrphanedBeats([beat("1", "published", "s1")], new Set())).toBeNull();
  });

  it("ne réécrit rien quand tous les scripts existent", () => {
    expect(releaseOrphanedBeats([beat("1", "drafted", "s1")], new Set(["s1"]))).toBeNull();
  });
});

describe("nextEpisode", () => {
  const plan = [beat("1", "drafted", "s1"), beat("2", "drafted", "s2"), beat("3", "planned", null), beat("4", "planned", null)];

  it("donne le premier épisode à rédiger, jamais un épisode déjà rédigé", () => {
    expect(nextEpisode(plan, null)?.id).toBe("3");
  });

  it("garde l'épisode du script réécrit (« autre idée, même brief »)", () => {
    expect(nextEpisode(plan, "2")?.id).toBe("2");
  });

  it("ne donne rien quand le plan est épuisé", () => {
    expect(nextEpisode([beat("1", "drafted", "s1")], null)).toBeNull();
  });
});
