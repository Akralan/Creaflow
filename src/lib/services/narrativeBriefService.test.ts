import { describe, expect, it } from "vitest";
import { writtenPostsForPlacement } from "./narrativeBriefService";
import type { NarrativeKind } from "@/lib/narrative/placement";

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const script = (eventId: string | null, narrativeKind: NarrativeKind | null = null) => ({ eventId, narrativeKind });

/**
 * C'est la pièce qui fait que les deux réseaux d'un même post, et une régénération plus tard,
 * retombent sur la même décision : le créneau qu'on écrit ne compte jamais dans le rang.
 */
describe("writtenPostsForPlacement", () => {
  const slots = [
    { scriptId: "s1", scheduledDate: day("2026-01-07") },
    { scriptId: "s2", scheduledDate: day("2026-01-05") },
    { scriptId: "s3", scheduledDate: day("2026-01-09") },
  ];
  const byId = new Map([
    ["s1", script("e2")],
    ["s2", script("e1", "origin")],
    ["s3", script("e3")],
  ]);

  it("rend les posts écrits dans l'ordre des jours", () => {
    expect(writtenPostsForPlacement(slots, byId, "2026-02-01")).toEqual([
      { date: "2026-01-05", narrativeKind: "origin", eventId: "e1" },
      { date: "2026-01-07", narrativeKind: null, eventId: "e2" },
      { date: "2026-01-09", narrativeKind: null, eventId: "e3" },
    ]);
  });

  it("exclut le créneau qu'on est en train d'écrire", () => {
    expect(writtenPostsForPlacement(slots, byId, "2026-01-09").map((p) => p.date)).toEqual(["2026-01-05", "2026-01-07"]);
  });

  it("exclut les deux réseaux du même jour, pas seulement un", () => {
    const paire = [...slots, { scriptId: "s4", scheduledDate: day("2026-01-09") }];
    byId.set("s4", script("e3"));
    expect(writtenPostsForPlacement(paire, byId, "2026-01-09").map((p) => p.date)).toEqual(["2026-01-05", "2026-01-07"]);
  });

  it("ignore un créneau vide ou dont le script a disparu", () => {
    const bancals = [...slots, { scriptId: null, scheduledDate: day("2026-01-11") }, { scriptId: "fantome", scheduledDate: day("2026-01-12") }];
    expect(writtenPostsForPlacement(bancals, byId, "2026-02-01")).toHaveLength(3);
  });
});
