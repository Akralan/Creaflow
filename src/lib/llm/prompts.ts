import type { StyleProfile } from "./styleProfile";

export type Platform = string;
export type ContentType = "video" | "visual" | "text";

export interface ContentCategoryContext {
  id: string;
  label: string;
  description: string;
}

const DEFAULT_CONTENT_TYPE_BY_PLATFORM: Record<string, ContentType> = {
  tiktok: "video",
  youtube: "video",
  instagram: "visual",
  linkedin: "text",
  x: "text",
  newsletter: "text",
  blog: "text",
};

/** Type de contenu proposé par défaut selon la plateforme, modifiable par l'utilisateur avant génération. */
export function defaultContentTypeForPlatform(platform: string): ContentType {
  return DEFAULT_CONTENT_TYPE_BY_PLATFORM[platform] ?? "text";
}

const CONTENT_TYPE_GUIDANCE: Record<ContentType, string> = {
  video: "Format vidéo : pense l'accroche (visuel, texte à l'écran et audio séparément) et un découpage en plans filmables avec le matériel disponible.",
  visual: "Format visuel statique (image unique ou carrousel) : décris la composition visuelle qui capte l'attention, pas d'audio, pas de plan filmé.",
  text: "Format texte seul, sans visuel : l'accroche est la première phrase du texte.",
};

const PLATFORM_RULES: Record<string, string> = {
  tiktok:
    "TikTok : format vertical court (15-60 secondes), rythme rapide, hook visuel fort dans les 3 premières secondes, ton spontané et brut, hashtags larges + niche.",
  instagram:
    "Instagram (Reels/Carrousels/Stories) : esthétique soignée, storytelling visuel, légende engageante avec appel à l'action, hashtags ciblés (10-15).",
  linkedin:
    "LinkedIn : format texte long ou carrousel, registre professionnel / personal branding B2B, storytelling orienté valeur et expertise plutôt que vente directe, peu ou pas de vidéo courte type ASMR, hashtags sobres (3-5).",
  x: "X (Twitter) : format texte court ou thread, ton direct et incisif, peut inclure une image ou vidéo courte, hashtags rares.",
  youtube: "YouTube (Shorts ou format long) : hook visuel/verbal dès la première seconde, structure narrative plus développée qu'un short TikTok.",
  newsletter: "Newsletter : format texte structuré (objet + corps), ton personnel et direct, pas de hashtags, un seul appel à l'action clair.",
  blog: "Blog / site perso : format article structuré (titre, sous-titres), SEO-friendly, ton plus posé et développé.",
};

const GENERIC_PLATFORM_RULE =
  "Adapte le format et le ton aux codes propres à cette plateforme, sans les codes spécifiques d'une autre.";

function platformRule(platform: string): string {
  return PLATFORM_RULES[platform] ?? GENERIC_PLATFORM_RULE;
}

export const SCRIPT_SYSTEM_PROMPT = `Tu es le Directeur Marketing Virtuel de CreaFlow, un assistant qui aide des créateurs, freelances et petites entreprises à produire du contenu social media prêt à publier, quel que soit leur métier.

Règles de structure d'un script :
- L'accroche (hook) doit être pensée pour capter l'attention dès les premières secondes ou les premiers mots.
- Le contenu est découpé en étapes simples, réalisables avec les ressources dont dispose le créateur.
- La légende et les hashtags (si pertinents pour la plateforme) respectent les codes de la plateforme visée.
- Le ton doit refléter l'identité de marque du créateur, pas un ton générique.`;

export interface ScriptGenerationContext {
  creatorProfile: {
    brandName: string;
    activityType: string;
    tone?: string | null;
    values?: string | null;
    equipment?: string[] | null;
    weeklyTimeAvailable?: string | null;
  };
  styleProfile?: StyleProfile | null;
  product?: {
    name: string;
    description?: string | null;
    valueProposition?: string | null;
  } | null;
  platform: Platform;
  contentCategory: ContentCategoryContext;
  contentType: ContentType;
  /** Titres des scripts récents de l'utilisateur (tous statuts), pour éviter de reproposer les mêmes angles. */
  recentTopics?: string[];
  /** Résumé de ce qui performe le mieux récemment sur cette plateforme (métriques saisies manuellement). */
  performanceSummary?: string | null;
  /** Angle imposé par le système (mécanisme anti-répétition, invisible pour l'utilisateur). */
  angle?: { id: string; label: string; description: string } | null;
  /** Série récurrente à laquelle ce script appartient, le cas échéant. */
  series?: { id: string; label: string; description: string } | null;
  /** Photo de marque sélectionnée par recherche sémantique (contentType "visual" uniquement),
   *  cf. docs/SPEC_RESSOURCES_VISUELLES.md §5.3/§7. */
  brandAsset?: { id: string; aiDescription: string; tags: string[] | null } | null;
}

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
    angle,
    series,
    brandAsset,
  } = context;

  const lines: string[] = [
    `Marque : ${creatorProfile.brandName} (${creatorProfile.activityType})`,
  ];

  if (creatorProfile.tone) lines.push(`Ton : ${creatorProfile.tone}`);
  if (creatorProfile.values) lines.push(`Valeurs : ${creatorProfile.values}`);
  if (creatorProfile.equipment?.length) {
    lines.push(`Matériel disponible : ${creatorProfile.equipment.join(", ")}`);
  }
  if (creatorProfile.weeklyTimeAvailable) {
    lines.push(`Temps disponible par semaine : ${creatorProfile.weeklyTimeAvailable}`);
  }

  if (styleProfile) {
    lines.push(
      `Style de communication observé (à respecter) : ${styleProfile.summary}`
    );
  }

  if (product) {
    lines.push(
      `Produit concerné : ${product.name}${product.description ? ` — ${product.description}` : ""}${
        product.valueProposition ? ` (proposition de valeur : ${product.valueProposition})` : ""
      }`
    );
  } else {
    lines.push("Aucun produit spécifique : script générique sur l'activité de la marque.");
  }

  lines.push(`Plateforme cible : ${platform}. ${platformRule(platform)}`);

  lines.push(`Catégorie de contenu visée : ${contentCategory.label}. ${contentCategory.description}`);

  if (series) {
    lines.push(
      `Série récurrente à respecter (identité et angle de la série — directive forte) : ${series.label} — ${series.description}`
    );
  }

  if (angle) {
    lines.push(
      `Angle à adopter pour ce script (structure/format de hook à respecter) : ${angle.label} — ${angle.description}`
    );
  }

  lines.push(`Type de contenu : ${contentType}. ${CONTENT_TYPE_GUIDANCE[contentType]}`);

  if (contentType === "visual" && brandAsset) {
    lines.push(
      `Photo de référence disponible dans la bibliothèque de marque (base réelle du visuel — mise en scène uniquement : fond, lumière, cadrage autour du produit réel ; ne décris jamais un produit différent de celui-ci) : ${brandAsset.aiDescription}${
        brandAsset.tags?.length ? ` (mots-clés : ${brandAsset.tags.join(", ")})` : ""
      }`
    );
  }

  if (recentTopics?.length) {
    lines.push(
      `Sujets déjà traités récemment (évite de reproposer les mêmes angles, varie les sujets) : ${recentTopics.join(" ; ")}`
    );
  }

  if (performanceSummary) {
    lines.push(`Performance récente observée : ${performanceSummary}`);
  }

  lines.push("Génère le contenu via l'outil fourni, en respectant strictement son format.");

  return lines.join("\n");
}
