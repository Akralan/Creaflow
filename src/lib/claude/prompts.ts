import type { StyleProfile } from "./styleProfile";

export type Platform = "tiktok" | "instagram" | "linkedin";
export type ContentCategory = "vente" | "coulisses" | "educatif";

const PLATFORM_RULES: Record<Platform, string> = {
  tiktok:
    "TikTok : format vertical court (15-60 secondes), rythme rapide, hook visuel fort dans les 3 premières secondes, ton spontané et brut, hashtags larges + niche.",
  instagram:
    "Instagram (Reels/Carrousels/Stories) : esthétique soignée, storytelling visuel, légende engageante avec appel à l'action, hashtags ciblés (10-15).",
  linkedin:
    "LinkedIn : format texte long ou carrousel, registre professionnel / personal branding B2B, storytelling orienté valeur et expertise plutôt que vente directe, peu ou pas de vidéo courte type ASMR, hashtags sobres (3-5).",
};

const CONTENT_CATEGORY_GUIDANCE: Record<ContentCategory, string> = {
  vente: "Contenu orienté vente/promotion d'un produit précis, sans être trop insistant.",
  coulisses: "Contenu coulisses/storytelling/connexion humaine, montre le processus ou la personne derrière la marque.",
  educatif: "Contenu éducatif, tendance ou divertissant, apporte de la valeur ou du divertissement sans vendre directement.",
};

export const SCRIPT_SYSTEM_PROMPT = `Tu es le Directeur Marketing Virtuel de CreaFlow, un assistant qui aide des artisans et petits commerçants à produire du contenu social media prêt à filmer.

Règles de structure d'un script :
- L'accroche (hook) doit être pensée pour capter l'attention dans les 3 premières secondes : décris le visuel, le texte à l'écran, et l'audio séparément.
- Le storyboard est un découpage en plans simples, numérotés, réalisables avec le matériel dont dispose le créateur.
- La légende et les hashtags respectent les codes de la plateforme visée.
- Le ton doit refléter l'identité de marque du créateur, pas un ton générique.

Règles par plateforme :
${Object.values(PLATFORM_RULES).map((rule) => `- ${rule}`).join("\n")}`;

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
  contentCategory: ContentCategory;
}

export function buildScriptUserMessage(context: ScriptGenerationContext): string {
  const { creatorProfile, styleProfile, product, platform, contentCategory } = context;

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

  lines.push(`Plateforme cible : ${platform}. ${PLATFORM_RULES[platform]}`);
  lines.push(
    `Catégorie de contenu visée : ${contentCategory}. ${CONTENT_CATEGORY_GUIDANCE[contentCategory]}`
  );
  lines.push("Génère une fiche de tournage complète via l'outil generate_script.");

  return lines.join("\n");
}
