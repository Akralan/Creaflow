import { describe, expect, it } from "vitest";
import { describeTimeline, normalizeTimeline, TimelineValidationError } from "./timeline";

const layers = ["bg", "title", "price", "cta"];

function issuesOf(fn: () => unknown): string[] {
  try {
    fn();
  } catch (err) {
    if (err instanceof TimelineValidationError) return err.issues;
    throw err;
  }
  return [];
}

describe("normalizeTimeline", () => {
  it("accepte une ligne de temps cohérente et la trie par début", () => {
    const out = normalizeTimeline(
      [
        { layerId: "price", enter: "zoom-in", startMs: 3000, enterMs: 400, exit: "fade", exitAtMs: 6000 },
        { layerId: "title", enter: "slide-up", startMs: 300, enterMs: 600, exit: null, exitAtMs: null },
      ],
      layers,
      8000
    );
    expect(out.map((t) => t.layerId)).toEqual(["title", "price"]);
  });

  it("refuse un calque inconnu, un doublon, un début hors durée et une sortie avant l'entrée", () => {
    const issues = issuesOf(() =>
      normalizeTimeline(
        [
          { layerId: "ghost", enter: "fade", startMs: 0, enterMs: 300, exit: null, exitAtMs: null },
          { layerId: "title", enter: "fade", startMs: 0, enterMs: 300, exit: null, exitAtMs: null },
          { layerId: "title", enter: "fade", startMs: 100, enterMs: 300, exit: null, exitAtMs: null },
          { layerId: "cta", enter: "fade", startMs: 9000, enterMs: 300, exit: null, exitAtMs: null },
          { layerId: "price", enter: "fade", startMs: 1000, enterMs: 500, exit: "fade", exitAtMs: 1200 },
        ],
        layers,
        8000
      )
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("« ghost » inconnu"),
        expect.stringContaining("« title » présent deux fois"),
        expect.stringContaining("« cta » : début 9000 ms au-delà"),
        expect.stringContaining("« price » : sortie à 1200 ms avant la fin de l'entrée"),
      ])
    );
  });

  it("normalise « none », borne la sortie à la durée et ignore exitAtMs sans effet", () => {
    const out = normalizeTimeline(
      [
        { layerId: "title", enter: "fade", startMs: 0, enterMs: 300, exit: "none", exitAtMs: 5000 },
        { layerId: "cta", enter: "fade", startMs: 4000, enterMs: 300, exit: "fade", exitAtMs: 20000 },
      ],
      layers,
      8000
    );
    expect(out[0]).toMatchObject({ exit: null, exitAtMs: null });
    expect(out[1].exitAtMs).toBe(8000);
  });

  it("refuse une forme invalide (effet inconnu)", () => {
    expect(issuesOf(() => normalizeTimeline([{ layerId: "title", enter: "explode", startMs: 0, enterMs: 300, exit: null, exitAtMs: null }], layers, 8000)).length).toBeGreaterThan(0);
  });

  it("décrit la ligne de temps en français", () => {
    const text = describeTimeline(normalizeTimeline([{ layerId: "title", enter: "fade", startMs: 0, enterMs: 300, exit: null, exitAtMs: null }], layers, 8000));
    expect(text).toBe("title : fade à 0 ms (300 ms), reste jusqu'à la fin");
    expect(describeTimeline([])).toBe("(aucun calque animé)");
  });
});
