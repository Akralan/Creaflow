import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";
import { MAX_STYLE_LIST_ITEMS, MAX_STYLE_RULES, styleProfileSchema, styleRuleSchema, type StyleProfile } from "./styleProfile";

/**
 * Passe d'apprentissage du style (docs/SPEC_APPRENTISSAGE_STYLE.md §5). Tout ce fichier est de la
 * logique pure sauf `learnStyle`, qui fait l'unique appel LLM ; la sélection du corpus en base vit
 * dans styleLearningService.ts.
 */

/** Les colonnes textuelles d'un script telles que stockées (et telles que figées dans firstDraftSnapshot). */
export interface ScriptTextColumns {
  title?: string | null;
  hookVisual?: string | null;
  hookText?: string | null;
  hookAudio?: string | null;
  caption?: string | null;
  hashtags?: string[] | null;
  storyboard?: { planNumber: number; description: string }[] | null;
  soundRecommendation?: string | null;
}

export interface FieldDiff {
  field: string;
  before: string;
  after: string;
}

export interface StyleCorrection {
  platform: string;
  contentType: string;
  diffs: FieldDiff[];
}

export interface StyleSample {
  platform: string;
  contentType: string;
  /** Texte de l'auteur, déjà assemblé (titre + accroche + corps). */
  text: string;
}

export const MAX_CORRECTIONS_PER_PASS = 15;
export const MAX_SAMPLES_PER_PASS = 5;
const TRUNCATE_HEAD = 800;
const TRUNCATE_TAIL = 400;

/** Tronque au milieu (début + fin) pour garder l'ouverture et l'appel à l'action, les deux zones les plus corrigées. */
export function truncateMiddle(text: string, head = TRUNCATE_HEAD, tail = TRUNCATE_TAIL): string {
  if (text.length <= head + tail) return text;
  return `${text.slice(0, head)} […] ${text.slice(text.length - tail)}`;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function textFieldsOf(columns: ScriptTextColumns): Record<string, string> {
  const fields: Record<string, string> = {
    title: normalize(columns.title),
    hookVisual: normalize(columns.hookVisual),
    hookText: normalize(columns.hookText),
    hookAudio: normalize(columns.hookAudio),
    caption: normalize(columns.caption),
    hashtags: (columns.hashtags ?? []).join(" ").trim(),
    soundRecommendation: normalize(columns.soundRecommendation),
  };
  for (const step of columns.storyboard ?? []) {
    fields[`storyboard.${step.planNumber}`] = normalize(step.description);
  }
  return fields;
}

/**
 * Écarts bloc par bloc entre le premier jet et la version finale. Vide si le script est identique à
 * son premier jet (il n'apprend rien). Les deux côtés sont tronqués.
 */
export function diffScript(firstDraft: ScriptTextColumns, final: ScriptTextColumns): FieldDiff[] {
  const before = textFieldsOf(firstDraft);
  const after = textFieldsOf(final);
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);
  const diffs: FieldDiff[] = [];
  for (const field of fields) {
    const b = before[field] ?? "";
    const a = after[field] ?? "";
    if (b === a) continue;
    diffs.push({ field, before: truncateMiddle(b), after: truncateMiddle(a) });
  }
  return diffs;
}

// --- Statistiques calculées en TypeScript, jamais par le modèle (§2 « le modèle ne compte pas ») ---

const EMOJI_RE = /\p{Extended_Pictographic}/gu;

export function countEmojis(text: string): number {
  return (text.match(EMOJI_RE) ?? []).length;
}

export function countExclamations(text: string): number {
  return (text.match(/!/g) ?? []).length;
}

export function opensWithQuestion(text: string): boolean {
  const firstSentence = text.split(/(?<=[.!?])\s/)[0] ?? "";
  return firstSentence.trim().endsWith("?");
}

export function countHashtags(text: string): number {
  return (text.match(/#[\p{L}\p{N}_]+/gu) ?? []).length;
}

export interface EditStats {
  corrections: number;
  emojisRemovedIn: number;
  emojisAddedIn: number;
  hookShortenedIn: number;
  hookLengthenedIn: number;
  /** Médiane du delta relatif de longueur du hook, en pourcentage (négatif = raccourci). */
  hookMedianDeltaPct: number | null;
  openingQuestionRemovedIn: number;
  openingQuestionAddedIn: number;
  exclamationsReducedIn: number;
  exclamationsIncreasedIn: number;
  hashtagsAvgBefore: number | null;
  hashtagsAvgAfter: number | null;
  captionMedianDeltaPct: number | null;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function deltaPct(before: string, after: string): number | null {
  if (before.length === 0) return null;
  return Math.round(((after.length - before.length) / before.length) * 100);
}

/** Le « hook » d'un script : hookText (vidéo, texte) sinon hookVisual (visuel). */
function hookDiff(diffs: FieldDiff[]): FieldDiff | undefined {
  return diffs.find((d) => d.field === "hookText") ?? diffs.find((d) => d.field === "hookVisual");
}

export function computeEditStats(corrections: StyleCorrection[]): EditStats {
  const stats: EditStats = {
    corrections: corrections.length,
    emojisRemovedIn: 0,
    emojisAddedIn: 0,
    hookShortenedIn: 0,
    hookLengthenedIn: 0,
    hookMedianDeltaPct: null,
    openingQuestionRemovedIn: 0,
    openingQuestionAddedIn: 0,
    exclamationsReducedIn: 0,
    exclamationsIncreasedIn: 0,
    hashtagsAvgBefore: null,
    hashtagsAvgAfter: null,
    captionMedianDeltaPct: null,
  };
  const hookDeltas: number[] = [];
  const captionDeltas: number[] = [];
  const hashtagsBefore: number[] = [];
  const hashtagsAfter: number[] = [];

  for (const correction of corrections) {
    const allBefore = correction.diffs.map((d) => d.before).join("\n");
    const allAfter = correction.diffs.map((d) => d.after).join("\n");
    const emojiDelta = countEmojis(allAfter) - countEmojis(allBefore);
    if (emojiDelta < 0) stats.emojisRemovedIn += 1;
    if (emojiDelta > 0) stats.emojisAddedIn += 1;
    const exclDelta = countExclamations(allAfter) - countExclamations(allBefore);
    if (exclDelta < 0) stats.exclamationsReducedIn += 1;
    if (exclDelta > 0) stats.exclamationsIncreasedIn += 1;

    const hook = hookDiff(correction.diffs);
    if (hook) {
      const d = deltaPct(hook.before, hook.after);
      if (d !== null) {
        hookDeltas.push(d);
        if (d < 0) stats.hookShortenedIn += 1;
        if (d > 0) stats.hookLengthenedIn += 1;
      }
      const qBefore = opensWithQuestion(hook.before);
      const qAfter = opensWithQuestion(hook.after);
      if (qBefore && !qAfter) stats.openingQuestionRemovedIn += 1;
      if (!qBefore && qAfter) stats.openingQuestionAddedIn += 1;
    }

    const caption = correction.diffs.find((d) => d.field === "caption");
    if (caption) {
      const d = deltaPct(caption.before, caption.after);
      if (d !== null) captionDeltas.push(d);
      const qBefore = opensWithQuestion(caption.before);
      const qAfter = opensWithQuestion(caption.after);
      if (!hook && qBefore && !qAfter) stats.openingQuestionRemovedIn += 1;
      if (!hook && !qBefore && qAfter) stats.openingQuestionAddedIn += 1;
    }

    const hashtags = correction.diffs.find((d) => d.field === "hashtags");
    if (hashtags) {
      hashtagsBefore.push(countHashtags(hashtags.before));
      hashtagsAfter.push(countHashtags(hashtags.after));
    }
  }

  stats.hookMedianDeltaPct = median(hookDeltas);
  stats.captionMedianDeltaPct = median(captionDeltas);
  if (hashtagsBefore.length > 0) {
    stats.hashtagsAvgBefore = Math.round((hashtagsBefore.reduce((a, b) => a + b, 0) / hashtagsBefore.length) * 10) / 10;
    stats.hashtagsAvgAfter = Math.round((hashtagsAfter.reduce((a, b) => a + b, 0) / hashtagsAfter.length) * 10) / 10;
  }
  return stats;
}

export function formatEditStats(stats: EditStats): string {
  const n = stats.corrections;
  if (n === 0) return "Aucune correction dans cette passe.";
  const signed = (v: number) => `${v > 0 ? "+" : ""}${v}`;
  const lines = [
    `Emojis : retirés dans ${stats.emojisRemovedIn}/${n}, ajoutés dans ${stats.emojisAddedIn}/${n}`,
    `Points d'exclamation : réduits dans ${stats.exclamationsReducedIn}/${n}, augmentés dans ${stats.exclamationsIncreasedIn}/${n}`,
  ];
  if (stats.hookMedianDeltaPct !== null) {
    lines.push(
      `Longueur du hook : raccourci dans ${stats.hookShortenedIn}/${n}, allongé dans ${stats.hookLengthenedIn}/${n} (médiane ${signed(stats.hookMedianDeltaPct)} %)`
    );
  }
  lines.push(
    `Question en ouverture : supprimée dans ${stats.openingQuestionRemovedIn}/${n}, ajoutée dans ${stats.openingQuestionAddedIn}/${n}`
  );
  if (stats.hashtagsAvgBefore !== null && stats.hashtagsAvgAfter !== null) {
    lines.push(`Hashtags : moyenne ${stats.hashtagsAvgBefore} → ${stats.hashtagsAvgAfter}`);
  }
  if (stats.captionMedianDeltaPct !== null) {
    lines.push(`Longueur de la légende / du corps : médiane ${signed(stats.captionMedianDeltaPct)} %`);
  }
  return lines.join("\n");
}

// --- Prompt (Annexe A de la spec) ---

export const LEARN_STYLE_TOOL_NAME = "learn_style";

export const learnStyleTool: LlmToolDefinition = {
  name: LEARN_STYLE_TOOL_NAME,
  description:
    "Met à jour le profil de style d'un auteur à partir de ses corrections sur des textes générés et de textes qu'il a écrits lui-même.",
  input_schema: {
    type: "object",
    properties: {
      tone: { type: "string", description: "Ton général (ex: humoristique, direct, chaleureux)." },
      sentenceLength: { type: "string", description: "Longueur et structure de phrase typiques." },
      emojiUsage: { type: "string", description: "Usage des emojis (fréquence, type)." },
      vocabulary: { type: "string", description: "Registre de vocabulaire utilisé." },
      summary: {
        type: "string",
        description: "Résumé en 2-3 phrases de la voix de l'auteur, directement injectable comme consigne de style.",
      },
      rules: {
        type: "array",
        description:
          "Règles impératives, courtes, vérifiables, tirées de ce que l'auteur corrige SYSTÉMATIQUEMENT (au moins deux corrections concordantes, ou une statistique nette). Garder les règles existantes sauf contradiction. Fusionner les doublons. 12 maximum. platform non null seulement si la règle ne vaut que pour une plateforme.",
        items: {
          type: "object",
          properties: {
            text: { type: "string" },
            platform: { type: ["string", "null"] },
          },
          required: ["text", "platform"],
          additionalProperties: false,
        },
      },
      avoid: {
        type: "array",
        description: "Mots, expressions ou tics que l'auteur retire ou n'emploie jamais. Tableau vide si rien de net.",
        items: { type: "string" },
      },
      prefer: {
        type: "array",
        description: "Expressions ou tournures que l'auteur ajoute ou emploie de lui-même. Tableau vide si rien de net.",
        items: { type: "string" },
      },
      changeNotes: {
        type: "string",
        description:
          "2 à 4 phrases pour l'auteur : ce qui change par rapport au profil précédent et pourquoi (quelles corrections l'ont motivé).",
      },
    },
    required: ["tone", "sentenceLength", "emojiUsage", "vocabulary", "summary", "rules", "avoid", "prefer", "changeNotes"],
    additionalProperties: false,
  },
};

export const LEARN_STYLE_SYSTEM_PROMPT = `Tu es le rédacteur en chef d'un auteur. Tu reçois son profil de style actuel, puis des textes générés par une machine accompagnés de la version que l'auteur a finalement gardée (AVANT / APRÈS), des textes qu'il a écrits lui-même, et des statistiques calculées sur ces écarts.
Ta tâche : mettre à jour son profil de style pour que les prochaines générations demandent moins de corrections.
Règles :
- Ne retiens que la FORME (ton, longueur, structure, vocabulaire, ponctuation, emojis, hashtags, appels à l'action). Ignore les corrections de fond (chiffres, faits, détails produit).
- Une règle n'existe que si au moins deux corrections la soutiennent, ou si une statistique la montre comme systématique.
- Une règle est une phrase impérative, concrète, vérifiable à la lecture (« Le hook tient en une phrase », pas « Être percutant »).
- Conserve les règles existantes sauf si les nouvelles corrections les contredisent. Fusionne les doublons. Jamais plus de ${MAX_STYLE_RULES}.
- Si une règle ne vaut visiblement que pour une plateforme, renseigne platform avec la clé de la plateforme ; sinon null.
- Les textes écrits par l'auteur lui-même sont la référence de sa voix : ils nourrissent summary, avoid et prefer.
- Tous les champs du profil sont obligatoires : s'il n'y a pas assez de matière pour un descripteur, reprends la valeur du profil actuel ou décris prudemment ce que tu observes.`;

export function buildLearnStyleUserMessage(params: {
  currentProfile: StyleProfile | null;
  corrections: StyleCorrection[];
  samples: StyleSample[];
  stats: EditStats;
}): string {
  const sections: string[] = [];
  sections.push(
    `=== PROFIL ACTUEL ===\n${params.currentProfile ? JSON.stringify(params.currentProfile, null, 2) : "aucun (première analyse)"}`
  );
  sections.push(`=== STATISTIQUES SUR ${params.corrections.length} CORRECTIONS ===\n${formatEditStats(params.stats)}`);
  if (params.corrections.length > 0) {
    const blocks = params.corrections.map((c, i) => {
      const lines = c.diffs.map((d) => `[${d.field}]\nAVANT : ${d.before}\nAPRÈS : ${d.after}`);
      return `--- Script ${i + 1} · ${c.platform} · ${c.contentType} ---\n${lines.join("\n")}`;
    });
    sections.push(`=== CORRECTIONS ===\n${blocks.join("\n\n")}`);
  }
  if (params.samples.length > 0) {
    const blocks = params.samples.map((s) => `--- ${s.platform} · ${s.contentType} ---\n${truncateMiddle(s.text)}`);
    sections.push(`=== TEXTES ÉCRITS PAR L'AUTEUR ===\n${blocks.join("\n\n")}`);
  }
  return sections.join("\n\n");
}

export const learnStyleResultSchema = z.object({
  tone: z.string().min(1),
  sentenceLength: z.string().min(1),
  emojiUsage: z.string().min(1),
  vocabulary: z.string().min(1),
  summary: z.string().min(1),
  rules: z.array(styleRuleSchema).max(MAX_STYLE_RULES),
  avoid: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS),
  prefer: z.array(z.string().trim().min(1)).max(MAX_STYLE_LIST_ITEMS),
  changeNotes: z.string().min(1),
});

export interface LearnStyleResult {
  styleProfile: StyleProfile;
  changeNotes: string;
}

export async function learnStyle(params: {
  currentProfile: StyleProfile | null;
  corrections: StyleCorrection[];
  samples: StyleSample[];
  scriptCount: number;
  now?: Date;
}): Promise<LearnStyleResult> {
  const stats = computeEditStats(params.corrections);
  const args = await callStructured({
    system: LEARN_STYLE_SYSTEM_PROMPT,
    userMessage: buildLearnStyleUserMessage({ ...params, stats }),
    tool: learnStyleTool,
    maxTokens: 2048,
  });
  const { changeNotes, ...profileFields } = learnStyleResultSchema.parse(args);
  const styleProfile = styleProfileSchema.parse({
    ...profileFields,
    evidence: { scriptCount: params.scriptCount, learnedAt: (params.now ?? new Date()).toISOString() },
  });
  return { styleProfile, changeNotes };
}
