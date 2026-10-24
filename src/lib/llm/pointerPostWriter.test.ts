import { describe, expect, it } from "vitest";

import {
  MAX_WINDOW_LINES,
  buildWriterSystemPrompt,
  runWriterTool,
  splitHookAndCaption,
  type WriterContext,
} from "./pointerPostWriter";
import { platformRuleText } from "./platformRules";

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

describe("splitHookAndCaption", () => {
  it("prend la première ligne comme accroche et le reste comme caption", () => {
    expect(splitHookAndCaption("Accroche.\n\nSuite du post.")).toEqual({
      hookText: "Accroche.",
      caption: "Suite du post.",
    });
  });

  it("garde les paragraphes suivants dans la caption", () => {
    const { caption } = splitHookAndCaption("Accroche.\n\nUn.\n\nDeux.");
    expect(caption).toBe("Un.\n\nDeux.");
  });

  it("rend une caption non vide pour un post d'une seule phrase", () => {
    const { hookText, caption } = splitHookAndCaption("Une seule phrase.");
    expect(hookText).toBe("Une seule phrase.");
    expect(caption).toBe("Une seule phrase.");
  });
});

describe("runWriterTool read_file", () => {
  it("ramène une fenêtre hors bornes dans le document", () => {
    const r = runWriterTool(ctx(), { name: "read_file", input: { file: "d.md", from_line: 0, to_line: 99 } });
    expect(r).toMatchObject({ from_line: 1, to_line: 3 });
  });

  it("plafonne la fenêtre à MAX_WINDOW_LINES", () => {
    const big = ctx({ files: new Map([["d.md", Array.from({ length: 500 }, (_, i) => `l${i}`)]]) });
    const r = runWriterTool(big, { name: "read_file", input: { file: "d.md", from_line: 1, to_line: 500 } });
    expect(r).toMatchObject({ to_line: MAX_WINDOW_LINES });
  });

  it("rend une erreur nommée pour un document inconnu", () => {
    const r = runWriterTool(ctx(), { name: "read_file", input: { file: "absent.md", from_line: 1, to_line: 2 } });
    expect(r).toMatchObject({ error: expect.stringContaining("absent.md") });
  });
});

describe("buildWriterSystemPrompt", () => {
  it("porte les quatre règles arrêtées au run C", () => {
    const p = buildWriterSystemPrompt(ctx());
    expect(p).toContain("That is your only rule: build in public, for that reader.");
    expect(p).toContain("that first post is the origin");
    expect(p).toContain("Your first sentence is a hook and nothing else");
    expect(p).toContain("no post of yours is allowed to be dead");
    expect(p).toContain("never to copy their shape");
  });

  it("ne porte PAS la phrase de porte d'entrée, rejetée au run D", () => {
    expect(buildWriterSystemPrompt(ctx())).not.toContain("A stranger can land on any one of your posts");
  });

  it("porte la règle de langue du profil", () => {
    expect(buildWriterSystemPrompt(ctx({ language: "fr" }))).toContain("Write the whole post in French");
    expect(buildWriterSystemPrompt(ctx({ language: "en" }))).toContain("Write the whole post in English");
  });

  it("porte les règles du réseau visé", () => {
    expect(buildWriterSystemPrompt(ctx({ platform: "x" }))).toContain(platformRuleText("x", { visualOnly: false }));
  });
});
