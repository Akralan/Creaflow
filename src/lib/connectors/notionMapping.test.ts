import { describe, expect, it } from "vitest";
import { blockToText, blocksToText, toCandidate } from "./notionMapping";
import type { NotionBlock } from "@/lib/notion/client";

function block(type: string, payload: Record<string, unknown>, id = "b1"): NotionBlock {
  return { id, type, hasChildren: false, raw: { id, type, [type]: payload } };
}

const rich = (text: string) => [{ plain_text: text }];

describe("blockToText", () => {
  it("rend un paragraphe tel quel", () => {
    expect(blockToText(block("paragraph", { rich_text: rich("Une phrase.") }))).toBe("Une phrase.");
  });

  it("préfixe les titres et les listes pour garder la structure lisible", () => {
    expect(blockToText(block("heading_2", { rich_text: rich("Section") }))).toBe("## Section");
    expect(blockToText(block("bulleted_list_item", { rich_text: rich("Point") }))).toBe("- Point");
    expect(blockToText(block("quote", { rich_text: rich("Cité") }))).toBe("> Cité");
  });

  it("marque l'état d'une case à cocher", () => {
    expect(blockToText(block("to_do", { rich_text: rich("Fait"), checked: true }))).toBe("- [x] Fait");
    expect(blockToText(block("to_do", { rich_text: rich("À faire"), checked: false }))).toBe("- [ ] À faire");
  });

  it("entoure le code de sa clôture, avec son langage", () => {
    expect(blockToText(block("code", { rich_text: rich("const a = 1;"), language: "typescript" }))).toBe(
      "```typescript\nconst a = 1;\n```"
    );
  });

  it("rend le titre d'une sous-page, dont le contenu est lu séparément", () => {
    expect(blockToText(block("child_page", { title: "Journal" }))).toBe("## Journal");
  });

  it("ignore un bloc vide et un bloc média — une URL signée n'est pas de la matière", () => {
    expect(blockToText(block("paragraph", { rich_text: [] }))).toBeNull();
    expect(blockToText(block("image", { file: { url: "https://exemple/x.png" } }))).toBeNull();
    expect(blockToText(block("divider", {}))).toBeNull();
  });
});

describe("blocksToText", () => {
  it("assemble les blocs et écrase les lignes vides consécutives", () => {
    const text = blocksToText([
      block("heading_1", { rich_text: rich("Titre") }, "b1"),
      block("divider", {}, "b2"),
      block("paragraph", { rich_text: rich("Corps") }, "b3"),
    ]);
    expect(text).toBe("# Titre\nCorps");
  });

  it("rend une chaîne vide quand rien n'est exploitable — c'est ce qui déclenche emptyMessage", () => {
    expect(blocksToText([block("image", {}, "b1")])).toBe("");
  });
});

describe("toCandidate", () => {
  it("reprend le titre comme nom de sujet et n'invente pas de description", () => {
    const candidate = toCandidate({
      id: "page-1",
      objectType: "page",
      title: "Produit",
      lastEditedTime: "2026-09-01T10:00:00.000Z",
      isRoot: true,
    });
    expect(candidate).toEqual({
      externalId: "page-1",
      label: "Produit",
      subjectName: "Produit",
      subjectDescription: null,
      config: { objectType: "page" },
      meta: { objectType: "page", lastEditedTime: "2026-09-01T10:00:00.000Z" },
    });
  });
});
