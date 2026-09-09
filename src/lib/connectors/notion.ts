import {
  listBlockChildren,
  searchSharedObjects,
  NotionAuthError,
  type NotionBlock,
} from "@/lib/notion/client";
import { getValidProviderAccessToken } from "@/lib/services/oauthAccountService";
import { MAX_NOTION_BLOCKS, MAX_NOTION_DEPTH } from "@/lib/validation";
import { blocksToText, toCandidate, type NotionCandidateMeta } from "./notionMapping";
import type { FetchedDocuments, IncomingDoc, MaterialSourceRow, SourceConnector } from "./types";

const getToken = (userId: string) => getValidProviderAccessToken(userId, "notion");

interface Collected {
  /** Un document par page : la racine, puis chaque sous-page. Découper ainsi plutôt qu'en un seul
   *  bloc géant donne au corpus des unités citables, et rend le re-sync incrémental — une sous-page
   *  modifiée ne réécrit pas tout le reste. */
  docs: IncomingDoc[];
  truncated: boolean;
}

async function readPage(
  token: string,
  pageId: string,
  title: string,
  depth: number,
  budget: { remaining: number }
): Promise<Collected> {
  const blocks: NotionBlock[] = [];
  const children: Array<{ id: string; title: string }> = [];
  let truncated = false;
  let cursor: string | undefined;

  do {
    const page = await listBlockChildren(token, pageId, cursor);
    for (const block of page.blocks) {
      if (budget.remaining <= 0) {
        truncated = true;
        break;
      }
      budget.remaining -= 1;
      blocks.push(block);
      if (block.type === "child_page") {
        const payload = (block.raw as Record<string, unknown>).child_page as { title?: string } | undefined;
        children.push({ id: block.id, title: payload?.title ?? "Sans titre" });
      }
    }
    cursor = truncated ? undefined : (page.nextCursor ?? undefined);
  } while (cursor);

  const docs: IncomingDoc[] = [];
  const rawText = blocksToText(blocks);
  if (rawText) {
    docs.push({
      externalRef: pageId,
      // Le contenu lui-même sert d'empreinte. `last_edited_time` d'une page ne bouge pas quand une
      // SOUS-page change, ce qui laisserait passer des modifications ; un hachage du texte, lui,
      // rend le re-sync exact.
      externalChecksum: hash(rawText),
      title,
      rawText,
    });
  }

  if (depth < MAX_NOTION_DEPTH) {
    for (const child of children) {
      if (budget.remaining <= 0) {
        truncated = true;
        break;
      }
      const sub = await readPage(token, child.id, `${title} › ${child.title}`, depth + 1, budget);
      docs.push(...sub.docs);
      truncated = truncated || sub.truncated;
    }
  }

  return { docs, truncated };
}

/** Empreinte stable et courte du contenu — suffit à décider « inchangé / à mettre à jour ». */
function hash(text: string): string {
  let h = 0;
  for (let i = 0; i < text.length; i += 1) {
    h = (Math.imul(31, h) + text.charCodeAt(i)) | 0;
  }
  return `${text.length}-${(h >>> 0).toString(16)}`;
}

export const notionConnector: SourceConnector<NotionCandidateMeta> = {
  type: "notion_page",
  displayName: "Notion",

  emptyMessage: "Cette page Notion ne contient aucun texte exploitable.",
  truncatedMessage: "Page volumineuse : seule une partie du contenu Notion a été ingérée.",

  isAuthError: (error) => error instanceof NotionAuthError,

  candidateHint: (meta) => {
    const kind = meta.objectType === "data_source" ? "base de données" : "page";
    const edited = meta.lastEditedTime ? `modifiée le ${meta.lastEditedTime.slice(0, 10)}` : null;
    return [kind, edited].filter(Boolean).join(" · ");
  },

  picker: {
    emptyMessage:
      "Aucune page Notion partagée avec CreaFlow. Dans Notion, ouvre la page voulue, puis « Partager » et invite l'intégration CreaFlow — elle ne voit que ce que tu lui partages.",
    footnote: "On récupère le texte de la page et de ses sous-pages.",
  },

  async assertReady(userId) {
    await getToken(userId);
  },

  async listCandidates(userId) {
    const token = await getToken(userId);
    const objects = await searchSharedObjects(token);
    // Seules les racines deviennent des sujets : une sous-page fait partie de la matière de sa
    // racine, la proposer séparément dupliquerait le corpus (SPEC_CONNECTEURS_ET_SUJETS.md §4).
    return objects.filter((object) => object.isRoot).map(toCandidate);
  },

  async fetchDocuments(userId, source: MaterialSourceRow): Promise<FetchedDocuments> {
    const token = await getToken(userId);
    const budget = { remaining: MAX_NOTION_BLOCKS };
    const { docs, truncated } = await readPage(token, source.externalId, source.label, 0, budget);
    // Pas de curseur : Notion ne donne pas de position de lecture réutilisable, et le diff par
    // empreinte suffit à rendre le re-sync idempotent.
    return { docs, cursor: null, truncated };
  },
};
