import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured, callWebResearch } from "./provider";

/**
 * Agent de veille d'inspiration (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.2) : une recherche web, puis une
 * mise en fiches structurée. Jamais appelé pendant la rédaction d'un post. Un lien n'est gardé que
 * s'il figure parmi les pages réellement consultées par la recherche.
 */

export const INSPIRATION_KINDS = ["format", "accroche", "structure", "sujet", "compte"] as const;
export const MAX_INSPIRATIONS_PER_RESEARCH = 8;

// Annexe A.2, verbatim.
const RESEARCH_SYSTEM_PROMPT = `Tu fais de la veille pour le ghostwriter d'une personne qui construit quelque chose et le raconte sur les réseaux. Cherche sur le web ce qui fonctionne DÉJÀ auprès des publics décrits, sur les plateformes indiquées.

Ce que tu cherches :
- des exemples réels et précis : un post, un fil, un créateur, une newsletter, un devlog, un format nommé, qui marche visiblement auprès de ce public (réactions, reprises, communauté) ;
- ce qu'on peut en apprendre sur la FORME : le format, la structure, le type d'accroche, le rythme, les sujets qui reviennent.

Ce que tu écartes :
- les listes génériques (« 10 astuces pour percer sur LinkedIn »), le marketing de croissance, les conseils valables pour n'importe qui ;
- tout ce qui ne parle pas à ces publics précis.

Pour chaque trouvaille, donne le lien exact de la page consultée et, en une ou deux phrases, ce qu'on peut en apprendre pour écrire. Huit trouvailles au plus, les plus utiles d'abord. Écris en français.`;

// Annexe A.3, verbatim.
const STRUCTURE_SYSTEM_PROMPT = `Tu transformes un compte rendu de veille en fiches d'inspiration pour un ghostwriter. Une fiche par trouvaille utile, huit au plus. Recopie les liens tels qu'ils apparaissent dans le compte rendu, n'en invente aucun. Une fiche dit ce qu'on apprend sur la FORME, pas un fait à réutiliser.`;

const saveInspirationsTool: LlmToolDefinition = {
  name: "save_inspirations",
  description: "Enregistre les fiches d'inspiration tirées de la veille.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "Huit fiches au plus, les plus utiles d'abord.",
        items: {
          type: "object",
          properties: {
            url: { type: "string", description: "Le lien exact, recopié du compte rendu." },
            title: { type: "string", description: "Le titre de la page ou du post, court." },
            insight: {
              type: "string",
              description: "Ce qu'on y apprend pour écrire (format, structure, type d'accroche, rythme, sujet récurrent), en une ou deux phrases.",
            },
            kind: { type: "string", enum: [...INSPIRATION_KINDS], description: INSPIRATION_KINDS.join(" | ") },
            readerLabel: { type: "string", description: "Le public concerné, recopié parmi ceux donnés, ou chaîne vide." },
            platform: { type: "string", description: "La plateforme concernée (linkedin, x, instagram, newsletter, blog), ou chaîne vide." },
          },
          required: ["url", "title", "insight", "kind", "readerLabel", "platform"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

const foundSchema = z.object({
  items: z.array(
    z.object({
      url: z.string().trim(),
      title: z.string().trim(),
      insight: z.string().trim(),
      kind: z.enum(INSPIRATION_KINDS),
      readerLabel: z.string().trim(),
      platform: z.string().trim(),
    })
  ),
});

export interface FoundInspiration {
  url: string;
  title: string;
  insight: string;
  kind: (typeof INSPIRATION_KINDS)[number];
  readerLabel: string | null;
  platform: string | null;
}

export interface InspirationResearchContext {
  subjectName: string;
  subjectDescription: string | null;
  readers: Array<{ label: string; who: string; wants: string }>;
  /** Phrase « Pour qui » de repli quand il n'y a pas de portrait. */
  targetAudience: string | null;
  platforms: string[];
  existingUrls: string[];
  dismissed: Array<{ url: string; reason: string | null }>;
}

export function buildResearchMessage(ctx: InspirationResearchContext): string {
  const lines = [`Sujet : ${ctx.subjectName}${ctx.subjectDescription ? ` — ${ctx.subjectDescription}` : ""}`];
  if (ctx.readers.length > 0) {
    lines.push("Publics :", ...ctx.readers.map((r) => `- ${r.label} : ${r.who}.${r.wants ? ` Vient chercher : ${r.wants}.` : ""}`));
  } else {
    lines.push(ctx.targetAudience ? `Pour qui : ${ctx.targetAudience}` : "Public non défini : déduis-le du sujet.");
  }
  if (ctx.platforms.length > 0) lines.push(`Plateformes : ${ctx.platforms.join(", ")}`);
  if (ctx.existingUrls.length > 0) lines.push(`Déjà en fiche (ne les repropose pas) : ${ctx.existingUrls.join(" ; ")}`);
  if (ctx.dismissed.length > 0) {
    lines.push(
      `Déjà écartées, avec la raison (évite ce genre de trouvaille) : ${ctx.dismissed.map((d) => `${d.url} — ${d.reason ?? "sans raison"}`).join(" ; ")}`
    );
  }
  return lines.join("\n");
}

/** Lien comparable : sans protocole, « www. », ancre, paramètres de suivi ni barre finale. */
export function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    for (const key of [...parsed.searchParams.keys()]) if (key.startsWith("utm_")) parsed.searchParams.delete(key);
    const query = parsed.searchParams.toString();
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/+$/, "")}${query ? `?${query}` : ""}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/**
 * Garde les fiches dont le lien a vraiment été consulté, sans doublon ni lien déjà connu (actif ou
 * écarté). Le public et la plateforme hors liste deviennent null. Pur, pour être testé.
 */
export function filterFoundInspirations(
  items: z.infer<typeof foundSchema>["items"],
  options: { sources: string[]; knownUrls: string[]; readerLabels: string[]; platforms: string[] }
): FoundInspiration[] {
  const consulted = new Set(options.sources.map(normalizeUrl));
  const seen = new Set(options.knownUrls.map(normalizeUrl));
  const result: FoundInspiration[] = [];
  for (const item of items) {
    const key = normalizeUrl(item.url);
    if (!/^https?:\/\//i.test(item.url) || !consulted.has(key) || seen.has(key) || !item.insight || !item.title) continue;
    seen.add(key);
    result.push({
      url: item.url,
      title: item.title,
      insight: item.insight,
      kind: item.kind,
      readerLabel: options.readerLabels.includes(item.readerLabel) ? item.readerLabel : null,
      platform: options.platforms.includes(item.platform) ? item.platform : null,
    });
    if (result.length >= MAX_INSPIRATIONS_PER_RESEARCH) break;
  }
  return result;
}

export async function researchInspirations(ctx: InspirationResearchContext, knownPlatforms: string[]): Promise<FoundInspiration[]> {
  const research = await callWebResearch({ system: RESEARCH_SYSTEM_PROMPT, userMessage: buildResearchMessage(ctx), maxTokens: 4096 });
  if (!research.text.trim() || research.sources.length === 0) return [];
  const sourcesBlock = research.sources.map((s) => `- ${s.url}${s.title ? ` (${s.title})` : ""}`).join("\n");
  const args = await callStructured({
    system: STRUCTURE_SYSTEM_PROMPT,
    userMessage: `Publics donnés : ${ctx.readers.map((r) => r.label).join(", ") || "aucun"}\n\n=== COMPTE RENDU ===\n${research.text}\n\n=== PAGES CONSULTÉES ===\n${sourcesBlock}`,
    tool: saveInspirationsTool,
    maxTokens: 2048,
    strict: true,
  });
  return filterFoundInspirations(foundSchema.parse(args).items, {
    sources: research.sources.map((s) => s.url),
    knownUrls: [...ctx.existingUrls, ...ctx.dismissed.map((d) => d.url)],
    readerLabels: ctx.readers.map((r) => r.label),
    platforms: knownPlatforms,
  });
}
