import { describe, expect, it } from "vitest";
import { addDays, groupPosts, mondayOf, postState, scriptReadiness, shortDay, weekCounter, weekRange, type SlotLike } from "./weekPosts";

function slot(id: string, platform: string, date: string, over: Partial<SlotLike> = {}): SlotLike {
  return { id, platform, scheduledDate: `${date}T00:00:00.000Z`, seriesId: "s1", status: "planned", script: null, ...over };
}

describe("groupPosts", () => {
  it("pairs the two networks of a series on a day, LinkedIn first, and ignores other networks", () => {
    const groups = groupPosts([
      slot("x1", "x", "2026-10-21"),
      slot("l1", "linkedin", "2026-10-21"),
      slot("l2", "linkedin", "2026-10-23"),
      slot("i1", "instagram", "2026-10-22"),
    ]);
    expect(groups.map((g) => g.date)).toEqual(["2026-10-21", "2026-10-23"]);
    expect(groups[0].versions.linkedin?.id).toBe("l1");
    expect(groups[0].versions.x?.id).toBe("x1");
    expect(groups[1].versions.x).toBeUndefined();
  });

  it("keeps two series of the same day apart", () => {
    const groups = groupPosts([slot("a", "linkedin", "2026-10-21", { seriesId: "s1" }), slot("b", "linkedin", "2026-10-21", { seriesId: "s2" })]);
    expect(groups).toHaveLength(2);
  });
});

describe("postState", () => {
  const written = (status: "draft" | "planned" | "published") => ({ id: "x", status });
  it("is empty without a script, writing while a slot loads", () => {
    expect(postState(groupPosts([slot("a", "linkedin", "2026-10-21")])[0])).toBe("empty");
    expect(postState(groupPosts([slot("a", "linkedin", "2026-10-21", { status: "generating" })])[0])).toBe("writing");
  });

  it("is as far along as its least advanced version", () => {
    const draftAndReady = groupPosts([
      slot("a", "linkedin", "2026-10-21", { script: written("planned") }),
      slot("b", "x", "2026-10-21", { script: written("draft") }),
    ])[0];
    expect(postState(draftAndReady)).toBe("draft");
    const bothReady = groupPosts([
      slot("a", "linkedin", "2026-10-21", { script: written("planned") }),
      slot("b", "x", "2026-10-21", { script: written("planned") }),
    ])[0];
    expect(postState(bothReady)).toBe("ready");
  });

  it("keeps writing while the second version is still loading", () => {
    const group = groupPosts([
      slot("a", "linkedin", "2026-10-21", { script: written("planned") }),
      slot("b", "x", "2026-10-21", { status: "generating" }),
    ])[0];
    expect(postState(group)).toBe("writing");
  });

  it("reads the retired shot status as Ready and published as Posted", () => {
    expect(scriptReadiness("shot")).toBe("ready");
    expect(scriptReadiness("published")).toBe("posted");
    expect(scriptReadiness("draft")).toBe("draft");
  });
});

describe("weekCounter", () => {
  it("counts the ready posts out of the planned ones", () => {
    const groups = groupPosts([
      slot("a", "linkedin", "2026-10-21", { script: { id: "1", status: "planned" } }),
      slot("b", "linkedin", "2026-10-23", { script: { id: "2", status: "draft" } }),
      slot("c", "linkedin", "2026-10-24"),
    ]);
    expect(weekCounter(groups)).toEqual({ ready: 1, total: 3 });
  });
});

describe("dates", () => {
  it("finds the Monday of a week, UTC", () => {
    expect(mondayOf(new Date("2026-10-25T23:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-19");
    expect(mondayOf(new Date("2026-10-19T00:00:00Z")).toISOString().slice(0, 10)).toBe("2026-10-19");
  });

  it("writes a week range, across months too", () => {
    expect(weekRange(new Date("2026-10-19T00:00:00Z"))).toBe("Oct 19 – 25");
    expect(weekRange(addDays(new Date("2026-10-19T00:00:00Z"), 7))).toBe("Oct 26 – Nov 1");
  });

  it("writes a short day", () => {
    expect(shortDay("2026-10-21")).toBe("Wed 21");
  });
});
