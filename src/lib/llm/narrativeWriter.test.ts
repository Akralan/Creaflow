import { beforeEach, describe, expect, it, vi } from "vitest";

const { callAgenticMock } = vi.hoisted(() => ({ callAgenticMock: vi.fn() }));

vi.mock("./provider", () => ({ callAgentic: callAgenticMock }));

import {
  buildNarrativeWriterUserMessage,
  NARRATIVE_WRITER_SYSTEM_PROMPTS,
  writeNarrativePost,
  type NarrativeBrief,
  type NarrativeWriterContext,
} from "./narrativeWriter";
import type { BriefEvent } from "./eventWriter";

const ev = (id: string, title: string): BriefEvent => ({
  id,
  date: "2026-02-01",
  datePrecision: "day",
  title,
  whatHappened: `Ce qui s'est passé pour ${title}.`,
  whatChanged: "Ça a changé la suite.",
  kind: "result",
});

const brief = (over: Partial<NarrativeBrief> = {}): NarrativeBrief => ({
  kind: "checkpoint",
  scope: [ev("e1", "La démo tourne"), ev("e2", "Trois kinés ont testé")],
  subject: { name: "MyKiné", description: "Un suivi d'exercices", problem: "les patients abandonnent", valueProposition: "ils tiennent trois semaines", targetAudience: "des kinés libéraux" },
  promise: null,
  reader: { label: "Kinés", who: "des kinés libéraux", knows: "", wants: "", stopsFor: "", turnsOff: "", words: [] },
  seriesLabel: "Devlog MyKiné",
  sources: [{ id: "d1", title: "Journal", text: "Le rendu passe à 60 fps sur l'iPhone 11 de Julien." }],
  ...over,
});

const context = (over: Partial<NarrativeWriterContext> = {}): NarrativeWriterContext => ({
  brandName: "Alix",
  activityType: "Développeuse",
  subjectName: "MyKiné",
  platform: "linkedin",
  contentType: "text",
  brief: brief(),
  ...over,
});

const submitted = {
  concept: "Ce qui a changé en trois semaines.",
  title: "Trois semaines",
  hookText: "La démo tourne à 60 fps.",
  caption: "Le rendu passe à 60 fps sur l'iPhone 11 de Julien. ".repeat(12),
  hashtags: ["#kine"],
  usedExcerpts: ["Le rendu passe à 60 fps sur l'iPhone 11 de Julien."],
  promisesMade: [],
};

/** Fait jouer au modèle une suite d'appels d'outils, et renvoie ce que chacun a répondu. */
function playTools(calls: Array<{ name: string; input: unknown }>) {
  callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: { name: string; input: unknown }) => Promise<unknown> }) => {
    for (const call of calls) {
      try {
        await onToolCall(call);
      } catch {
        // Le modèle reçoit l'erreur et continue : c'est exactement ce que fait la vraie boucle.
      }
    }
    return { reply: "fait", toolCalls: [], turns: calls.length, stoppedAtMaxTurns: false };
  });
}

beforeEach(() => {
  callAgenticMock.mockReset();
});

describe("message utilisateur", () => {
  it("n'expose que les événements du périmètre", () => {
    const message = buildNarrativeWriterUserMessage(context());
    expect(message).toContain("La démo tourne");
    expect(message).not.toContain("Un événement hors périmètre");
  });

  it("donne problème et proposition de valeur pour la vision, pas pour le point d'étape", () => {
    const vision = buildNarrativeWriterUserMessage(context({ brief: brief({ kind: "vision" }) }));
    expect(vision).toContain("les patients abandonnent");
    expect(vision).toContain("ils tiennent trois semaines");
    expect(buildNarrativeWriterUserMessage(context())).not.toContain("ils tiennent trois semaines");
  });

  it("donne le problème du sujet à l'origine, sans la proposition de valeur", () => {
    const origin = buildNarrativeWriterUserMessage(context({ brief: brief({ kind: "origin" }) }));
    expect(origin).toContain("les patients abandonnent");
    expect(origin).not.toContain("ils tiennent trois semaines");
  });

  it("donne la phrase de promesse et le post qui l'a faite", () => {
    const message = buildNarrativeWriterUserMessage(
      context({ brief: brief({ kind: "promise", promise: { text: "Je dirai si ça tient.", postText: "Le post d'il y a trois semaines." } }) })
    );
    expect(message).toContain("Je dirai si ça tient.");
    expect(message).toContain("Le post d'il y a trois semaines.");
  });
});

describe("système", () => {
  it("a un bloc par type, dans l'ordre de l'enum", () => {
    expect(Object.keys(NARRATIVE_WRITER_SYSTEM_PROMPTS)).toEqual(["origin", "vision", "checkpoint", "promise"]);
  });

  it("interdit partout de nommer le type dans le post", () => {
    for (const prompt of Object.values(NARRATIVE_WRITER_SYSTEM_PROMPTS)) {
      expect(prompt).toContain("Never name what kind of post this is");
    }
  });

  it("n'injecte qu'un seul bloc what_makes_a_post", () => {
    const prompt = NARRATIVE_WRITER_SYSTEM_PROMPTS.checkpoint;
    expect(prompt.match(/<what_makes_a_post>/g)).toHaveLength(1);
  });
});

describe("writeNarrativePost", () => {
  it("rend le post soumis, avec sa trace", async () => {
    playTools([{ name: "submit_post", input: submitted }]);
    const result = await writeNarrativePost(context());
    expect(result.title).toBe("Trois semaines");
    expect(result.trace).toMatchObject({ narrativeKind: "checkpoint", submissions: 1 });
  });

  it("renvoie le post au modèle quand les contrôles échouent, et garde la meilleure soumission", async () => {
    const faulty = { ...submitted, caption: "Trop court." };
    playTools([
      { name: "submit_post", input: faulty },
      { name: "submit_post", input: submitted },
    ]);
    const result = await writeNarrativePost(context());
    expect(result.caption).toBe(submitted.caption);
  });

  it("échoue clairement quand le modèle ne soumet rien", async () => {
    playTools([{ name: "read_timeline", input: {} }]);
    const erreur = await writeNarrativePost(context()).catch((e: Error) => e);
    // Le message dit POURQUOI : tours, brouillons, derniers mots du modèle.
    expect(String(erreur)).toContain("submitted no post after 1 turn(s), 0 draft(s)");
  });

  it("ne laisse pas lire un événement hors périmètre par read_timeline", async () => {
    let seen: unknown;
    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: { name: string; input: unknown }) => Promise<unknown> }) => {
      seen = await onToolCall({ name: "read_timeline", input: {} });
      await onToolCall({ name: "submit_post", input: submitted });
      return { reply: "fait", toolCalls: [], turns: 2, stoppedAtMaxTurns: false };
    });
    await writeNarrativePost(context());
    expect((seen as { events: unknown[] }).events).toHaveLength(2);
  });

  it("ne donne read_post qu'à la promesse tenue", async () => {
    playTools([{ name: "submit_post", input: submitted }]);
    await writeNarrativePost(context());
    const sansPromesse = callAgenticMock.mock.calls[0][0].tools.map((t: { name: string }) => t.name);
    expect(sansPromesse).not.toContain("read_post");

    callAgenticMock.mockReset();
    playTools([{ name: "submit_post", input: submitted }]);
    await writeNarrativePost(context({ brief: brief({ kind: "promise", promise: { text: "Je dirai si ça tient.", postText: "Le post." } }) }));
    expect(callAgenticMock.mock.calls[0][0].tools.map((t: { name: string }) => t.name)).toContain("read_post");
  });
});

describe("l'angle du lecteur", () => {
  it("donne au rédacteur l'angle du lecteur à côté des faits", () => {
    const withAngle = { ...ev("e1", "La démo tourne"), angle: "le patient voit son compteur bouger tout de suite" };
    const msg = buildNarrativeWriterUserMessage(context({ brief: brief({ scope: [withAngle] }) }));
    expect(msg).toContain("For this reader: le patient voit son compteur bouger tout de suite");
  });

  it("se passe d'angle quand il n'y en a pas", () => {
    const msg = buildNarrativeWriterUserMessage(context());
    expect(msg).not.toContain("For this reader:");
    expect(msg).toContain("La démo tourne");
  });
});
