/**
 * Règles et limites par plateforme (docs/SPEC_PROMPT_GENERATION_V3.md Annexe A.3) — une seule table,
 * lue par le bloc <plateforme> du prompt ET par les contrôles du code (scriptChecks.ts), pour que la
 * consigne et la vérification ne divergent jamais. Les chiffres sont des valeurs de départ, à ajuster
 * à l'usage.
 */

export interface PlatformLimits {
  /** Caractères visibles avant « voir plus » ; porte sur le titre quand `hookIsTitle`. */
  hookMax: number;
  hookIsTitle: boolean;
  captionMin: number;
  captionMax: number;
  hashtagsMin: number;
  hashtagsMax: number;
}

export const PLATFORM_LIMITS: Record<string, PlatformLimits> = {
  linkedin: { hookMax: 200, hookIsTitle: false, captionMin: 600, captionMax: 1500, hashtagsMin: 0, hashtagsMax: 3 },
  x: { hookMax: 120, hookIsTitle: false, captionMin: 0, captionMax: 280, hashtagsMin: 0, hashtagsMax: 1 },
  instagram: { hookMax: 125, hookIsTitle: false, captionMin: 300, captionMax: 1200, hashtagsMin: 3, hashtagsMax: 5 },
  newsletter: { hookMax: 50, hookIsTitle: true, captionMin: 1500, captionMax: 4000, hashtagsMin: 0, hashtagsMax: 0 },
  blog: { hookMax: 60, hookIsTitle: true, captionMin: 4000, captionMax: 10000, hashtagsMin: 0, hashtagsMax: 0 },
};

/** Légende d'un post visuel sans texte (`withText: false`) : le visuel porte le message. */
export const VISUAL_ONLY_CAPTION_MAX = 300;

export function platformLimits(platform: string): PlatformLimits | null {
  return PLATFORM_LIMITS[platform] ?? null;
}

const PLATFORM_TEXTS: Record<string, (l: PlatformLimits) => string> = {
  linkedin: (l) =>
    `LinkedIn. Seules les deux premières lignes (environ ${l.hookMax} caractères) s'affichent avant « voir plus » : elles doivent suffire à donner envie. Corps de ${l.captionMin} à ${l.captionMax} caractères, en paragraphes d'une ou deux phrases séparés par une ligne vide. ${l.hashtagsMin} à ${l.hashtagsMax} hashtags, à la fin. Le registre : quelqu'un qui partage ce qu'il a appris, pas une annonce.`,
  x: (l) =>
    `X. Un post fait au plus ${l.captionMax} caractères, accroche comprise : si l'idée ne tient pas, resserre-la au lieu de la couper. ${l.hashtagsMin} ou ${l.hashtagsMax} hashtag. Ton direct, pas de formule d'introduction.`,
  instagram: (l) =>
    `Instagram. Les ${l.hookMax} premiers caractères de la légende s'affichent seuls : ils portent l'idée. Légende de ${l.captionMin} à ${l.captionMax} caractères. ${l.hashtagsMin} à ${l.hashtagsMax} hashtags précis au sujet, à la fin. Le visuel porte le message, la légende le prolonge.`,
  newsletter: (l) =>
    `Newsletter. Le titre sert d'objet : ${l.hookMax} caractères au plus. Corps de ${l.captionMin} à ${l.captionMax} caractères, sur le ton d'une lettre à quelqu'un qu'on connaît. Aucun hashtag. Un seul lien ou appel à l'action.`,
  blog: (l) =>
    `Blog. Titre de ${l.hookMax} caractères au plus, avec le mot que le lecteur taperait dans un moteur de recherche. Corps de ${l.captionMin} à ${l.captionMax} caractères, avec des intertitres. Aucun hashtag.`,
};

const GENERIC_PLATFORM_TEXT = "Adapte le format et le ton aux codes de cette plateforme, sans reprendre ceux d'une autre.";

/** Texte du bloc <plateforme>. Un post visuel sans texte voit sa limite de légende remplacée. */
export function platformRuleText(platform: string, options?: { visualOnly?: boolean }): string {
  const limits = platformLimits(platform);
  const text = PLATFORM_TEXTS[platform];
  if (!limits || !text) return GENERIC_PLATFORM_TEXT;
  const base = text(limits);
  return options?.visualOnly
    ? `${base} Ici le visuel porte tout : la légende tient en ${VISUAL_ONLY_CAPTION_MAX} caractères au plus, quelle que soit la plateforme.`
    : base;
}
