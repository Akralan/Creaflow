import { describe, expect, it } from "vitest";
import { selectLeastRecentlyUsedAngle } from "./angleSelection";

const ANGLES = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("selectLeastRecentlyUsedAngle", () => {
  it("renvoie null si aucun angle actif", () => {
    expect(selectLeastRecentlyUsedAngle([], [])).toBeNull();
  });

  it("renvoie le premier angle actif quand rien n'a jamais été utilisé", () => {
    expect(selectLeastRecentlyUsedAngle(ANGLES, [])).toEqual({ id: "a" });
  });

  it("un angle jamais utilisé gagne toujours face à un angle déjà utilisé", () => {
    // "a" a été utilisé récemment, "b" et "c" jamais.
    expect(selectLeastRecentlyUsedAngle(ANGLES, ["a"])).toEqual({ id: "b" });
  });

  it("parmi des angles jamais utilisés, le premier de la liste active gagne (tie-break déterministe)", () => {
    expect(selectLeastRecentlyUsedAngle(ANGLES, [])).toEqual({ id: "a" });
    expect(selectLeastRecentlyUsedAngle([{ id: "b" }, { id: "c" }], [])).toEqual({ id: "b" });
  });

  it("parmi les angles déjà utilisés, celui dont le dernier usage est le plus ancien gagne", () => {
    // ordre du plus récent au plus ancien : a (rang 0), b (rang 1), c (rang 2)
    expect(selectLeastRecentlyUsedAngle(ANGLES, ["a", "b", "c"])).toEqual({ id: "c" });
  });

  it("ignore les répétitions dans l'historique récent (garde le rang le plus récent)", () => {
    expect(selectLeastRecentlyUsedAngle(ANGLES, ["a", "a", "a", "b", "c"])).toEqual({ id: "c" });
  });
});
