import { platformLimits, VISUAL_ONLY_CAPTION_MAX } from "./platformRules";
import type { GenerationPrep } from "./scriptSchema";
import { hookOpening, type RecentPostCard } from "./recentPosts";
import { enforceStoryboardCount, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";
// Module pur (aucune base) : même correspondance floue que l'enregistrement des citations, pour qu'un
// passage jugé introuvable ici le soit aussi là-bas.
import { findBestMatchInText } from "@/lib/services/citationMatching";

/**
 * Contrôles du code sur un post généré (docs/SPEC_PROMPT_GENERATION_V3.md §5) : ce que le modèle
 * déclare dans selfCheck ne suffit pas, on vérifie. Chaque échec est une phrase adressée au modèle
 * (Annexe A.9), réutilisée telle quelle dans le message de seconde tentative.
 */

export interface CheckablePost {
  title: string;
  hookText?: string;
  hookVisual?: string;
  storyboard?: { planNumber: number; description: string }[];
  caption: string;
  hashtags: string[];
  usedExcerpts: string[];
}

export interface CheckContext {
  platform: string;
  contentType: "visual" | "text";
  visual?: VisualFormatSpec | null;
  /** Texte annoté des documents fournis au modèle (les marqueurs [déjà utilisé] sont retirés ici). */
  materialTexts: string[];
  /** Liste « À bannir » apprise du style de l'auteur. */
  avoid: string[];
  /** Fiches des derniers posts du sujet, du plus récent au plus ancien (docs/SPEC_MEMOIRE_ET_VEILLE.md §2). */
  recentPosts?: RecentPostCard[];
}

/** Minuscules, sans accents, apostrophes et espaces unifiés. */
export function normalizeForCheck(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[’‘`]/g, "'")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

// Annexe A.8 : chaque motif correspond à une règle de <ecriture>, sur du texte normalisé.
const BANNED_PATTERNS: Array<{ label: string; re: RegExp }> = [
  // Virgule exigée : « ce n'est pas encore fini mais c'est utilisable » n'est pas la tournure visée.
  { label: "ce n'est pas …, c'est …", re: /ce n'est pas [^.!?,]{1,60}, c'est\b/ },
  { label: "plus qu'un …, un …", re: /plus qu'une? [^.!?]{1,60}?, une?\b/ },
  { label: "vous êtes-vous déjà demandé", re: /vous etes-vous deja demande/ },
  { label: "découvrez", re: /\bdecouvrez\b/ },
  { label: "n'hésitez pas", re: /n'hesitez pas/ },
  { label: "dans un monde où", re: /dans un monde ou\b/ },
  { label: "prêt à passer au niveau supérieur", re: /pret a passer au niveau superieur/ },
  { label: "spoiler :", re: /\bspoiler ?:/ },
  { label: "le résultat ?", re: /le resultat ?\?/ },
  { label: "game changer", re: /game[- ]?changer/ },
  { label: "révolutionnaire", re: /revolutionnaire/ },
];
const OPENING_QUESTION = { label: "et si… ? en ouverture", re: /^et si\b/ };

const USED_MARKERS = /\[déjà utilisé dans un post précédent\]|\[\/déjà utilisé\]/g;
// Cherché sur du texte normalisé : « [a completer] » sans accent compte aussi.
const GAP_RE = /\[a completer\]/g;
const MAX_GAPS = 2;

function postTextFields(post: CheckablePost): Array<{ field: string; text: string }> {
  return [
    { field: "le titre", text: post.title },
    ...(post.hookText ? [{ field: "l'accroche", text: post.hookText }] : []),
    ...(post.storyboard ?? []).map((s) => ({ field: `la slide ${s.planNumber}`, text: s.description })),
    { field: "le texte", text: post.caption },
  ];
}

function bannedPhraseFailures(post: CheckablePost, avoid: string[]): string[] {
  const failures: string[] = [];
  for (const { field, text } of postTextFields(post)) {
    const normalized = normalizeForCheck(text);
    for (const { label, re } of BANNED_PATTERNS) {
      if (re.test(normalized)) failures.push(`Tournure interdite : « ${label} » dans ${field}.`);
    }
    for (const item of avoid) {
      const needle = normalizeForCheck(item);
      if (needle && normalized.includes(needle)) failures.push(`Tournure que l'auteur bannit : « ${item} » dans ${field}.`);
    }
  }
  const opening = normalizeForCheck(post.hookText || post.caption);
  if (OPENING_QUESTION.re.test(opening)) failures.push(`Tournure interdite : « ${OPENING_QUESTION.label} ».`);
  return failures;
}

/** Longueur du texte publié : l'accroche d'un post texte est sa première phrase, comptée si la légende ne la contient pas déjà. */
function publishedTextLength(post: CheckablePost): number {
  if (!post.hookText || post.caption.includes(post.hookText.trim())) return post.caption.length;
  return post.hookText.length + 1 + post.caption.length;
}

function lengthFailures(post: CheckablePost, ctx: CheckContext): string[] {
  const limits = platformLimits(ctx.platform);
  if (!limits) return [];
  const failures: string[] = [];
  if (limits.hookIsTitle) {
    if (post.title.length > limits.hookMax) {
      failures.push(`Le titre fait ${post.title.length} caractères, ${ctx.platform} en affiche ${limits.hookMax} au plus.`);
    }
  } else if (post.hookText && post.hookText.length > limits.hookMax) {
    failures.push(`L'accroche fait ${post.hookText.length} caractères, ${ctx.platform} en affiche ${limits.hookMax} avant « voir plus ».`);
  }
  const visualOnly = ctx.contentType === "visual" && ctx.visual?.withText === false;
  const length = publishedTextLength(post);
  const [min, max] = visualOnly ? [0, VISUAL_ONLY_CAPTION_MAX] : [limits.captionMin, limits.captionMax];
  if (length < min || length > max) {
    failures.push(`Le texte fait ${length} caractères, attendu entre ${min} et ${max}.`);
  }
  const tags = post.hashtags.length;
  if (tags < limits.hashtagsMin || tags > limits.hashtagsMax) {
    failures.push(`${tags} hashtags, attendu entre ${limits.hashtagsMin} et ${limits.hashtagsMax}.`);
  }
  return failures;
}

function citationFailures(post: CheckablePost, ctx: CheckContext): string[] {
  if (post.usedExcerpts.length === 0 || ctx.materialTexts.length === 0) return [];
  const sources = ctx.materialTexts.map((t) => t.replace(USED_MARKERS, ""));
  const found = post.usedExcerpts.some((excerpt) => sources.some((source) => findBestMatchInText(excerpt, source)));
  return found ? [] : ["Aucune des citations de usedExcerpts ne se retrouve dans la matière : cite les passages mot pour mot."];
}

function gapFailures(post: CheckablePost): string[] {
  const gaps = postTextFields(post).reduce((n, { text }) => n + (normalizeForCheck(text).match(GAP_RE) ?? []).length, 0);
  return gaps > MAX_GAPS ? [`${gaps} « [à compléter] », ${MAX_GAPS} au plus.`] : [];
}

function selfCheckFailures(prep: GenerationPrep | null): string[] {
  if (!prep) return [];
  const { selfCheck } = prep;
  const failures: string[] = [];
  if (!selfCheck.factsFromMaterial) failures.push("Ta relecture signale un problème : un fait ne vient pas du contexte fourni.");
  if (selfCheck.bannedPhrasesFound.length > 0) {
    failures.push(`Ta relecture signale un problème : tournures interdites relevées (${selfCheck.bannedPhrasesFound.join(", ")}).`);
  }
  if (normalizeForCheck(selfCheck.readerTest).replace(/[«»".]/g, "").trim() === "aucune") {
    failures.push("Ta relecture signale un problème : le lecteur visé n'a aucune raison de s'arrêter sur ce post.");
  }
  if (!selfCheck.authorTest) failures.push("Ta relecture signale un problème : le post ne sonne pas comme l'auteur.");
  return failures;
}

/** Répétition avec les derniers posts du sujet (docs/SPEC_MEMOIRE_ET_VEILLE.md §2, Annexe A.4). */
function repetitionFailures(post: CheckablePost, prep: GenerationPrep | null, recent: RecentPostCard[]): string[] {
  if (recent.length === 0) return [];
  const failures: string[] = [];
  const hook = post.hookText || post.storyboard?.[0]?.description || "";
  const opening = hookOpening(hook);
  const repeated = opening ? recent.find((c) => c.hook && hookOpening(c.hook) === opening) : undefined;
  if (repeated?.hook) failures.push(`L'accroche reprend celle d'un post récent (« ${repeated.hook} ») : trouve une autre entrée.`);
  const kind = prep ? prep.hookOptions[prep.chosenHook.index]?.kind?.trim().toLowerCase() : undefined;
  const [last, beforeLast] = recent;
  if (kind && last?.hookKind === kind && beforeLast?.hookKind === kind) {
    failures.push(`Les deux derniers posts ouvraient déjà sur une accroche de type « ${kind} » : choisis un autre type.`);
  }
  return failures;
}

/** Tous les contrôles du §5. Vide = le post passe. */
export function checkGeneratedPost(post: CheckablePost, prep: GenerationPrep | null, ctx: CheckContext): string[] {
  const storyboard =
    ctx.contentType === "visual" && post.storyboard ? enforceStoryboardCount(post.storyboard, ctx.visual) : null;
  return [
    ...bannedPhraseFailures(post, ctx.avoid),
    ...lengthFailures(post, ctx),
    ...citationFailures(post, ctx),
    ...gapFailures(post),
    ...repetitionFailures(post, prep, ctx.recentPosts ?? []),
    ...(storyboard?.reminder ? [storyboard.reminder] : []),
    ...selfCheckFailures(prep),
  ];
}

/** Bloc <refus> ajouté au message de la seconde tentative (Annexe A.9). */
export function buildRefusalBlock(failures: string[]): string {
  return `<refus>\nTa version précédente a été refusée :\n${failures.map((f) => `- ${f}`).join("\n")}\nRédige le post complet à nouveau en corrigeant ces points. Garde ta préparation si elle reste juste.\n</refus>`;
}
