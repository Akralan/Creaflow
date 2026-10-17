import { describe, expect, it } from "vitest";
import { selectLeastRecentlyUsedAngle } from "./angleSelection";

const ANGLES = [{ id: "a" }, { id: "b" }, { id: "c" }];

describe("selectLeastRecentlyUsedAngle", () => {
  it("returns null if there is no active angle", () => {
    expect(selectLeastRecentlyUsedAngle([], [])).toBeNull();
  });

  it("returns the first active angle when nothing has ever been used", () => {
    expect(selectLeastRecentlyUsedAngle(ANGLES, [])).toEqual({ id: "a" });
  });

  it("a never-used angle always beats an already-used angle", () => {
    // "a" was used recently, "b" and "c" never.
    expect(selectLeastRecentlyUsedAngle(ANGLES, ["a"])).toEqual({ id: "b" });
  });

  it("among never-used angles, the first in the active list wins (deterministic tie-break)", () => {
    expect(selectLeastRecentlyUsedAngle(ANGLES, [])).toEqual({ id: "a" });
    expect(selectLeastRecentlyUsedAngle([{ id: "b" }, { id: "c" }], [])).toEqual({ id: "b" });
  });

  it("among already-used angles, the one whose last use is the oldest wins", () => {
    // order from most recent to oldest: a (rank 0), b (rank 1), c (rank 2)
    expect(selectLeastRecentlyUsedAngle(ANGLES, ["a", "b", "c"])).toEqual({ id: "c" });
  });

  it("ignores repetitions in the recent history (keeps the most recent rank)", () => {
    expect(selectLeastRecentlyUsedAngle(ANGLES, ["a", "a", "a", "b", "c"])).toEqual({ id: "c" });
  });
});
