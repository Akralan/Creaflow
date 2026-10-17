import { z } from "zod";
import type { AgenticToolCall, LlmToolDefinition } from "./types";
import { callAgentic } from "./provider";
import { KNOWN_PLATFORMS, platformLabel } from "@/lib/social/types";
import { publishingDaysSchema } from "@/lib/validation";
import { publishingDaysLabel } from "@/lib/services/calendarService";
import { rhythmLabel, type SeriesRhythm } from "@/lib/seriesRhythm";

export interface AssistantMessage {
  role: "user" | "assistant";
  content: string;
}

const proposalActionSchema = z.enum(["create", "update"]);
const KNOWN_PLATFORM_KEYS = KNOWN_PLATFORMS.map((p) => p.key);

export const productProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  valueProposition: z.string().optional(),
  // Per-subject audience override (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — distinct from the brand
  // audience carried by profileProposals. The system prompt already referred to it explicitly while
  // the field didn't exist here: the assistant was directed to an action it couldn't emit
  // (docs/SPEC_ASSISTANT_AGENTIQUE.md §6.1).
  targetAudience: z.string().optional(),
});
export type ProductProposal = z.infer<typeof productProposalSchema>;

export const seriesProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  // Rhythm (docs/SPEC_RYTHME_DES_SERIES.md §6): the days the series publishes, and whether every
  // other week. Optional here: absent = rhythm unchanged on an update.
  rhythmDays: z.array(z.number().int().min(1).max(7)).min(1).max(7).optional(),
  everyOtherWeek: z.boolean().optional(),
  // A single role per series (docs/SPEC_SERIES_ET_ROLES.md §1).
  categoryLabel: z.string().min(1),
  platforms: z.array(z.string()),
  // docs/SPEC_REDACTEUR_EN_CHEF.md §4.5 — same typology as seriesLabels.ts.
  // Subject the series draws its material from — `undefined` leaves the attachment unchanged (never
  // an implicit detachment: it would empty the writer's material source without saying so).
  productId: z.string().optional(),
});
export type SeriesProposal = z.infer<typeof seriesProposalSchema>;

export const categoryProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(5).max(90),
  platforms: z.array(z.string()),
  // Material × category routing (docs/SPEC_MATIERE_EDITEUR.md §5.3) — `undefined` keeps the
  // role's current value (see resolveProposal).
  materialHungry: z.boolean().optional(),
});
export type CategoryProposal = z.infer<typeof categoryProposalSchema>;

export const angleProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
});
export type AngleProposal = z.infer<typeof angleProposalSchema>;

// A platform is active (one post per publishing day) or switched off: the number of posts per
// week is no longer set (docs/SPEC_ONBOARDING_MVP.md §1).
export const postingGoalProposalSchema = z.object({
  platform: z.string().min(1),
  active: z.boolean(),
});
export type PostingGoalProposal = z.infer<typeof postingGoalProposalSchema>;

// Brand audience (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — a single possible target (the user's
// CreatorProfile), no create/update action nor targetId like the others: capped at 1 element
// rather than 5 (see assistantChatResultSchema).
export const profileProposalSchema = z.object({
  targetAudience: z.string().min(1),
});
export type ProfileProposal = z.infer<typeof profileProposalSchema>;

/** Payload of the proposal tool. The conversational reply is no longer part of it: in the agentic
 *  loop, the model's free text carries it (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.2). */
/** Raw material proposed from the conversation (docs/SPEC_ASSISTANT_AGENTIQUE.md §5).
 *  The assistant never creates material itself: the SourceMaterial is born on acceptance.
 *  `text` carries the conversational extraction; `attachmentId` designates a file dropped in the
 *  thread, of which the assistant only knows the name — never the content. */
export const materialProposalSchema = z
  .object({
    action: z.enum(["create", "update", "delete"]),
    materialId: z.string().optional(),
    productId: z.string().optional(),
    title: z.string().optional(),
    text: z.string().optional(),
    attachmentId: z.string().optional(),
  })
  .refine((p) => p.action === "create" || !!p.materialId, {
    message: "materialId is required to edit or delete a document.",
  })
  .refine((p) => p.action !== "create" || !!p.text || !!p.attachmentId, {
    message: "A material creation must carry either text or an uploaded file.",
  });
export type MaterialProposal = z.infer<typeof materialProposalSchema>;

/** Archiving — never deletion (docs/SPEC_SERIES_ET_ROLES.md §7: an archived object remains
 *  referenced by scripts and slots already produced). */
export const archiveProposalSchema = z.object({
  kind: z.enum(["series", "category", "angle"]),
  targetId: z.string().min(1),
  reason: z.string().optional(),
});
export type ArchiveProposal = z.infer<typeof archiveProposalSchema>;

/** Publishing days (docs/SPEC_ONBOARDING_MVP.md §5) — the full up-to-date list, not a delta. */
export const publishingDaysProposalSchema = z.object({
  publishingDays: publishingDaysSchema,
});
export type PublishingDaysProposal = z.infer<typeof publishingDaysProposalSchema>;

export const assistantChatResultSchema = z.object({
  productProposals: z.array(productProposalSchema).max(5),
  seriesProposals: z.array(seriesProposalSchema).max(5),
  categoryProposals: z.array(categoryProposalSchema).max(5),
  angleProposals: z.array(angleProposalSchema).max(5),
  postingGoalProposals: z.array(postingGoalProposalSchema).max(5),
  profileProposals: z.array(profileProposalSchema).max(1),
});
export type AssistantChatResult = z.infer<typeof assistantChatResultSchema>;

const ASSISTANT_CHAT_TOOL_NAME = "propose_changes";
const MATERIAL_TOOL_NAME = "propose_material";
const ARCHIVE_TOOL_NAME = "propose_archive";
const PUBLISHING_DAYS_TOOL_NAME = "propose_publishing_days";

/** Separate tools rather than more arrays in propose_changes: in the agentic loop, a targeted
 *  tool can be called without having to fill in six empty arrays. */
function buildMaterialTool(context: { productIds: string[]; attachmentIds: string[] }): LlmToolDefinition {
  return {
    name: MATERIAL_TOOL_NAME,
    description:
      "Proposes adding, editing or removing a raw material document. Use when the user tells usable information (news, anecdote, number, decision, lesson learned) worth keeping to feed their future content, or when they dropped a file in the conversation. Nothing is saved before their validation.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "delete"],
          description: "'create' for a new document, 'update' to correct an existing document, 'delete' to remove one.",
        },
        materialId: {
          type: "string",
          description: "EXACT id of an existing document, obtained via list_materials — required for 'update' and 'delete'.",
        },
        productId: enumField(
          context.productIds,
          "EXACT id of the subject to attach this material to. Omit it ONLY if the material concerns the brand in general and no specific subject — if in doubt, ask the user rather than guess."
        ),
        title: { type: "string", description: "Short, descriptive title of the document." },
        text: {
          type: "string",
          description:
            "The content, reported faithfully from what the user said — add no fact they didn't give, don't embellish. Leave empty if the material comes from an uploaded file (attachmentId).",
        },
        attachmentId: enumField(
          context.attachmentIds,
          "EXACT id of a file dropped by the user in the conversation. You only know its name: never claim to know what it contains."
        ),
      },
      required: ["action"],
    },
  };
}

function buildArchiveTool(context: { seriesIds: string[]; categoryIds: string[]; angleIds: string[] }): LlmToolDefinition {
  return {
    name: ARCHIVE_TOOL_NAME,
    description:
      "Proposes archiving a series, an editorial role or an angle that has become useless. Archiving erases nothing: scripts and slots already produced keep it. Reserved for a clear user request.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["series", "category", "angle"], description: "Kind of the item to archive." },
        targetId: enumField(
          [...context.seriesIds, ...context.categoryIds, ...context.angleIds],
          "EXACT id of the item to archive, consistent with 'kind'."
        ),
        reason: { type: "string", description: "In one sentence, why this item no longer has a reason to exist." },
      },
      required: ["kind", "targetId"],
    },
  };
}

function buildPublishingDaysTool(): LlmToolDefinition {
  return {
    name: PUBLISHING_DAYS_TOOL_NAME,
    description:
      "Proposes changing the days the creator can publish. They don't place the posts: the series' rhythms do that. They serve to propose the days of a new series. Reserved for a clear user request. Nothing is applied before their validation.",
    input_schema: {
      type: "object",
      properties: {
        publishingDays: {
          type: "array",
          description:
            "COMPLETE list of the days the creator can publish after the change (not only those to add), in ISO format: 1 = Monday, 2 = Tuesday, 3 = Wednesday, 4 = Thursday, 5 = Friday, 6 = Saturday, 7 = Sunday. At least one day.",
          items: { type: "integer", minimum: 1, maximum: 7 },
          minItems: 1,
          maxItems: 7,
        },
      },
      required: ["publishingDays"],
    },
  };
}

/** `enum` on a value supposed to match exactly an existing value — omitted when the list is
 *  empty, an `enum: []` would reject any value. */
function enumField(values: string[], description: string) {
  return values.length > 0 ? { type: "string", description, enum: values } : { type: "string", description };
}

function buildAssistantTool(context: {
  productIds: string[];
  seriesIds: string[];
  categoryIds: string[];
  categoryLabels: string[];
  angleIds: string[];
  platformKeys: string[];
}): LlmToolDefinition {
  const productIdField = enumField(
    context.productIds,
    "EXACT id of the subject the series draws its material from. Omit this field if no specific subject applies, or to leave an existing series' attachment unchanged."
  );

  const platformsField = {
    type: "array",
    description:
      "Relevant networks, to deduce from the conversation context. EMPTY array if no clear signal (= all networks, default behavior) — only restrict with a good reason expressed by the user. For an update, restate the current platforms unless a change is explicitly requested.",
    items: enumField(context.platformKeys, "Known platform key (from the registry)."),
  };

  return {
    name: ASSISTANT_CHAT_TOOL_NAME,
    description:
      "Records creation or modification proposals (subjects, series, editorial roles, angles, active or switched-off platforms, brand audience) that the user will validate, edit or refuse. Applies nothing directly. ONLY call this tool if you really have something to propose, and address the user in your text reply, not here.",
    input_schema: {
      type: "object",
      properties: {
        productProposals: {
          type: "array",
          description:
            "0 to 5 proposals to create/modify a product. Most turns propose none — only when the user gave enough info about a new or existing product.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' for a new product, 'update' to modify an existing product." },
              targetId: enumField(context.productIds, "EXACT id of the existing product to modify — only if action='update'."),
              name: { type: "string", description: "Product name (full up-to-date value, even for a partial change)." },
              description: { type: "string", description: "Product description." },
              valueProposition: { type: "string", description: "Product value proposition." },
              targetAudience: {
                type: "string",
                description:
                  "Audience specific to THIS subject, when it differs from the brand audience (e.g. the audience of a technical project ≠ that of a shop). Omit this field if nothing distinguishes it — the subject then falls back on the brand audience.",
              },
            },
            required: ["action", "name"],
          },
        },
        seriesProposals: {
          type: "array",
          description:
            "0 to 5 proposals to create/modify a recurring series ('direction'). Most turns propose none.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' for a new series, 'update' to modify an existing series." },
              targetId: enumField(context.seriesIds, "EXACT id of the existing series to modify — only if action='update'."),
              label: { type: "string", description: "Short, memorable name of the series." },
              description: { type: "string", description: "Identity of the series: angle, tone, structure to respect." },
              rhythmDays: {
                type: "array",
                items: { type: "integer", enum: [1, 2, 3, 4, 5, 6, 7] },
                description:
                  "Days the series publishes (1 = Monday … 7 = Sunday). Two series can share a day. For an update, restate the current days unless a change is requested.",
              },
              everyOtherWeek: { type: "boolean", description: "True if the series only publishes every other week." },
              categoryLabel: enumField(
                context.categoryLabels,
                "Exact label of the (single) editorial role this series serves. If in doubt between two roles, propose two series."
              ),
              platforms: platformsField,
              productId: productIdField,
            },
            required: ["action", "label", "description", "rhythmDays", "everyOtherWeek", "categoryLabel", "platforms"],
          },
        },
        categoryProposals: {
          type: "array",
          description:
            "0 to 5 proposals to create/modify an editorial role ('category' on the data side). RARE: only on explicit user request or to rebalance a mix — most requests translate into a series, not a role.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' for a new role, 'update' to modify an existing role." },
              targetId: enumField(context.categoryIds, "EXACT id of the existing role to modify — only if action='update'."),
              label: { type: "string", description: "Short label of the role." },
              description: { type: "string", description: "Editorial instruction of the role." },
              weight: {
                type: "integer",
                description:
                  "Weight of THIS role only (5 to 90, approximate % of slots). NEVER propose the weight of other roles — they will be readjusted automatically to keep summing to 100%.",
              },
              platforms: platformsField,
              materialHungry: {
                type: "boolean",
                description:
                  "true if this role doesn't run without documented material (storytelling, behind the scenes, lessons learned); false if it runs without a logbook (expertise, teaching). Used by the calendar to reserve these roles for documented days. Omit this field to leave the current value unchanged.",
              },
            },
            required: ["action", "label", "description", "weight", "platforms"],
          },
        },
        angleProposals: {
          type: "array",
          description:
            "0 to 5 proposals to create/modify a content angle (a variation of treatment within a role). Most turns propose none.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' for a new angle, 'update' to modify an existing angle." },
              targetId: enumField(context.angleIds, "EXACT id of the existing angle to modify — only if action='update'."),
              label: { type: "string", description: "Short name of the angle." },
              description: { type: "string", description: "Treatment instruction associated with this angle." },
            },
            required: ["action", "label", "description"],
          },
        },
        postingGoalProposals: {
          type: "array",
          description:
            "0 to 5 proposals to activate or switch off a platform. An active platform gets one post per publishing day; a switched-off platform gets none. No create/update distinction: the platform identifies the target.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              platform: enumField(context.platformKeys, "Known platform key (from the registry)."),
              active: {
                type: "boolean",
                description: "true to activate the platform, false to switch it off.",
              },
            },
            required: ["platform", "active"],
          },
        },
        profileProposals: {
          type: "array",
          description:
            "0 or 1 proposal to update the BRAND AUDIENCE (not the audience of a specific subject — that is product_update). Most turns propose none, only when the audience clearly sharpens in the conversation and differs from what is already known.",
          maxItems: 1,
          items: {
            type: "object",
            properties: {
              targetAudience: {
                type: "string",
                description: "Who buys or reads, what interests them, what they should remember about the brand — full up-to-date value, not just the delta.",
              },
            },
            required: ["targetAudience"],
          },
        },
      },
      required: [
        "productProposals",
        "seriesProposals",
        "categoryProposals",
        "angleProposals",
        "postingGoalProposals",
        "profileProposals",
      ],
    },
  };
}

const SYSTEM_PROMPT = `You are Tellovo's editorial assistant. You talk with the user about their editorial direction and the settings of their publishing calendar, and, when relevant, you propose creations or changes to PRODUCTS (subjects), recurring SERIES, EDITORIAL ROLES (called 'categories' in the data), ANGLES, active or switched-off PLATFORMS, PUBLISHING DAYS, and the BRAND AUDIENCE.

You have READ TOOLS over the whole workspace: the creator's raw material (their working documents), their scripts, their publishing calendar, their real performance, the narrative state of their ongoing series, and their full profile. Use them when the answer depends on it — an editor-in-chief who advises without having read what is published or what is planned is useless. But don't dig for the sake of it: on a question that doesn't need it, answer directly. Two or three targeted reads are better than ten.

Your reply to the user is your text, not a tool call. The propose_changes tool is only for recording proposals; after calling it, you must always reply to the user in text.

Everything you write — your replies to the user and every field of every proposal (names, descriptions, labels, titles, material text) — is in English.

Vocabulary: when talking to the user, always say "role" or "editorial role", never "category". A role says WHY a post exists (expertise, behind the scenes, social proof...); a series says WHAT it looks like (a named, recognizable format) and serves exactly ONE role.

Rules:
- The SERIES is the object the user manipulates. When they describe a format, a recurring slot, a recurring idea, propose a SERIES (attached to an existing role) — not a role. Only propose creating or changing a role if the user explicitly asks, or if no existing role can host the series and one is manifestly missing. Role weights mostly evolve from real performance: only touch them on a clear request.
- Ask a single question at a time, conversationally.
- Only propose a creation/change when you have enough info — most turns should propose nothing (empty arrays).
- Rhythm is not set as a number of posts: each SERIES has its days (rhythmDays, and everyOtherWeek for every other week), and publishes on those days on its active platforms. To make a series publish another day or more often, propose an update of the series with its new days. Two series can share a day (two posts that day). A platform is ACTIVE or SWITCHED OFF (postingGoalProposals). There are no automatic free posts. propose_publishing_days only changes the days the author can publish, offered when creating a series — only on a clear user request.
- Archiving (propose_archive) never erases: it takes an item out of circulation without touching content already produced. Only propose it on a clear user request, never on your own initiative to "tidy up".
- MATERIAL: when the user tells you factual, usable information (news about one of their subjects, a workshop anecdote, a number, a decision, a lesson learned), offer to add it to their material with propose_material — that's what will feed their future content. Report faithfully what they said, adding or embellishing nothing. Don't propose one for every sentence: only when there's real information to keep. If you don't know which subject to attach it to, ask them rather than guess.
- FILES: when the user drops a file in the conversation, you see its name, NEVER its content. Never claim to know what it contains and don't summarize it. Their message tells you what to do with it; if they're unclear about the subject to attach it to, ask — you can file it later, the file remains available.
- For 'update', ALWAYS use the EXACT id supplied in the context (existing products/series/roles/angles) — never invent an id, and only use 'update' if the user clearly describes an already existing item.
- For a series, use the EXACT role label supplied in the context (one role per series; if an idea hesitates between two roles, propose two series).
- For a role, ONLY propose the weight of the role concerned (5 to 90) — never the others', they will be readjusted automatically to keep summing to 100%.
- A series can draw its material from a specific SUBJECT (productId): fill it in when the series is manifestly about an existing subject, otherwise omit the field — it then falls back on brand-level material. Never omit this field to "detach" a series: omitting = leaving unchanged.
- A role's materialHungry field says whether it needs documented material to run (storytelling, behind the scenes: yes; expertise, teaching: no). Only fill it in if you really change it — omitting keeps the current value.
- For platforms (series and roles), ONLY use the keys of the supplied registry. Only restrict to specific platforms if the conversation context clearly justifies it (e.g. the user mentions a particular network) — otherwise leave the array empty (= all platforms), never over-scope without reason. For an update, restate the item's current platforms unless a change is explicitly requested.
- You READ the calendar and the scripts, you never MODIFY them. No month generation, no creating/moving/deleting a slot; no writing, rewriting or deleting a script. Those are the user's two domains: the schedule and the words. If asked to touch them, say so simply and point to the relevant screen (Calendar, or the script editor) — you can however read them to argue, summarize, or spot a gap.
- Nothing is ever saved directly: each proposal passed to propose_changes will be reviewed, edited or refused by the user before being applied — so you can propose as soon as it's reasonable, without over-asking for confirmation. Never say a change is done: say it is proposed.
- You must NEVER invent information (name, characteristic, number, date...) that wasn't explicitly given to you by the user or by a supplied source. When in doubt or when info is missing, ask a clarifying question rather than guess.
- The brand audience (who buys/reads, what interests them, what they should remember) is a PROFILE datum, distinct from the possible audience of a specific subject (that is a property of the product — use the targetAudience field of a product proposal, not profileProposals, in that case). Only propose an update of the brand audience if it clearly sharpens and differs from the already-known value supplied in the context.`;

export interface AssistantChatContext {
  history: AssistantMessage[];
  products: Array<{
    id: string;
    name: string;
    description?: string | null;
    valueProposition?: string | null;
    targetAudience?: string | null;
  }>;
  series: Array<{
    id: string;
    label: string;
    description: string;
    rhythm: SeriesRhythm | null;
    category: { label: string } | null;
    platforms: string[];
    product?: { id: string; name: string } | null;
  }>;
  categories: Array<{
    id: string;
    label: string;
    description: string;
    weight: number;
    platforms: string[];
    materialHungry: boolean;
  }>;
  angles: Array<{ id: string; label: string; description: string }>;
  postingGoals: Array<{ platform: string; targetCountPerWeek: number }>;
  /** Publishing days of the profile, ISO (1 = Monday … 7 = Sunday). */
  publishingDays: number[];
  /** Answer to "What do you expect from us?" — null if never set. */
  expectations?: string | null;
  /** Current brand audience (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — null if never set. */
  currentTargetAudience?: string | null;
  sources?: Array<{ url: string; text: string }>;
  /** Read tools exposed to the model, and their execution. Injected by the caller rather than
   *  imported here: the llm/ layer knows neither the database nor the services
   *  (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.1). */
  readTools: LlmToolDefinition[];
  onReadTool: (name: string, input: unknown) => Promise<unknown>;
  /** Files dropped in the conversation and not yet filed (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1).
   *  Only the name is passed to the model — never the content. */
  attachments?: Array<{ id: string; filename: string }>;
}

export interface AssistantTurnResult {
  /** Conversational reply: the model's free text, plus a tool field. */
  reply: string;
  proposals: AssistantChatResult;
  materialProposals: MaterialProposal[];
  archiveProposals: ArchiveProposal[];
  publishingDaysProposals: PublishingDaysProposal[];
  toolCalls: AgenticToolCall[];
  stoppedAtMaxTurns: boolean;
}

export async function runAssistantChatTurn(context: AssistantChatContext): Promise<AssistantTurnResult> {
  // Each item is rendered with ALL the fields the assistant can propose to modify: proposing an
  // `update` on a field it wasn't shown amounts to overwriting it blindly
  // (docs/SPEC_ASSISTANT_AGENTIQUE.md §6).
  const contextLines = [
    context.products.length > 0
      ? `Existing products: ${context.products
          .map(
            (p) =>
              `[id:${p.id}] ${p.name}${p.description ? ` — ${p.description}` : ""}${
                p.valueProposition ? ` [value proposition: ${p.valueProposition}]` : ""
              }${p.targetAudience ? ` [subject audience: ${p.targetAudience}]` : ""}`
          )
          .join(" ; ")}`
      : "No product registered for now.",
    context.series.length > 0
      ? `Existing series: ${context.series
          .map(
            (s) =>
              `[id:${s.id}] ${s.label} (${rhythmLabel(s.rhythm)}, days ${s.rhythm?.days.join(",") ?? "none"}) — ${s.description} [role: ${s.category?.label ?? "none"}]${
                s.platforms.length > 0 ? ` [platforms: ${s.platforms.join(", ")}]` : " [all networks]"
              }${s.product ? ` [subject material: ${s.product.name} (id:${s.product.id})]` : " [no linked subject]"}`
          )
          .join(" ; ")}`
      : "No active series for now.",
    context.categories.length > 0
      ? `Active editorial roles: ${context.categories
          .map(
            (c) =>
              `[id:${c.id}] ${c.label} (${c.weight}%) — ${c.description}${
                c.platforms.length > 0 ? ` [platforms: ${c.platforms.join(", ")}]` : " [all networks]"
              }${c.materialHungry ? " [requires documented material]" : ""}`
          )
          .join(" ; ")}`
      : "No active editorial role for now.",
    context.angles.length > 0
      ? `Active angles: ${context.angles.map((a) => `[id:${a.id}] ${a.label} — ${a.description}`).join(" ; ")}`
      : "No active angle for now.",
    `Days the author can publish: ${publishingDaysLabel(context.publishingDays)} (offered to new series; the series' rhythms are what place the posts).`,
    context.postingGoals.length > 0
      ? `Platforms: ${context.postingGoals
          .map((g) => `${platformLabel(g.platform)}: ${g.targetCountPerWeek > 0 ? "active" : "switched off"}`)
          .join("; ")}`
      : "No active platform for now.",
    context.expectations
      ? `What the creator expects from Tellovo: ${context.expectations}`
      : "The creator hasn't said what they expect from Tellovo.",
    context.currentTargetAudience
      ? `Current brand audience: ${context.currentTargetAudience}`
      : "No brand audience set for now.",
  ];

  const attachments = context.attachments ?? [];
  if (attachments.length > 0) {
    contextLines.push(
      `Files dropped in the conversation, not yet filed as material (you only know the NAME, never the content): ${attachments
        .map((a) => `[id:${a.id}] ${a.filename}`)
        .join(" ; ")}`
    );
  }

  const sourceBlocks = (context.sources ?? []).map((s) => `--- Source: ${s.url} ---\n${s.text}`);

  // The base editorial state stays PRE-INJECTED rather than exposed as a tool: the assistant needs it
  // at every message, fetching it would cost a round trip per turn for nothing
  // (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.1). Only what is voluminous or occasional is tooled.
  const system = [
    SYSTEM_PROMPT,
    "",
    "--- Current state of the workspace ---",
    ...contextLines,
    ...(sourceBlocks.length > 0
      ? [
          "",
          "Information extracted from web pages supplied by the user for this turn (factual context, invent nothing beyond it):",
          ...sourceBlocks,
        ]
      : []),
  ].join("\n");

  const proposalTool = buildAssistantTool({
    productIds: context.products.map((p) => p.id),
    seriesIds: context.series.map((s) => s.id),
    categoryIds: context.categories.map((c) => c.id),
    categoryLabels: context.categories.map((c) => c.label),
    angleIds: context.angles.map((a) => a.id),
    platformKeys: KNOWN_PLATFORM_KEYS,
  });

  // A model may call propose_changes several times in a single turn: we accumulate instead of
  // overwriting. The per-type caps remain the schema's, applied on each call.
  const materialProposals: MaterialProposal[] = [];
  const archiveProposals: ArchiveProposal[] = [];
  const publishingDaysProposals: PublishingDaysProposal[] = [];
  const proposals: AssistantChatResult = {
    productProposals: [],
    seriesProposals: [],
    categoryProposals: [],
    angleProposals: [],
    postingGoalProposals: [],
    profileProposals: [],
  };

  const result = await callAgentic({
    system,
    messages: context.history.map((m) => ({ role: m.role, content: m.content })),
    tools: [
      ...context.readTools,
      proposalTool,
      buildMaterialTool({ productIds: context.products.map((p) => p.id), attachmentIds: attachments.map((a) => a.id) }),
      buildArchiveTool({
        seriesIds: context.series.map((s) => s.id),
        categoryIds: context.categories.map((c) => c.id),
        angleIds: context.angles.map((a) => a.id),
      }),
      buildPublishingDaysTool(),
    ],
    maxTokens: 3072,
    onToolCall: async ({ name, input }) => {
      if (name === MATERIAL_TOOL_NAME) {
        const parsed = materialProposalSchema.parse(input);
        materialProposals.push(parsed);
        return { recorded: 1, note: "Material proposal recorded, awaiting validation. Reply now in text." };
      }
      if (name === ARCHIVE_TOOL_NAME) {
        const parsed = archiveProposalSchema.parse(input);
        archiveProposals.push(parsed);
        return { recorded: 1, note: "Archive proposal recorded, awaiting validation. Reply now in text." };
      }
      if (name === PUBLISHING_DAYS_TOOL_NAME) {
        const parsed = publishingDaysProposalSchema.parse(input);
        publishingDaysProposals.push(parsed);
        return { recorded: 1, note: "Publishing days proposal recorded, awaiting validation. Reply now in text." };
      }
      if (name !== ASSISTANT_CHAT_TOOL_NAME) {
        return context.onReadTool(name, input);
      }
      const parsed = assistantChatResultSchema.parse(input);
      proposals.productProposals.push(...parsed.productProposals);
      proposals.seriesProposals.push(...parsed.seriesProposals);
      proposals.categoryProposals.push(...parsed.categoryProposals);
      proposals.angleProposals.push(...parsed.angleProposals);
      proposals.postingGoalProposals.push(...parsed.postingGoalProposals);
      proposals.profileProposals.push(...parsed.profileProposals);
      const recorded = Object.values(parsed).reduce((n, list) => n + list.length, 0);
      return {
        recorded,
        note: "Proposals recorded, awaiting user validation. Reply to them now in text.",
      };
    },
  });

  return {
    reply: result.reply,
    proposals,
    materialProposals,
    archiveProposals,
    publishingDaysProposals,
    toolCalls: result.toolCalls,
    stoppedAtMaxTurns: result.stoppedAtMaxTurns,
  };
}
