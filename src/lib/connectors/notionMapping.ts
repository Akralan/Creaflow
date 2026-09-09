import type { NotionBlock, NotionSearchResult } from "@/lib/notion/client";
import type { ConnectorCandidate } from "./types";

/**
 * Traductions Notion ↔ cœur, pures et testées à part — même découpage que `githubMapping.ts`.
 * Rien ici ne fait d'appel réseau : c'est ce qui rend le rendu des blocs vérifiable sans clé d'API.
 */

// Alias de type et non interface : seul un alias porte la signature d'index implicite qui rend
// `ConnectorCandidate<Meta>` assignable au `Record<string, unknown>` du registre.
export type NotionCandidateMeta = {
  objectType: "page" | "data_source";
  lastEditedTime: string;
};

export function toCandidate(result: NotionSearchResult): ConnectorCandidate<NotionCandidateMeta> {
  return {
    externalId: result.id,
    label: result.title,
    subjectName: result.title,
    // Notion ne donne pas de description courte : la laisser vide plutôt qu'inventer un résumé.
    // Le corpus ingéré derrière dit déjà de quoi la page parle.
    subjectDescription: null,
    config: { objectType: result.objectType },
    meta: { objectType: result.objectType, lastEditedTime: result.lastEditedTime },
  };
}

/** Texte d'un tableau de rich text, quel que soit le type de bloc qui le porte. */
function richText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => (typeof item === "object" && item !== null ? String((item as { plain_text?: string }).plain_text ?? "") : ""))
    .join("")
    .trim();
}

/** Préfixes rendant la STRUCTURE lisible au modèle : un titre de section et un élément de liste ne
 *  se valent pas comme matière, et le markdown est le format que le reste du corpus utilise déjà. */
const PREFIXES: Record<string, string> = {
  heading_1: "# ",
  heading_2: "## ",
  heading_3: "### ",
  heading_4: "#### ",
  bulleted_list_item: "- ",
  numbered_list_item: "- ",
  quote: "> ",
  to_do: "- ",
};

/**
 * Un bloc Notion en une ligne de texte, ou null si le bloc n'apporte rien.
 *
 * Les blocs média (image, vidéo, fichier) sont volontairement ignorés : leur URL n'est pas de la
 * matière rédactionnelle, et une URL signée Notion expire de toute façon.
 */
export function blockToText(block: NotionBlock): string | null {
  const payload = (block.raw as Record<string, unknown>)[block.type];
  if (typeof payload !== "object" || payload === null) return null;

  const content = richText((payload as { rich_text?: unknown }).rich_text);
  if (!content) {
    // Une sous-page n'a pas de rich_text : son titre est porté par `title`, et son contenu sera lu
    // séparément par la descente récursive.
    if (block.type === "child_page") {
      const title = String((payload as { title?: unknown }).title ?? "").trim();
      return title ? `## ${title}` : null;
    }
    return null;
  }

  if (block.type === "code") {
    const language = String((payload as { language?: unknown }).language ?? "");
    return `\`\`\`${language}\n${content}\n\`\`\``;
  }

  if (block.type === "to_do") {
    const checked = Boolean((payload as { checked?: unknown }).checked);
    return `- [${checked ? "x" : " "}] ${content}`;
  }

  return `${PREFIXES[block.type] ?? ""}${content}`;
}

/** Rendu d'une suite de blocs. Les lignes vides consécutives sont écrasées : une page Notion en est
 *  pleine, et elles ne portent aucune information. */
export function blocksToText(blocks: NotionBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    const text = blockToText(block);
    if (text) lines.push(text);
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
