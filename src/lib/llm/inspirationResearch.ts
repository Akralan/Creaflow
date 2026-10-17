import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured, callWebResearch } from "./provider";

/**
 * Inspiration-watch agent (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.2): a web search, then a structured
 * write-up into cards. Never called while a post is being written. A link is only kept if it
 * appears among the pages actually consulted by the search.
 */

export const INSPIRATION_KINDS = ["format", "accroche", "structure", "sujet", "compte"] as const;
export const MAX_INSPIRATIONS_PER_RESEARCH = 8;

// Annex A.2.
const RESEARCH_SYSTEM_PROMPT = `You do monitoring for the ghostwriter of a person who builds something and talks about it on social media. Search the web for what ALREADY works with the described audiences, on the platforms indicated.

What you look for:
- real, precise examples: a post, a thread, a creator, a newsletter, a devlog, a named format, that visibly works with this audience (reactions, reshares, community);
- what can be learned from them about FORM: the format, the structure, the type of hook, the rhythm, the recurring topics.

What you discard:
- generic lists ("10 tips to break through on LinkedIn"), growth marketing, advice valid for anyone;
- anything that doesn't speak to these specific audiences.

For each finding, give the exact link of the page consulted and, in one or two sentences, what can be learned from it for writing. Eight findings at most, the most useful first. Write in English.`;

// Annex A.3.
const STRUCTURE_SYSTEM_PROMPT = `You turn a monitoring report into inspiration cards for a ghostwriter. One card per useful finding, eight at most. Copy the links exactly as they appear in the report, invent none. A card says what is learned about FORM, not a fact to reuse. Write the cards in English.`;

const saveInspirationsTool: LlmToolDefinition = {
  name: "save_inspirations",
  description: "Saves the inspiration cards drawn from the monitoring.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "Eight cards at most, the most useful first.",
        items: {
          type: "object",
          properties: {
            url: { type: "string", description: "The exact link, copied from the report." },
            title: { type: "string", description: "The title of the page or post, short." },
            insight: {
              type: "string",
              description: "What is learned from it for writing (format, structure, hook type, rhythm, recurring topic), in one or two sentences. In English.",
            },
            kind: { type: "string", enum: [...INSPIRATION_KINDS], description: INSPIRATION_KINDS.join(" | ") },
            readerLabel: { type: "string", description: "The audience concerned, copied from those given, or empty string." },
            platform: { type: "string", description: "The platform concerned (linkedin, x, instagram, newsletter, blog), or empty string." },
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
  /** Fallback "Who for" sentence when there is no portrait. */
  targetAudience: string | null;
  platforms: string[];
  existingUrls: string[];
  dismissed: Array<{ url: string; reason: string | null }>;
}

export function buildResearchMessage(ctx: InspirationResearchContext): string {
  const lines = [`Subject: ${ctx.subjectName}${ctx.subjectDescription ? ` — ${ctx.subjectDescription}` : ""}`];
  if (ctx.readers.length > 0) {
    lines.push("Audiences:", ...ctx.readers.map((r) => `- ${r.label}: ${r.who}.${r.wants ? ` Comes looking for: ${r.wants}.` : ""}`));
  } else {
    lines.push(ctx.targetAudience ? `Who for: ${ctx.targetAudience}` : "Audience not defined: infer it from the subject.");
  }
  if (ctx.platforms.length > 0) lines.push(`Platforms: ${ctx.platforms.join(", ")}`);
  if (ctx.existingUrls.length > 0) lines.push(`Already carded (don't propose them again): ${ctx.existingUrls.join("; ")}`);
  if (ctx.dismissed.length > 0) {
    lines.push(
      `Already dismissed, with the reason (avoid this kind of finding): ${ctx.dismissed.map((d) => `${d.url} — ${d.reason ?? "no reason"}`).join("; ")}`
    );
  }
  return lines.join("\n");
}

/** Comparable link: without protocol, "www.", anchor, tracking parameters or trailing slash. */
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
 * Keeps the cards whose link was really consulted, without duplicates or already-known links (active
 * or dismissed). Audience and platform outside the list become null. Pure, to be testable.
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
    userMessage: `Audiences given: ${ctx.readers.map((r) => r.label).join(", ") || "none"}\n\n=== REPORT ===\n${research.text}\n\n=== PAGES CONSULTED ===\n${sourcesBlock}`,
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
