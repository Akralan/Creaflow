import { describe, expect, it } from "vitest";

import { FORMS, GENRES, PHASE_FORMS, formFor, genreToFormTable, isFormAllowed } from "./llm/postForms";
import { focusTimeline } from "./services/seriesReaderService";
import { writerForms } from "./llm/pointerPostWriter";
import type { TimelineEntry } from "./llm/pointerPostWriter";
import { PHASES, phaseChoice, phaseOfChoice } from "./phases";
import { fitTweets, joinThread, threadTweets } from "./xThreadFormat";

describe("phases et formes", () => {
  it("ne permet le lancement qu'au lancement", () => {
    for (const phase of PHASES) expect(isFormAllowed("launch", phase)).toBe(phase === "launch");
  });

  it("fait d'une livraison disponible une démo en construction et en bêta, un lancement au lancement", () => {
    const delivery = { genre: "livraison" as const, disponible: true, tientGenre: null };
    expect(formFor(delivery, "build")).toBe("demo");
    expect(formFor(delivery, "beta")).toBe("demo");
    expect(formFor(delivery, "launch")).toBe("launch");
    expect(formFor(delivery, "grow")).toBe("episode");
    // Sans phase, le comportement d'avant.
    expect(formFor(delivery)).toBe("launch");
  });

  it("fait d'une offre un appel à bêta en bêta", () => {
    expect(formFor({ genre: "offre", disponible: false, tientGenre: null }, "beta")).toBe("beta_call");
    expect(formFor({ genre: "offre", disponible: false, tientGenre: null }, "launch")).toBe("offer");
  });

  it("rend toujours une forme permise dans la phase", () => {
    for (const phase of PHASES)
      for (const genre of GENRES)
        for (const disponible of [false, true]) expect(PHASE_FORMS[phase]).toContain(formFor({ genre, disponible, tientGenre: null }, phase));
  });

  it("n'écrit dans la table que des formes permises", () => {
    const table = genreToFormTable("build");
    expect(table).not.toContain("launch");
    expect(table).toContain("livraison, marked (available) → demo");
  });

  it("donne au rédacteur les formes de la phase et l'origine", () => {
    expect(writerForms("launch")).toEqual(FORMS.filter((f) => ["launch", "offer", "demo", "proof", "origin"].includes(f)));
    expect(writerForms(null)).toEqual([...FORMS]);
  });

  it("passe d'un choix à une phase et retour", () => {
    expect(phaseOfChoice("open", "build")).toBe("beta");
    expect(phaseOfChoice("open", "launch")).toBe("launch");
    expect(phaseChoice("launch")).toBe("open");
  });
});

const entry = (over: Partial<TimelineEntry>): TimelineEntry => ({
  id: "e",
  file: "docs/DEVLOG.md",
  line: 1,
  date: null,
  used: false,
  genre: "livraison",
  disponible: false,
  tient: null,
  ...over,
});

describe("focusTimeline", () => {
  it("met les faits datés les plus récents en tête et laisse le futur à la réserve", () => {
    const out = focusTimeline(
      [entry({ id: "old", date: "2026-09-01" }), entry({ id: "new", date: "2026-10-25" }), entry({ id: "plan", date: "2026-12-02" })],
      "2026-10-26"
    );
    expect(out.map((e) => e.id)).toEqual(["new", "old", "plan"]);
  });

  it("met les sources vécues avant les specs dans la réserve", () => {
    const out = focusTimeline(
      [entry({ id: "spec", file: "docs/SPEC_X.md" }), entry({ id: "doc", file: "docs/PRODUCT.md" }), entry({ id: "log", file: "docs/DEVLOG.md" })],
      "2026-10-26"
    );
    expect(out.map((e) => e.id)).toEqual(["log", "doc", "spec"]);
  });

  it("retire ce qui est déjà raconté, sans rien couper d'autre", () => {
    const many = Array.from({ length: 300 }, (_, i) => entry({ id: `d${i}`, date: `2026-10-${String((i % 25) + 1).padStart(2, "0")}` }));
    const undated = Array.from({ length: 300 }, (_, i) => entry({ id: `u${i}`, file: "docs/SPEC_A.md", line: i }));
    const out = focusTimeline([...many, ...undated, entry({ id: "used", date: "2026-10-26", used: true })], "2026-10-26");
    expect(out).toHaveLength(600);
    expect(out.some((e) => e.id === "used")).toBe(false);
  });

  it("garde l'événement qu'un événement gardé tient", () => {
    const out = focusTimeline([entry({ id: "kept", date: "2026-10-25", tient: "held" }), entry({ id: "held", date: "2026-01-01", used: true })], "2026-10-26");
    expect(out.map((e) => e.id)).toEqual(["kept", "held"]);
  });
});

describe("thread X", () => {
  it("range le premier tweet en titre et les autres en caption", () => {
    const { title, caption } = joinThread(["un", "deux", "trois"]);
    expect(title).toBe("un");
    expect(threadTweets(title, caption)).toEqual(["un", "deux", "trois"]);
  });

  it("garde un tweet unique des deux côtés sans le doubler", () => {
    const { title, caption } = joinThread(["seul"]);
    expect(caption).toBe("seul");
    expect(threadTweets(title, caption)).toEqual(["seul"]);
  });

  it("coupe un tweet trop long aux fins de phrase", () => {
    const long = `${"a".repeat(200)}. ${"b".repeat(200)}.`;
    const out = fitTweets([long], 280);
    expect(out).toHaveLength(2);
    expect(out.every((t) => t.length <= 280)).toBe(true);
  });
});
