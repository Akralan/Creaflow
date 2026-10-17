import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Profile extraction at onboarding (docs/SPEC_ONBOARDING_MVP.md §3 bis, §4): a single call
 * replaces the former chat. What the person does can be READ in their material; they only have to correct.
 *
 * Each connected source and each block of pasted notes carries a key (`source:<id>`, `note:<id>`)
 * that the model files into subjects: that's how the GitHub repo, the Notion database and the
 * Linear project of the same product end up on a single subject.
 */

export interface ProfileExtractionInput {
  name: string;
  /** Linked third-party accounts: name, login and GitHub bio already say a lot about who writes. */
  identities: Array<{ provider: string; login: string; name: string | null; bio: string | null }>;
  items: Array<{ key: string; kind: string; label: string; excerpt: string }>;
}

export const extractedSubjectSchema = z.object({
  name: z.string().min(1),
  description: z.string().default(""),
  // THIS project's "Who for" (docs/SPEC_PROMPT_GENERATION_V3.md §2.1): two projects by the same
  // author don't necessarily have the same audience.
  targetAudience: z.string().default(""),
  keys: z.array(z.string()).default([]),
});

export const extractedProfileSchema = z.object({
  activityType: z.string().default(""),
  targetAudience: z.string().default(""),
  subjects: z.array(extractedSubjectSchema).default([]),
});

export type ExtractedSubject = z.infer<typeof extractedSubjectSchema>;
export type ExtractedProfile = z.infer<typeof extractedProfileSchema>;

const TOOL_NAME = "describe_author";

const describeAuthorTool: LlmToolDefinition = {
  name: TOOL_NAME,
  description: "Describes what the author does and groups their sources by project, from their material. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      activityType: {
        type: "string",
        description:
          "What the author does, in the second person, in one or two concrete sentences (\"You build X, a tool that…\"). Only what the material shows.",
      },
      targetAudience: {
        type: "string",
        description: "Who they build for, in one sentence: the people their work serves. Empty if the material doesn't allow saying.",
      },
      subjects: {
        type: "array",
        description:
          "The author's projects. A project groups ALL the sources that talk about it, even seen from different angles (the code on GitHub, the thinking in Notion, the tasks in Linear). A source that overlaps with nothing forms a project on its own.",
        items: {
          type: "object",
          properties: {
            name: { type: "string", description: "Name of the project, short, as the author would call it." },
            description: { type: "string", description: "What the project is, in one sentence." },
            targetAudience: {
              type: "string",
              description: "Who THIS project is for, in one sentence: the people it serves. Empty if the material doesn't allow saying.",
            },
            keys: {
              type: "array",
              description: "Keys of the sources and notes that talk about this project, copied as is. Each key in a single project.",
              items: { type: "string" },
            },
          },
          required: ["name", "description", "targetAudience", "keys"],
        },
      },
    },
    required: ["activityType", "targetAudience", "subjects"],
  },
};

const SYSTEM_PROMPT = `You read a person's working material (code repositories, Notion pages, Linear projects, notes) to understand what they do, before they start publishing about what they build.

Rules:
- Invent nothing: describe only what the material shows. A simple, accurate sentence beats a brilliant, false one.
- Write in English, in the second person ("you"), without marketing jargon.
- Group into one project the sources that talk about the same product, even if they come from different tools: it's the crossing of code, thinking and tasks that will make good posts.
- At most 5 projects. If there are more sources, group the closest ones.
- Two projects by the same author don't necessarily have the same audience: give each its own.
- All the supplied keys must appear, each in a single project. Notes go in the project they talk about.`;

export function buildExtractionMessage(input: ProfileExtractionInput): string {
  const lines: string[] = [`Name: ${input.name || "(not provided)"}`];
  for (const identity of input.identities) {
    const parts = [`${identity.provider} account: ${identity.login}`];
    if (identity.name) parts.push(`display name "${identity.name}"`);
    if (identity.bio) parts.push(`bio "${identity.bio}"`);
    lines.push(parts.join(", "));
  }
  lines.push("", "=== SOURCES ===");
  for (const item of input.items) {
    lines.push(`--- [${item.key}] ${item.kind} · ${item.label} ---`, item.excerpt || "(empty)", "");
  }
  return lines.join("\n");
}

/**
 * Straightens out the model's response: unknown keys dropped, each key in a single subject, and
 * any forgotten key filed somewhere — a source must never vanish from the screen because the
 * model omitted it. A forgotten note joins the first subject; a forgotten source forms its own.
 */
export function normalizeSubjects(
  subjects: ExtractedSubject[],
  items: Array<{ key: string; label: string }>
): ExtractedSubject[] {
  const known = new Set(items.map((item) => item.key));
  const placed = new Set<string>();
  const result: ExtractedSubject[] = [];
  for (const subject of subjects) {
    const keys = subject.keys.filter((key) => known.has(key) && !placed.has(key));
    keys.forEach((key) => placed.add(key));
    if (keys.length > 0)
      result.push({ name: subject.name.trim(), description: subject.description.trim(), targetAudience: subject.targetAudience.trim(), keys });
  }
  for (const item of items) {
    if (placed.has(item.key)) continue;
    if (item.key.startsWith("note:") && result.length > 0) {
      result[0].keys.push(item.key);
    } else {
      result.push({ name: item.label, description: "", targetAudience: "", keys: [item.key] });
    }
    placed.add(item.key);
  }
  return result;
}

export async function extractProfileFromMaterial(input: ProfileExtractionInput): Promise<ExtractedProfile> {
  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: buildExtractionMessage(input),
    tool: describeAuthorTool,
    maxTokens: 1500,
  });
  const parsed = extractedProfileSchema.parse(args);
  return {
    activityType: parsed.activityType.trim(),
    targetAudience: parsed.targetAudience.trim(),
    subjects: normalizeSubjects(parsed.subjects, input.items),
  };
}
