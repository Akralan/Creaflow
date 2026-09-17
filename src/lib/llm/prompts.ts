import { buildStyleBlock, type StyleProfile } from "./styleProfile";

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

// Règles de rédaction communes (anti-clichés, concret > abstrait) — docs/SPEC_PROMPT_GENERATION_TECH.md
// §3.3/Annexe A.1. Partagées entre la génération complète (interpolées ci-dessous dans
// SCRIPT_SYSTEM_PROMPT, donc héritées telles quelles par la régénération de bloc, cf. §1 tableau
// "Portée des règles") et les gestes qui n'ont pas de system prompt complet : sélection→instruction
// (microEdit.ts) et proposition d'épisodes de série (materialEpisodes.ts).
export const EDITORIAL_WRITING_RULES = `Règles de rédaction :
- Le concret bat l'abstrait : un détail daté, chiffré ou nommé vaut mieux que trois généralités.
- Écris comme la personne parle à ses clients ou à ses pairs, pas comme une marque qui communique.
- Registre marketing creux interdit : formules d'annonce ("Découvrez", "N'hésitez pas à", "Prêt à passer au niveau supérieur ?"), questions rhétoriques vides, superlatifs sans preuve, accumulation d'emojis.`;

// v2 (docs/SPEC_PROMPT_GENERATION_TECH.md §3.1, texte Annexe A.2 — reconcilié avec le champ outil
// "concept" depuis le Lot 2, §4.1 ; la version Lot 1 paraphrasait cette règle faute de champ existant).
export const SCRIPT_SYSTEM_PROMPT = `Tu es le Directeur Marketing Virtuel de CreaFlow. Tu produis, pour des créateurs, artisans, freelances et petites entreprises de tout métier, du contenu social media prêt à publier. Ton obsession est la spécificité : un post qui pourrait être publié tel quel par un concurrent est un échec.

Règles de qualité :
- Un script porte UNE seule idée, formulée dans le champ "concept" avant tout le reste. Si deux messages cohabitent, garde le plus fort et abandonne l'autre.
- Tu sélectionnes, tu ne couvres pas : choisis LE moment le plus fort de la matière fournie (un échec, une décision, un chiffre, une percée) et ignore délibérément le reste. Ce que tu n'utilises pas aujourd'hui servira aux prochains posts — le marquage [déjà utilisé] le garantit, rien n'est perdu.
- L'accroche crée un manque — une tension, un chiffre inattendu, une affirmation contre-intuitive tirés du contexte fourni. Elle n'annonce jamais le sujet.
- Chaque script contient au moins un élément que seul ce créateur peut dire. Si ce n'est pas le cas de ton brouillon, retourne puiser dans la matière fournie avant de répondre.

${EDITORIAL_WRITING_RULES}

Interdits :
- Tu n'inventes JAMAIS une information factuelle (nom, chiffre, date, anecdote, résultat...) absente du contexte fourni. Si la matière est pauvre, resserre l'ambition du post autour de ce que tu sais plutôt que de combler les trous ; en dernier recours, écris "[à compléter]" à la place d'une précision indispensable — jamais plus de deux fois par script.
- Le champ "usedExcerpts" de l'outil est obligatoire dans tous les cas : renvoie les passages copiés mot pour mot que tu as réellement utilisés, ou un tableau vide [] si aucune matière ne t'a été fournie. Ne l'omets jamais.`;

export interface ScriptGenerationContext {
  creatorProfile: {
    brandName: string;
    activityType: string;
    tone?: string | null;
    values?: string | null;
    equipment?: string[] | null;
    weeklyTimeAvailable?: string | null;
    /** Audience de marque (docs/SPEC_PROMPT_GENERATION_TECH.md §2/§5) — fallback quand product.targetAudience est absent. */
    targetAudience?: string | null;
  };
  styleProfile?: StyleProfile | null;
  product?: {
    name: string;
    description?: string | null;
    valueProposition?: string | null;
    /** Override d'audience par sujet — prime sur creatorProfile.targetAudience quand renseigné. */
    targetAudience?: string | null;
  } | null;
  platform: Platform;
  contentCategory: ContentCategoryContext;
  contentType: ContentType;
  /** Titres des scripts récents de l'utilisateur (tous statuts), pour éviter de reproposer les mêmes angles. */
  recentTopics?: string[];
  /** Résumé de ce qui performe le mieux récemment sur cette plateforme (métriques saisies manuellement). */
  performanceSummary?: string | null;
  /** Concepts déjà proposés et refusés pour CE script via "autre idée, même brief"
   *  (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — absent/vide en génération normale. Seuls les 5 plus
   *  récents sont réellement injectés dans le message (§6.3, tronqué dans buildScriptUserMessage),
   *  ce tableau peut en contenir davantage. */
  rejectedConcepts?: string[];
  /** Angle imposé par le système (mécanisme anti-répétition, invisible pour l'utilisateur). */
  angle?: { id: string; label: string; description: string } | null;
  /** Série récurrente à laquelle ce script appartient, le cas échéant. */
  series?: { id: string; label: string; description: string } | null;
  /** Photo de marque sélectionnée par recherche sémantique (contentType "visual" uniquement),
   *  cf. docs/SPEC_RESSOURCES_VISUELLES.md §5.3/§7. */
  brandAsset?: { id: string; aiDescription: string; tags: string[] | null } | null;
  /** Documents de matière brute du sujet, injectés tels quels (docs/SPEC_MATIERE_EDITEUR.md §3) — le
   *  LLM décide lui-même quoi utiliser, aucune présélection côté serveur. `annotatedText` entoure les
   *  passages déjà cités par des générations précédentes de marqueurs `[déjà utilisé]...[/déjà utilisé]`. */
  materialDocuments?: Array<{ id: string; title: string | null; annotatedText: string }>;
  /** Directive d'épisode pour une génération de série depuis la matière (§3.8) — le sous-thème que
   *  ce script doit couvrir au sein de la série, le LLM pioche lui-même dans materialDocuments. */
  episodeDirective?: { episodeTitle: string; angleHint: string } | null;
  /** Idée soufflée par le créateur sur une porte de génération (docs/SPEC_REDACTEUR_EN_CHEF.md Lot A,
   *  Annexe B.4) — une graine à interpréter, jamais à copier ni une source de faits. Rendue dans le
   *  message uniquement quand `direction` est absente (§4.1 : le chef l'absorbe dans son concept
   *  quand il est actif — "détour d'arc assumé"). */
  directive?: string | null;
  /** Direction éditoriale du chef (docs/SPEC_REDACTEUR_EN_CHEF.md §3.3/§4.1), résolue par
   *  `resolveDailyDirection` (narrativeDirector.ts) avant l'assemblage du message. `null` = pas de
   *  chef actif pour ce sujet (pas de NarrativeState, erreur silencieuse, ou flag désactivé) —
   *  pipeline actuel inchangé dans ce cas. `materialDocuments` est déjà restreint aux `focusDocIds`
   *  par l'appelant quand `direction` est présente (mécanique de citation inchangée). */
  direction?: {
    /** Id de l'état narratif concerné — traçabilité pour markBeatDrafted après génération, ne sert
     *  pas à l'assemblage du message. */
    stateId: string;
    beatId: string | null;
    /** Titre du beat choisi, résolu côté service (le tool choose_daily_direction ne renvoie que
     *  l'id) — null si beatId est null. */
    beatTitle: string | null;
    concept: string;
    kind: "material" | "pedagogical" | "personal";
    callbackToUse: string | null;
    promiseToHonor: string | null;
    promiseToMake: string | null;
    /** Remplace l'angle choisi par le mécanisme anti-répétition (`angle` ci-dessus, qui devient le
     *  fallback quand ce champ est null) — §4.1. */
    angleHint: string | null;
  } | null;
  /** Sujet effectivement utilisé pour lire la matière et scoper les citations (buildGenerationContext,
   *  scriptService.ts) — le `productId` explicite de la requête, ou à défaut le sujet lié à la série
   *  (`ContentSeries.productId`, sélecteur de sujet). À utiliser pour `Script.productId`/les citations
   *  à la création, au lieu du `productId` brut de la requête, pour rester cohérent avec la matière
   *  effectivement lue par cette génération. */
  resolvedProductId?: string | null;
}

// v2 (docs/SPEC_PROMPT_GENERATION_TECH.md §3.2, texte Annexe A.3) : données séparées des consignes,
// blocs balisés à ordre fixe. Deux blocs de l'annexe ne sont pas encore rendus ici — "Audience visée"
// (Product.targetAudience / CreatorProfile.targetAudience, Lot 4, §5) et la ligne rejectedConcepts du
// bloc [VARIÉTÉ] (Lot 3, §6) — ces champs n'existent pas encore sur ScriptGenerationContext ; ils
// s'ajouteront au bloc concerné sans changer la structure une fois ces lots livrés. Contrairement à
// v1, la ligne finale "Génère le contenu via l'outil fourni..." est supprimée (redondante avec le
// tool calling forcé, cf. §3.2).
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
    direction,
  } = context;

  const sections: string[] = [];

  // === CONTEXTE MARQUE ===
  const brandLines: string[] = [`Marque : ${creatorProfile.brandName} (${creatorProfile.activityType})`];
  // Override par sujet en priorité, fallback marque (docs/SPEC_PROMPT_GENERATION_TECH.md §2/§5).
  const targetAudience = product?.targetAudience ?? creatorProfile.targetAudience;
  if (targetAudience) brandLines.push(`Audience visée : ${targetAudience}`);
  if (creatorProfile.tone) brandLines.push(`Ton : ${creatorProfile.tone}`);
  if (creatorProfile.values) brandLines.push(`Valeurs : ${creatorProfile.values}`);
  if (creatorProfile.equipment?.length) {
    brandLines.push(`Matériel disponible : ${creatorProfile.equipment.join(", ")}`);
  }
  if (creatorProfile.weeklyTimeAvailable) {
    brandLines.push(`Temps disponible par semaine : ${creatorProfile.weeklyTimeAvailable}`);
  }
  sections.push(`=== CONTEXTE MARQUE ===\n${brandLines.join("\n")}`);

  // === STYLE === (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4) : voix + règles apprises des corrections
  // de l'auteur, filtrées sur la plateforme cible. Même bloc que dans les micro-retouches.
  const styleBlock = buildStyleBlock(styleProfile, platform);
  if (styleBlock) sections.push(styleBlock);

  // === DIRECTION ÉDITORIALE === (Annexe B.3, docs/SPEC_REDACTEUR_EN_CHEF.md §4.1 — entre CONTEXTE
  // MARQUE et MATIÈRE) : le chef a choisi l'épisode du jour, le rédacteur l'exécute plutôt que de
  // choisir une autre histoire.
  if (direction) {
    const directionLines: string[] = [
      "La direction éditoriale a choisi l'épisode du jour. Ta mission est de l'exécuter, pas de choisir une autre histoire.",
    ];
    if (direction.beatTitle) directionLines.push(`Épisode : ${direction.beatTitle}`);
    directionLines.push(`Direction : ${direction.concept}`);
    directionLines.push(
      `Ton champ "concept" doit décliner cette direction en décision d'exécution — comment tu la racontes sur cette plateforme — jamais la remplacer par une autre idée.`
    );
    if (direction.callbackToUse) directionLines.push(`Callback à replacer naturellement : ${direction.callbackToUse}`);
    if (direction.promiseToHonor) directionLines.push(`Promesse à honorer dans ce post : ${direction.promiseToHonor}`);
    if (direction.promiseToMake) directionLines.push(`Promesse à faire en fin de post : ${direction.promiseToMake}`);
    if (direction.kind === "pedagogical") {
      directionLines.push(
        `Épisode pédagogique décidé par la direction éditoriale : tu peux utiliser le savoir général du domaine (définitions, concepts, ordres de grandeur publics) pour expliquer. Les faits spécifiques au créateur, à son projet ou à ses résultats restent soumis à la règle stricte : uniquement ce qui est dans le contexte fourni.`
      );
    } else if (direction.kind === "personal") {
      directionLines.push(
        `Épisode de présentation personnelle décidé par la direction éditoriale : la source est le contexte marque (identité, activité, valeurs, audience), pas la matière documentaire. La règle stricte reste entière : rien d'inventé au-delà de ce contexte — si un élément personnel manque, écris "[à compléter]".`
      );
    }
    sections.push(`=== DIRECTION ÉDITORIALE ===\n${directionLines.join("\n")}`);
  }

  // === MATIÈRE ===
  if (materialDocuments?.length) {
    const combined = materialDocuments
      .map((d) => (d.title ? `[${d.title}]\n${d.annotatedText}` : d.annotatedText))
      .join("\n\n---\n\n");
    sections.push(
      `=== MATIÈRE ===\n` +
        `Matière factuelle disponible sur ce sujet (base-toi dessus en priorité, n'invente rien au-delà). ` +
        `Les passages entourés de [déjà utilisé dans un post précédent]...[/déjà utilisé] ont déjà servi dans un post — ` +
        `évite de les reprendre tels quels, un nouvel angle sur le même fait reste bienvenu :\n${combined}\n\n` +
        `Le champ "usedExcerpts" de l'outil est obligatoire : renseigne-le toujours avec les passages copiés mot pour mot que tu as effectivement utilisés (jamais une reformulation), même un seul suffit s'il n'y en a qu'un.`
    );
  }

  // === BRIEF ===
  const briefLines: string[] = [];
  if (product) {
    briefLines.push(
      `Produit/Sujet concerné : ${product.name}${product.description ? ` — ${product.description}` : ""}${
        product.valueProposition ? ` (proposition de valeur : ${product.valueProposition})` : ""
      }`
    );
  } else {
    briefLines.push("Aucun produit spécifique : script générique sur l'activité de la marque.");
  }
  briefLines.push(`Plateforme cible : ${platform}. ${platformRule(platform)}`);
  briefLines.push(`Catégorie de contenu visée : ${contentCategory.label}. ${contentCategory.description}`);
  if (series) {
    briefLines.push(
      `Série récurrente à respecter (identité et angle de la série — directive forte) : ${series.label} — ${series.description}`
    );
  }
  // direction.angleHint remplace l'angle du mécanisme anti-répétition quand le chef en recommande
  // un ; `angle` (résolu normalement) reste le fallback — chef absent, ou angleHint non fourni pour
  // ce post (§4.1 : "l'angle par défaut du système s'appliquera").
  if (direction?.angleHint) {
    briefLines.push(`Angle à adopter pour ce script (structure/format de hook à respecter) : ${direction.angleHint}`);
  } else if (angle) {
    briefLines.push(
      `Angle à adopter pour ce script (structure/format de hook à respecter) : ${angle.label} — ${angle.description}`
    );
  }
  briefLines.push(`Type de contenu : ${contentType}. ${CONTENT_TYPE_GUIDANCE[contentType]}`);
  if (contentType === "visual" && brandAsset) {
    briefLines.push(
      `Photo de référence disponible dans la bibliothèque de marque (base réelle du visuel — mise en scène uniquement : fond, lumière, cadrage autour du produit réel ; ne décris jamais un produit différent de celui-ci) : ${brandAsset.aiDescription}${
        brandAsset.tags?.length ? ` (mots-clés : ${brandAsset.tags.join(", ")})` : ""
      }`
    );
  }
  if (episodeDirective) {
    briefLines.push(
      `Cet épisode de la série doit se concentrer sur : ${episodeDirective.episodeTitle} — ${episodeDirective.angleHint}`
    );
  }
  // Chemin "sans chef" uniquement (§4.1/§1) : quand une direction existe, le chef a déjà absorbé la
  // directive du créateur dans son concept ("détour d'arc assumé") — ne pas la répéter ici.
  if (!direction && directive) {
    briefLines.push(
      `Idée soufflée par le créateur (interprète-la : c'est une piste et une intention, pas un texte à recopier ni une source de faits — les faits restent soumis aux règles ci-dessus) : ${directive}`
    );
  }
  sections.push(`=== BRIEF ===\n${briefLines.join("\n")}`);

  // === VARIÉTÉ ===
  const varietyLines: string[] = [];
  if (recentTopics?.length) {
    varietyLines.push(
      `Sujets déjà traités récemment (évite de reproposer les mêmes angles, varie les sujets) : ${recentTopics.join(" ; ")}`
    );
  }
  if (performanceSummary) {
    varietyLines.push(`Performance récente observée : ${performanceSummary}`);
  }
  if (rejectedConcepts?.length) {
    // Plafond d'injection (docs/SPEC_PROMPT_GENERATION_TECH.md §6.3) : le tableau stocké peut contenir
    // plus que ça, seuls les 5 plus récents sont envoyés au LLM.
    varietyLines.push(
      `Concepts déjà proposés et refusés pour ce post — propose une idée réellement différente, pas une reformulation : ${rejectedConcepts.slice(-5).join(" ; ")}`
    );
  }
  if (varietyLines.length) {
    sections.push(`=== VARIÉTÉ ===\n${varietyLines.join("\n")}`);
  }

  // === PRIORITÉS === (bloc final, position de poids maximal)
  sections.push(
    `=== PRIORITÉS ===\n` +
      `En cas de tension entre les consignes ci-dessus, l'ordre de priorité est :\n` +
      `1. La vérité factuelle : la matière fournie prime sur tout, rien n'est inventé au-delà.\n` +
      `2. ${
        !direction && directive
          ? "La directive du créateur (à interpréter, jamais à copier), l'identité de la série et l'angle imposé."
          : "L'identité de la série et l'angle imposé."
      }\n` +
      `3. La voix de la marque (style observé, ton, valeurs).\n` +
      `4. Les codes de la plateforme.\n` +
      `Si l'angle imposé ne s'applique pas à la matière disponible, garde l'esprit de l'angle et adapte sa structure plutôt que d'inventer des faits.\n` +
      `Dernière vérification avant de répondre : si ce post pouvait être publié tel quel par un concurrent, il est raté — retourne chercher dans la matière le détail qui le rend unique.`
  );

  return sections.join("\n\n");
}
