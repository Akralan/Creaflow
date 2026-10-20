import { buildStyleBlock, type StyleProfile } from "./styleProfile";
import { platformRuleText } from "./platformRules";
import type { Reader } from "./readerPortrait";
import type { RecentPostCard } from "./recentPosts";
import { buildFormatBlock, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";
import type { EventBrief } from "./eventWriter";
import type { NarrativeBrief } from "./narrativeWriter";
import { buildLanguageBlock, type PostLanguage } from "@/lib/language";

export type Platform = string;
export type ContentType = "visual" | "text";

export interface ContentCategoryContext {
  id: string;
  label: string;
  description: string;
}

const DEFAULT_CONTENT_TYPE_BY_PLATFORM: Record<string, ContentType> = {
  linkedin: "text",
  x: "text",
};

/** Content type suggested by default for each platform; the user can change it before generation. */
export function defaultContentTypeForPlatform(platform: string): ContentType {
  return DEFAULT_CONTENT_TYPE_BY_PLATFORM[platform] ?? "text";
}

const CONTENT_TYPE_GUIDANCE: Record<ContentType, string> = {
  visual: "visual post (single image, carousel or short animation), no audio: describe the composition that grabs attention.",
  text: "text only, no visual: the hook is the first sentence of the text.",
};

// Writing rules for the actions that don't get the full system prompt: selection -> instruction
// (microEdit.ts). Full generation and block regeneration have their own, more detailed rules in
// SCRIPT_CORE_PROMPT (docs/SPEC_PROMPT_GENERATION_V3.md Annex A.1).
export const EDITORIAL_WRITING_RULES = `Writing rules:
- Concrete beats abstract: one dated, numbered or named detail is worth more than three generalities.
- Write the way the person talks to their customers or peers, not like a brand communicating.
- Hollow marketing register is forbidden: announcement formulas ("Discover", "Don't hesitate to", "Ready to take it to the next level?"), empty rhetorical questions, superlatives without proof, piles of emojis.
- Write in the language of the text you are given or editing.`;

// docs/SPEC_PROMPT_GENERATION_V3.md Annex A.1 — shared by full generation and by single-block
// regeneration (microEditService.ts).
export const SCRIPT_CORE_PROMPT = `You are the ghostwriter for a person who builds something — software, a game, a product, a craft — and talks about what they build on social media. You write in their place, in their voice, from their real working material. You are neither a brand nor a marketing department: you are that person, on a day when they have time to write well.

All the content you produce (posts, titles, hooks, hashtags, captions, slide descriptions, notes) is written in the language given in <language>.

A successful post passes two tests at once:
- the target reader stops scrolling, because the post is about what interests them, at their level;
- people who know the author would believe they wrote it themselves.
The first test alone gives a marketer's post. The second alone gives a transcript of notes. You need both.

<facts>
- Every fact about the author, their project or their results (name, number, date, anecdote, decision, outcome) comes from the supplied context. Nothing else.
- If the material is thin, scale the post's ambition down to what you know. As a last resort, write "[to be completed]" in place of an indispensable detail, never more than twice.
- Add no emotion, promise, date or personal detail the author did not express, even to make the post warmer.
- General domain knowledge (definitions, public orders of magnitude) is allowed only in an educational episode decided by the editorial direction.
</facts>

<writing>
- One idea per post. If two messages coexist, keep the stronger one and drop the other.
- Concrete beats abstract: one dated, numbered or named detail is worth more than three generalities.
- Write with the target reader's words and at their level: don't dumb it down for experts, don't use jargon for beginners.
- The hook opens a tension drawn from the material: an unexpected number, a confession, a counter-intuitive claim, a before/after, a scene. It never announces the topic ("Today I want to talk about…").
- Short sentences, active verbs, first person. A single call to action, at the end, and only if it serves the reader.
- Banned phrasings, and what to write instead:
  - "It's not X, it's Y", "More than an X, a Y" → state Y directly.
  - A rhetorical question as an opener ("What if…?", "Ever wondered…?") → the fact that answers it.
  - "Excited to announce", "Thrilled to share", "I'm humbled", "Let's dive in", "Here's the thing", "In today's fast-paced world…", "Buckle up", "Spoiler alert:", "The result?" → nothing: start with the fact.
  - Rhythmic triplets ("Faster. Simpler. Stronger.") and lists of three adjectives → one precise detail.
  - Unproven superlatives ("game-changing", "revolutionary", "groundbreaking", "unlock", "supercharge", "next level") → the number or fact that would prove it.
  - Filler AI vocabulary ("delve", "tapestry", "landscape", "leverage", "seamless", "robust") → the plain word.
  - Em-dash-heavy flourishes and emojis used as bullets or sentence endings → none, unless the author's style uses them.
</writing>

<examples>
Hooks. In each pair, same reader and same material. Names and numbers are fictional: never reuse them.

Reader: developers. Material: a refactor that deleted code.
Bad: "Today, I want to talk about the big refactor of my app 🚀"
Good: "I deleted 4,000 lines this week. The app now starts twice as fast."
Why: the good one gives the fact and the result; the bad one announces a topic and leaves the reader to decide alone whether it matters.

Reader: players. Material: the character's jump was reworked.
Bad: "What if the jump was the most important mechanic in a platformer?"
Good: "Mira's jump hung 80 ms too long in the air. Nobody could say why the game felt mushy. Here's the before and after."
Why: players want the feel and the proof on screen, not a game designer's question.

Reader: other game developers. Same material.
Good: "6 frames of coyote time and doubled gravity on the way down: Mira's jump finally feels snappy."
Why: same fact, different reader. Here we give the exact settings, which is what peers come for.
</examples>

<priorities>
When instructions conflict, in this order:
1. The truth of the facts.
2. What the author asked for this post and this series (suggested idea, editorial direction, chosen framing).
3. The style rules learned from their corrections.
4. The target reader.
5. The series identity and the imposed angle. If the angle doesn't fit the material, keep its spirit and adapt its structure rather than invent.
6. The platform's conventions.
</priorities>`;

// Annex A.2 — full generation only: the block-regeneration tools don't have the preparation fields.
export const SCRIPT_METHOD_PROMPT = `<method>
You fill in the tool's fields in order. The first ones are your preparation: they are never published, they exist so you choose well before writing.
1. reader — For THIS post, on THIS platform, which reader are you aiming at among those described to you? What they already know, what they come looking for. If the editorial direction chose the audience, it is that one.
2. candidateMoments — Up to 5 moments from the material that could interest THIS reader, each with the exact passage that proves it. Don't invent any to reach a number.
3. chosenMoment — The one you keep, and why: the strongest for this reader, not already used, compatible with the role, the series and the direction.
4. concept — What the reader should remember or do after reading.
5. hookOptions then chosenHook — 2 or 3 hooks of different types, then the one you keep and why it will stop THIS reader.
5 bis. inspirationsUsed and inspirationsToDrop — If an <inspiration> block is supplied: the ones you used for form, and the ones that will NEVER serve this topic (foreign audience, generic advice, off-topic). A card that doesn't serve THIS post may serve the next one: don't drop it for that. Empty arrays otherwise.
6. The post, built from chosenMoment, concept and chosenHook.
7. selfCheck — Reread the post as the target reader, then as someone who knows the author. Answer honestly: a flagged miss will be fixed by a new draft, a hidden miss will be published.
</method>`;

export const SCRIPT_SYSTEM_PROMPT = `${SCRIPT_CORE_PROMPT}\n\n${SCRIPT_METHOD_PROMPT}`;

/** Inspiration card as shown to the model (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3). */
export interface InspirationCard {
  ref: string;
  id: string;
  url: string;
  insight: string;
  kind: string;
  readerLabel: string | null;
  platform: string | null;
}

export interface ScriptGenerationContext {
  creatorProfile: {
    brandName: string;
    activityType: string;
    /** Free-form answer to "What do you expect from us?" (docs/SPEC_ONBOARDING_MVP.md §3). */
    expectations?: string | null;
    /** Brand audience — last fallback when the subject has neither a portrait nor a "Who for". */
    targetAudience?: string | null;
  };
  styleProfile?: StyleProfile | null;
  product?: {
    name: string;
    description?: string | null;
    valueProposition?: string | null;
    /** The subject's "Who for" — takes precedence over creatorProfile.targetAudience when set. */
    targetAudience?: string | null;
  } | null;
  /** Reader portraits for the subject (docs/SPEC_PROMPT_GENERATION_V3.md §2.2), main reader
   *  first — takes precedence over both text audiences. */
  readers?: Reader[] | null;
  /** Audiences targeted by the subject's latest posts, newest first (§2.3) — to alternate when
   *  nothing else chooses. */
  recentReaderLabels?: string[];
  /** Cards of the subject's latest posts, newest first (docs/SPEC_MEMOIRE_ET_VEILLE.md §2). */
  recentPosts?: RecentPostCard[];
  /** Active cards from the subject's inspiration watch, numbered i1…i10 (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3). */
  inspirations?: InspirationCard[];
  platform: Platform;
  contentCategory: ContentCategoryContext;
  contentType: ContentType;
  /** Titles of the user's recent scripts (any status), to avoid re-proposing the same angles. */
  recentTopics?: string[];
  /** Summary of what performs best recently on this platform (manually entered metrics). */
  performanceSummary?: string | null;
  /** Concepts already proposed and rejected for THIS script via "another idea, same brief"
   *  (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — absent/empty in normal generation. Only the 5 most
   *  recent are injected in the message. */
  rejectedConcepts?: string[];
  /** Visual post format (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md) — null unless contentType is "visual". */
  visual?: VisualFormatSpec | null;
  /** Angle imposed by the system (anti-repetition mechanism, invisible to the user). */
  angle?: { id: string; label: string; description: string } | null;
  /** Recurring series this script belongs to, if any. */
  series?: { id: string; label: string; description: string } | null;
  /** Brand photo selected by semantic search (contentType "visual" only),
   *  see docs/SPEC_RESSOURCES_VISUELLES.md §5.3/§7. */
  brandAsset?: { id: string; aiDescription: string; tags: string[] | null } | null;
  /** Raw material documents for the subject, injected as is (docs/SPEC_MATIERE_EDITEUR.md §3) — the
   *  LLM decides what to use, no server-side preselection. `annotatedText` wraps passages already
   *  cited by earlier generations in used-passage markers (see citationMatching.ts). */
  materialDocuments?: Array<{ id: string; title: string | null; annotatedText: string }>;
  /** Episode directive for a series generated from the material (§3.8) — the sub-theme this script
   *  must cover within the series; the LLM picks from materialDocuments itself. */
  episodeDirective?: { episodeTitle: string; angleHint: string } | null;
  /** Idea suggested by the creator at a generation entry point (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A,
   *  Annex B.4) — a seed to interpret, never to copy nor a source of facts. */
  directive?: string | null;
  /** Subject actually used to read the material and scope citations (buildGenerationContext,
   *  scriptService.ts) — the request's explicit `productId`, or else the subject linked to the series
   *  (`ContentSeries.productId`, subject selector). Use it for `Script.productId`/citations at
   *  creation, instead of the raw request `productId`, to stay consistent with the material this
   *  generation actually read. */
  resolvedProductId?: string | null;
  /** The per-event brief (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5): present when the series has a
   *  reader, a form and a next event to tell. Generation then goes through the agentic writer
   *  (eventWriter.ts) and ignores angle, role and inspirations. */
  eventBrief?: EventBrief | null;
  /** The story brief (docs/SPEC_FIL_NARRATIF.md §7): present when the fil narratif claims this post.
   *  Takes precedence over `eventBrief`; generation then goes through narrativeWriter.ts. */
  narrativeBrief?: NarrativeBrief | null;
  /** Language the post must be written in (src/lib/language.ts): the profile's, else the notes'. */
  language?: PostLanguage;
}

function tag(name: string, lines: string[]): string {
  return `<${name}>\n${lines.join("\n")}\n</${name}>`;
}

/** <readers> block (Annex A.3): always present, tells the model who it is talking to before anything else. */
export function buildReadersBlock(context: Pick<ScriptGenerationContext, "readers" | "recentReaderLabels" | "product" | "creatorProfile">): string {
  const lines: string[] = [];
  const readers = context.readers ?? [];
  if (readers.length > 0) {
    lines.push("The readers of this subject (portrait validated or corrected by the author, the first is the main one):");
    for (const r of readers) {
      const parts = [`- ${r.label}: ${r.who}.`];
      if (r.knows) parts.push(`Already knows: ${r.knows}.`);
      if (r.wants) parts.push(`Comes looking for: ${r.wants}.`);
      if (r.stopsFor) parts.push(`Stops for: ${r.stopsFor}.`);
      if (r.turnsOff) parts.push(`Turned off by: ${r.turnsOff}.`);
      if (r.words.length > 0) parts.push(`Their words: ${r.words.join(", ")}.`);
      lines.push(parts.join(" "));
    }
    if (readers.length > 1 && context.recentReaderLabels?.length) {
      lines.push(
        `Audiences targeted by this subject's latest posts, newest first: ${context.recentReaderLabels.join(", ")}. Vary if the subject has several and this post allows it.`
      );
    }
  } else {
    const audience = context.product?.targetAudience || context.creatorProfile.targetAudience;
    lines.push(
      audience
        ? `Target audience: ${audience}`
        : "No audience defined: infer the most likely reader from the material and the subject, and name them in reader."
    );
  }
  return tag("readers", lines);
}

const SHORT_DATE = new Intl.DateTimeFormat("en-US", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** <recent_posts> block (docs/SPEC_MEMOIRE_ET_VEILLE.md Annex A.1) — empty without recent posts. */
export function buildRecentPostsBlock(cards: RecentPostCard[] | undefined): string {
  if (!cards?.length) return "";
  const lines = [
    "The latest posts on this subject, newest first. Don't reuse their hooks or their endings. If the last two open with the same type of hook, pick another. You may refer to one of them if it serves the story (\"last week…\"), without repeating it.",
  ];
  for (const c of cards) {
    const head = [SHORT_DATE.format(new Date(c.createdAt)), c.platform, c.readerLabel ? `audience: ${c.readerLabel}` : null].filter(Boolean).join(" · ");
    const parts = [
      c.moment ? `moment "${c.moment}"` : null,
      c.hook ? `hook${c.hookKind ? ` [${c.hookKind}]` : ""} "${c.hook}"` : null,
      c.ending ? `ending "${c.ending}"` : null,
      // docs/SPEC_FIL_NARRATIF.md §9 — an episode that follows a checkpoint must not say it again.
      c.narrativeKind ? `a story post (${c.narrativeKind}), don't retell what it covered` : null,
    ].filter(Boolean);
    lines.push(`- ${head}: ${parts.join(" · ") || "(post without text)"}`);
  }
  return tag("recent_posts", lines);
}

/** <inspiration> block (docs/SPEC_MEMOIRE_ET_VEILLE.md Annex A.1) — empty without an active card. */
export function buildInspirationBlock(cards: InspirationCard[] | undefined): string {
  if (!cards?.length) return "";
  return tag("inspiration", [
    "What already works for these audiences, found through monitoring. Take inspiration from the FORM (format, structure, hook type, rhythm), never the substance: reuse no number, anecdote or formula. You are not required to use any.",
    ...cards.map((c) => {
      const meta = [c.readerLabel, c.platform, c.kind].filter(Boolean).join(" · ");
      return `- [${c.ref}] (${meta}) ${c.insight} — ${c.url}`;
    }),
    "In your preparation, inspirationsUsed lists the ones you used. inspirationsToDrop lists only those that will never serve this subject (foreign audience, generic advice, off-topic), with the reason: they will be removed. Don't drop a card just because it doesn't serve this post.",
  ]);
}

// docs/SPEC_PROMPT_GENERATION_V3.md §4.2, Annex A.3 text: tags separate the data (material, profile)
// from the instructions; <readers> first, <reminder> last, the positions of maximum weight.
export function buildScriptUserMessage(context: ScriptGenerationContext): string {
  const {
    creatorProfile,
    styleProfile,
    product,
    platform,
    contentCategory,
    contentType,
    recentTopics,
    performanceSummary,
    rejectedConcepts,
    angle,
    series,
    brandAsset,
    materialDocuments,
    episodeDirective,
    directive,
  } = context;

  const sections: string[] = [buildReadersBlock(context)];

  const brandLines = [`Author: ${creatorProfile.brandName} — ${creatorProfile.activityType}`];
  if (creatorProfile.expectations) brandLines.push(`What the author expects from Tellovo: ${creatorProfile.expectations}`);
  sections.push(tag("brand", brandLines));

  // Voice + rules learned from the author's corrections (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4),
  // filtered on the target platform. Same content as in micro-edits, different envelope.
  const styleLines = buildStyleBlock(styleProfile, platform).split("\n").slice(1).filter(Boolean);
  if (styleLines.length) sections.push(tag("style", styleLines));



  if (materialDocuments?.length) {
    const combined = materialDocuments
      .map((d) => (d.title ? `[${d.title}]\n${d.annotatedText}` : d.annotatedText))
      .join("\n---\n");
    sections.push(
      tag("material", [
        "Material for this subject. It is your only source of facts. Passages between [already used in a previous post] and [/already used] have already been used: don't reuse them as is, a different angle on the same fact remains possible.",
        combined,
      ])
    );
  }

  const briefLines: string[] = [];
  briefLines.push(
    product
      ? `Subject: ${product.name}${product.description ? ` — ${product.description}` : ""}${
          product.valueProposition ? ` (value proposition: ${product.valueProposition})` : ""
        }`
      : "No specific subject: a post about the author's activity."
  );
  briefLines.push(`Post type: ${CONTENT_TYPE_GUIDANCE[contentType]}`);
  briefLines.push(`Role of this post: ${contentCategory.label} — ${contentCategory.description}`);
  if (series) {
    briefLines.push(`Series to respect (identity and tone recognizable from one episode to the next): ${series.label} — ${series.description}`);
  }
  const angleLabel = "Angle (shape of the hook and structure)";
  if (angle) {
    briefLines.push(`${angleLabel} : ${angle.label} — ${angle.description}`);
  }
  if (episodeDirective) {
    briefLines.push(`This episode of the series focuses on: ${episodeDirective.episodeTitle} — ${episodeDirective.angleHint}`);
  }
  if (contentType === "visual" && brandAsset) {
    briefLines.push(
      `Available photo (used as is or cut out in the mockup, never altered; don't describe a product other than this one): ${brandAsset.aiDescription}${
        brandAsset.tags?.length ? ` (keywords: ${brandAsset.tags.join(", ")})` : ""
      }`
    );
  }
  if (directive) {
    briefLines.push(`Idea suggested by the author (a lead to interpret, not text to copy nor a source of facts): ${directive}`);
  }
  sections.push(tag("brief", briefLines));

  const inspirationBlock = buildInspirationBlock(context.inspirations);
  if (inspirationBlock) sections.push(inspirationBlock);

  const visualOnly = contentType === "visual" && context.visual?.withText === false;
  sections.push(tag("platform", [platformRuleText(platform, { visualOnly })]));

  if (contentType === "visual") {
    const formatBlock = buildFormatBlock(context.visual);
    if (formatBlock) sections.push(formatBlock);
  }

  const recentPostsBlock = buildRecentPostsBlock(context.recentPosts);
  if (recentPostsBlock) sections.push(recentPostsBlock);

  const varietyLines: string[] = [];
  if (recentTopics?.length) varietyLines.push(`Author's recent posts (don't re-propose the same angle): ${recentTopics.join("; ")}`);
  if (performanceSummary) varietyLines.push(`Recent performance: ${performanceSummary}`);
  if (rejectedConcepts?.length) {
    // Injection cap (docs/SPEC_PROMPT_GENERATION_TECH.md §6.3): only the 5 most recent.
    varietyLines.push(
      `Ideas already rejected for this post — propose a genuinely different idea, not a rewording: ${rejectedConcepts.slice(-5).join("; ")}`
    );
  }
  if (varietyLines.length) sections.push(tag("variety", varietyLines));

  if (context.language) sections.push(buildLanguageBlock(context.language));

  sections.push(
    tag("reminder", [
      `Before answering: every fact comes from the context; no banned phrasing; the hook fits within what the platform shows before "see more"; a hurried reader understands from the first sentence why this post is for them.${context.language ? " Write everything in the language given in <language>." : ""}`,
    ])
  );

  return sections.join("\n\n");
}
