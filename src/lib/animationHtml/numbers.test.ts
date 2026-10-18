import { describe, expect, it } from "vitest";
import { foreignNumbers, numbersIn } from "./numbers";

const POST = "L'iPhone 11 de Julien ratait une répétition sur trois à 6 fps. Il faisait 20 squats. La latence : 300 à 600 ms. Seuils : 160° et 100°. Le 23 novembre, 1 500 images.";

describe("numbersIn", () => {
  it("reads digits, decimals with a comma or a point, thousands with a space, and small number words", () => {
    const found = numbersIn("1 500 images, 2,5 s, 3.5 s, trois essais, ten tries");
    expect([...found].sort((a, b) => a - b)).toEqual([2.5, 3, 3.5, 10, 1500]);
  });
});

describe("foreignNumbers", () => {
  it("lets through every figure of the post, in any form", () => {
    expect(foreignNumbers("6 fps · 300–600 ms · 100° · 160° · 20 · 3 · 1500 · 11 · 23", POST)).toEqual([]);
  });

  it("flags a figure the post never states", () => {
    expect(foreignNumbers("12 squats · 13/20 · 6 fps", POST)).toEqual([12, 13]);
  });

  it("lets small counting labels and zero through (0 to 3), not other figures", () => {
    expect(foreignNumbers("0 1 2 3 · 4 · 7", POST)).toEqual([4, 7]);
  });

  it("ignores text without numbers", () => {
    expect(foreignNumbers("Le bon angle. Le mauvais compte.", POST)).toEqual([]);
  });
});
