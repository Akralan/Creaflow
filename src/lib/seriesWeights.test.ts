import { describe, expect, it } from "vitest";

import { rescaleKeptWeights } from "./seriesWeights";

const all = [
  { id: "a", weight: 30 },
  { id: "b", weight: 20 },
  { id: "c", weight: 10 },
];

describe("rescaleKeptWeights", () => {
  it("redistribue la part des séries retirées sur celles gardées, au prorata", () => {
    expect(rescaleKeptWeights(all, ["a", "b"])).toEqual([
      { id: "a", weight: 36 },
      { id: "b", weight: 24 },
    ]);
  });

  it("ne touche à rien quand tout est gardé", () => {
    expect(rescaleKeptWeights(all, ["a", "b", "c"])).toEqual(all);
  });

  it("donne l'écart d'arrondi à la plus lourde pour garder le total", () => {
    const result = rescaleKeptWeights(
      [
        { id: "a", weight: 10 },
        { id: "b", weight: 10 },
        { id: "c", weight: 10 },
        { id: "d", weight: 10 },
      ],
      ["a", "b", "c"]
    );
    expect(result.reduce((sum, s) => sum + s.weight, 0)).toBe(40);
  });

  it("ne dépasse jamais 100 % au total", () => {
    const result = rescaleKeptWeights(
      [
        { id: "a", weight: 60 },
        { id: "b", weight: 60 },
      ],
      ["a"]
    );
    expect(result).toEqual([{ id: "a", weight: 100 }]);
  });
});
