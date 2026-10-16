import { describe, expect, it, vi } from "vitest";

vi.mock("@/db", () => ({ db: {} }));

import { assignPlannedBeats } from "./calendarWeekService";

const slot = (id: string, seriesId: string | null, day: number) => ({ id, seriesId, date: new Date(Date.UTC(2026, 9, day)) });

describe("assignPlannedBeats", () => {
  it("donne les épisodes prévus aux créneaux vides de la série, dans l'ordre des dates", () => {
    const titles = assignPlannedBeats(
      [slot("sam", "s1", 24), slot("mer", "s1", 21), slot("libre", null, 22)],
      new Map([["s1", ["Épisode 2", "Épisode 3"]]])
    );
    expect(titles.get("mer")).toBe("Épisode 2");
    expect(titles.get("sam")).toBe("Épisode 3");
    expect(titles.has("libre")).toBe(false);
  });

  it("laisse sans titre les créneaux au-delà du plan", () => {
    const titles = assignPlannedBeats([slot("a", "s1", 21), slot("b", "s1", 24)], new Map([["s1", ["Épisode 2"]]]));
    expect(titles.has("b")).toBe(false);
  });
});
