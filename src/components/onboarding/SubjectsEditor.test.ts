import { describe, expect, it } from "vitest";
import { moveKey } from "./SubjectsEditor";

const subjects = [
  { name: "CreaFlow", description: "", targetAudience: "", keys: ["source:gh", "source:notion"] },
  { name: "Autre", description: "", targetAudience: "", keys: ["source:linear"] },
];

describe("moveKey", () => {
  it("déplace une source vers un autre sujet", () => {
    expect(moveKey(subjects, "source:notion", 1, "Journal").map((s) => s.keys)).toEqual([
      ["source:gh"],
      ["source:linear", "source:notion"],
    ]);
  });

  it("fait un sujet à part, nommé d'après la source", () => {
    const next = moveKey(subjects, "source:notion", "new", "Journal de bord");
    expect(next[2]).toEqual({ name: "Journal de bord", description: "", targetAudience: "", keys: ["source:notion"] });
  });

  it("retire le sujet qu'on vient de vider", () => {
    expect(moveKey(subjects, "source:linear", 0, "x").map((s) => s.name)).toEqual(["CreaFlow"]);
  });
});
