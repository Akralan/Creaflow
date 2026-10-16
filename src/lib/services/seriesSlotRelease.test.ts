import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));
vi.mock("@/lib/services/seriesService", () => ({ listActiveSeriesForUser: vi.fn() }));

import { pickReplacementSeries } from "./seriesSlotRelease";

const slot = (id: string, day: number, platform = "linkedin") => ({ id, platform, date: new Date(Date.UTC(2026, 9, day)) });

describe("pickReplacementSeries", () => {
  it("répartit les créneaux orphelins au prorata du poids des séries restantes", () => {
    const picks = pickReplacementSeries(
      [slot("a", 21), slot("b", 24), slot("c", 28)],
      [
        { id: "lourde", weight: 40, categoryId: "r1", platforms: [] },
        { id: "legere", weight: 20, categoryId: "r2", platforms: [] },
      ]
    );
    expect([...picks.values()].map((s) => s?.id)).toEqual(["lourde", "legere", "lourde"]);
  });

  it("respecte les réseaux d'une série", () => {
    const picks = pickReplacementSeries([slot("a", 21, "x")], [{ id: "linkedin-seule", weight: 40, categoryId: "r1", platforms: ["linkedin"] }]);
    expect(picks.get("a")).toBeNull();
  });

  it("laisse en post libre quand il ne reste aucune série", () => {
    expect(pickReplacementSeries([slot("a", 21)], []).get("a")).toBeNull();
  });
});
