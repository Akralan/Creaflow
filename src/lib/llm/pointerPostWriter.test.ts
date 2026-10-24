import { beforeEach, describe, expect, it, vi } from "vitest";

const { callAgenticMock } = vi.hoisted(() => ({ callAgenticMock: vi.fn() }));

vi.mock("./provider", () => ({
  callAgentic: callAgenticMock,
}));

import {
  MAX_WINDOW_LINES,
  READ_FORM_TOOL,
  buildWriterSystemPrompt,
  buildWriterUserMessage,
  expectedForm,
  runWriterTool,
  splitHookAndCaption,
  writePost,
  type TimelineEntry,
  type WriterContext,
} from "./pointerPostWriter";
import { platformRuleText } from "./platformRules";
import { formText, genreToFormTable } from "./postForms";

const entry = (over: Partial<TimelineEntry> & Pick<TimelineEntry, "id">): TimelineEntry => ({
  file: "d.md",
  line: 1,
  date: null,
  used: false,
  genre: "livraison",
  disponible: false,
  tient: null,
  ...over,
});

function ctx(over: Partial<WriterContext> = {}): WriterContext {
  return {
    brandName: "tellovo",
    projectName: "CreaFlow",
    projectContext: "CreaFlow turns material into posts.",
    readerLabel: "Indie devs",
    readerWho: "developers who ship in public",
    platform: "linkedin",
    language: "fr",
    timeline: [],
    posts: [],
    files: new Map([["d.md", ["a", "b", "c"]]]),
    ...over,
  };
}

const onePost = [{ id: "p1", date: "2026-10-01", text: "x" }];

/** Rejoue une suite d'appels d'outils dans l'ordre, enregistre ce que chacun rend, puis conclut. */
function drive(calls: Array<{ name: string; input: unknown }>) {
  const outputs: unknown[] = [];
  callAgenticMock.mockImplementation(async (params: { onToolCall: (c: { name: string; input: unknown }) => Promise<unknown> }) => {
    for (const call of calls) outputs.push(await params.onToolCall(call));
    return { reply: "done", toolCalls: calls.map((c) => ({ ...c, output: null })), turns: calls.length + 1, stoppedAtMaxTurns: false };
  });
  return outputs;
}

beforeEach(() => {
  callAgenticMock.mockReset();
});

describe("splitHookAndCaption", () => {
  it("prend la première ligne comme accroche et le reste comme caption", () => {
    expect(splitHookAndCaption("Accroche.\n\nSuite du post.")).toEqual({ hookText: "Accroche.", caption: "Suite du post." });
  });

  it("garde les paragraphes suivants dans la caption", () => {
    expect(splitHookAndCaption("Accroche.\n\nUn.\n\nDeux.").caption).toBe("Un.\n\nDeux.");
  });

  it("rend une caption non vide pour un post d'une seule phrase", () => {
    expect(splitHookAndCaption("Une seule phrase.")).toEqual({ hookText: "Une seule phrase.", caption: "Une seule phrase." });
  });
});

describe("runWriterTool", () => {
  it("read_file ramène une fenêtre hors bornes dans le document", () => {
    expect(runWriterTool(ctx(), { name: "read_file", input: { file: "d.md", from_line: 0, to_line: 99 } })).toMatchObject({ from_line: 1, to_line: 3 });
  });

  it("read_file plafonne la fenêtre à MAX_WINDOW_LINES", () => {
    const big = ctx({ files: new Map([["d.md", Array.from({ length: 500 }, (_, i) => `l${i}`)]]) });
    expect(runWriterTool(big, { name: "read_file", input: { file: "d.md", from_line: 1, to_line: 500 } })).toMatchObject({ to_line: MAX_WINDOW_LINES });
  });

  it("read_file rend une erreur nommée pour un document inconnu", () => {
    expect(runWriterTool(ctx(), { name: "read_file", input: { file: "absent.md", from_line: 1, to_line: 2 } })).toMatchObject({
      error: expect.stringContaining("absent.md"),
    });
  });

  it("read_form rend le texte de la forme, et une erreur nommée pour une forme inconnue", () => {
    expect(runWriterTool(ctx(), { name: READ_FORM_TOOL, input: { form: "failure" } })).toEqual({ form: "failure", text: formText("failure") });
    expect(runWriterTool(ctx(), { name: READ_FORM_TOOL, input: { form: "sonnet" } })).toMatchObject({ error: expect.stringContaining("sonnet") });
  });
});

describe("buildWriterUserMessage", () => {
  it("affiche le genre, la disponibilité et tient sur chaque adresse", () => {
    const m = buildWriterUserMessage(
      ctx({
        timeline: [
          entry({ id: "e1", line: 3, date: "2026-09-01", disponible: true }),
          entry({ id: "e2", line: 9, genre: "chiffre", tient: "e1", used: true }),
        ],
      })
    );
    expect(m).toContain("[e1] 2026-09-01 · d.md:3 · livraison (available)");
    expect(m).toContain("[e2] no date · d.md:9 · chiffre · fulfills e1  (already used)");
  });
});

describe("buildWriterSystemPrompt", () => {
  it("garde les trois premières règles du run C, mot pour mot", () => {
    const p = buildWriterSystemPrompt(ctx());
    expect(p).toContain("That is your only rule: build in public, for that reader.");
    expect(p).toContain("that first post is the origin");
    expect(p).toContain("Your first sentence is a hook and nothing else");
    expect(p).toContain("say what it is or what it does in the same breath");
  });

  it("remplace la quatrième par la règle de forme : la table, l'outil, pas les formes", () => {
    const p = buildWriterSystemPrompt(ctx());
    expect(p).toContain(genreToFormTable());
    expect(p).toContain(`read its form with ${READ_FORM_TOOL}`);
    expect(p).not.toContain("never to copy their shape");
    expect(p).not.toContain("Opens:");
  });

  it("ne porte PAS la phrase de porte d'entrée, rejetée au run D", () => {
    expect(buildWriterSystemPrompt(ctx())).not.toContain("A stranger can land on any one of your posts");
  });

  it("annonce la forme imposée quand il y en a une", () => {
    expect(buildWriterSystemPrompt(ctx({ lockedForm: "launch" }))).toContain("The form of this post is already set: launch.");
    expect(buildWriterSystemPrompt(ctx())).not.toContain("already set");
  });

  it("porte la règle de langue du profil et les règles du réseau", () => {
    expect(buildWriterSystemPrompt(ctx({ language: "fr" }))).toContain("Write the whole post in French");
    expect(buildWriterSystemPrompt(ctx({ language: "en" }))).toContain("Write the whole post in English");
    expect(buildWriterSystemPrompt(ctx({ platform: "x" }))).toContain(platformRuleText("x", { visualOnly: false }));
  });
});

describe("expectedForm", () => {
  const timeline = [entry({ id: "e1", genre: "échec" }), entry({ id: "e2", genre: "engagement" }), entry({ id: "e3", genre: "livraison", tient: "e2" })];

  it("rend origin au premier post, quelle que soit la forme du genre", () => {
    expect(expectedForm(ctx({ timeline }), ["e1"])).toBe("origin");
  });

  it("suit formFor ensuite, et tient décide où qu'il soit dans la liste", () => {
    const c = ctx({ timeline, posts: onePost });
    expect(expectedForm(c, ["e1"])).toBe("failure");
    expect(expectedForm(c, ["e2", "e3"])).toBe("promise_kept");
  });

  it("lockedForm gagne sur tout, et aucun événement connu ne donne rien à vérifier", () => {
    expect(expectedForm(ctx({ timeline, posts: onePost, lockedForm: "launch" }), ["e1"])).toBe("launch");
    expect(expectedForm(ctx({ timeline, posts: onePost }), ["inconnu"])).toBeNull();
  });
});

describe("writePost — le contrôle de publish_post", () => {
  const timeline = [entry({ id: "e1", genre: "échec" })];

  it("refuse une forme non lue, puis une forme qui ne colle pas, puis accepte", async () => {
    const outputs = drive([
      { name: "publish_post", input: { post: "Texte.", event_ids: ["e1"], form: "failure" } },
      { name: READ_FORM_TOOL, input: { form: "lesson" } },
      { name: "publish_post", input: { post: "Texte.", event_ids: ["e1"], form: "lesson" } },
      { name: READ_FORM_TOOL, input: { form: "failure" } },
      { name: "publish_post", input: { post: "Texte final.", event_ids: ["e1"], form: "failure" } },
    ]);
    const result = await writePost(ctx({ timeline, posts: onePost }));
    expect(outputs[0]).toMatchObject({ error: expect.stringContaining(READ_FORM_TOOL) });
    expect(outputs[2]).toMatchObject({ error: expect.stringContaining('"failure"') });
    expect(outputs[4]).toEqual({ ok: true });
    expect(result).toMatchObject({ handed: true, text: "Texte final.", form: "failure", eventIds: ["e1"] });
  });

  it("au premier post, seule origin passe", async () => {
    const outputs = drive([
      { name: READ_FORM_TOOL, input: { form: "failure" } },
      { name: "publish_post", input: { post: "T.", event_ids: ["e1"], form: "failure" } },
      { name: READ_FORM_TOOL, input: { form: "origin" } },
      { name: "publish_post", input: { post: "T.", event_ids: ["e1"], form: "origin" } },
    ]);
    const result = await writePost(ctx({ timeline }));
    expect(outputs[1]).toMatchObject({ error: expect.stringContaining("origin") });
    expect(result.form).toBe("origin");
  });

  it("lockedForm impose la forme", async () => {
    const outputs = drive([
      { name: READ_FORM_TOOL, input: { form: "failure" } },
      { name: "publish_post", input: { post: "T.", event_ids: ["e1"], form: "failure" } },
      { name: READ_FORM_TOOL, input: { form: "launch" } },
      { name: "publish_post", input: { post: "T.", event_ids: ["e1"], form: "launch" } },
    ]);
    const result = await writePost(ctx({ timeline, posts: onePost, lockedForm: "launch" }));
    expect(outputs[1]).toMatchObject({ error: expect.stringContaining("already set") });
    expect(result.form).toBe("launch");
  });

  it("sans remise acceptée, handed est faux et text est la réponse en prose", async () => {
    drive([{ name: "publish_post", input: { post: "T.", event_ids: ["e1"], form: "failure" } }]);
    const result = await writePost(ctx({ timeline, posts: onePost }));
    expect(result.handed).toBe(false);
    expect(result.text).toBe("done");
    expect(result.form).toBeNull();
  });
});
