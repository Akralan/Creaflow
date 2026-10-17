import { buildStyleBlock, type StyleProfile } from "./styleProfile";
import { platformRuleText } from "./platformRules";
import type { Reader } from "./readerPortrait";
import type { RecentPostCard } from "./recentPosts";
import type { ChosenVoice, FramingChoice, SeriesFraming } from "./seriesFraming";
import { buildFormatBlock, type VisualFormatSpec } from "@/lib/visualDesign/visualFormat";
import type { EventBrief } from "./eventWriter";

export type Platform = string;
export type ContentType = "visual" | "text";

export interface ContentCategoryContext {
  id: string;
  label: string;
  description: string;
}

const DEFAULT_CONTENT_TYPE_BY_PLATFORM: Record<string, ContentType> = {
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
  visual: "post visuel (image unique, carrousel ou animation courte), sans audio : décris la composition qui capte l'attention.",
  text: "texte seul, sans visuel : l'accroche est la première phrase du texte.",
};

// Règles de rédaction des gestes qui n'ont pas le system prompt complet : sélection→instruction
// (microEdit.ts). La génération complète et la régénération de bloc ont les leurs, plus détaillées,
// dans SCRIPT_CORE_PROMPT (docs/SPEC_PROMPT_GENERATION_V3.md Annexe A.1).
export const EDITORIAL_WRITING_RULES = `Règles de rédaction :
- Le concret bat l'abstrait : un détail daté, chiffré ou nommé vaut mieux que trois généralités.
- Écris comme la personne parle à ses clients ou à ses pairs, pas comme une marque qui communique.
- Registre marketing creux interdit : formules d'annonce ("Découvrez", "N'hésitez pas à", "Prêt à passer au niveau supérieur ?"), questions rhétoriques vides, superlatifs sans preuve, accumulation d'emojis.`;

// docs/SPEC_PROMPT_GENERATION_V3.md Annexe A.1, verbatim — commun à la génération complète et à la
// régénération d'un bloc (microEditService.ts).
export const SCRIPT_CORE_PROMPT = `Tu es le ghostwriter d'une personne qui construit quelque chose — un logiciel, un jeu, un produit, un savoir-faire — et qui raconte ce qu'elle construit sur les réseaux. Tu écris à sa place, avec sa voix, à partir de sa vraie matière de travail. Tu n'es ni une marque ni un service marketing : tu es cette personne, un jour où elle a le temps de bien écrire.

Un post réussi passe deux tests à la fois :
- le lecteur visé s'arrête de scroller, parce que le post parle de ce qui l'intéresse, à son niveau ;
- les gens qui connaissent l'auteur croiraient qu'il l'a écrit lui-même.
Le premier test seul donne un post de marketeur. Le second seul donne une transcription de notes. Il faut les deux.

<faits>
- Tout fait propre à l'auteur, à son projet ou à ses résultats (nom, chiffre, date, anecdote, décision, résultat) vient du contexte fourni. Rien d'autre.
- Si la matière est pauvre, réduis l'ambition du post à ce que tu sais. En dernier recours, écris "[à compléter]" à la place d'une précision indispensable, jamais plus de deux fois.
- N'ajoute ni émotion, ni promesse, ni date, ni détail personnel que l'auteur n'a pas exprimé, même pour rendre le post plus chaleureux.
- Le savoir général du domaine (définitions, ordres de grandeur publics) n'est permis que dans un épisode pédagogique décidé par la direction éditoriale.
</faits>

<ecriture>
- Une seule idée par post. Si deux messages cohabitent, garde le plus fort et abandonne l'autre.
- Le concret bat l'abstrait : un détail daté, chiffré ou nommé vaut mieux que trois généralités.
- Écris avec les mots du lecteur visé et à son niveau : ne vulgarise pas pour des experts, ne jargonne pas pour des débutants.
- L'accroche ouvre une tension tirée de la matière : un chiffre inattendu, un aveu, une affirmation contre-intuitive, un avant/après, une scène. Elle n'annonce jamais le sujet ("Aujourd'hui je vous parle de…").
- Phrases courtes, verbes actifs, première personne. Un seul appel à l'action, à la fin, et seulement s'il sert le lecteur.
- Tournures interdites, et ce qu'on écrit à la place :
  - "Ce n'est pas X, c'est Y", "Plus qu'un X, un Y" → affirme Y directement.
  - Une question rhétorique en ouverture ("Et si… ?", "Vous êtes-vous déjà demandé… ?") → le fait qui y répond.
  - "Découvrez", "N'hésitez pas à", "Prêt à passer au niveau supérieur ?", "Dans un monde où…", "Spoiler :", "Le résultat ? …" → rien : commence par le fait.
  - Les triplets rythmés ("Plus rapide. Plus simple. Plus fort.") et les listes de trois adjectifs → un seul détail précis.
  - Les superlatifs sans preuve ("incroyable", "révolutionnaire", "game changer", "véritable") → le chiffre ou le fait qui le prouverait.
  - Les emojis en guise de puces ou en fin de phrase → aucun, sauf si le style de l'auteur en emploie.
</ecriture>

<exemples>
Accroches. Dans chaque paire, même lecteur et même matière. Les noms et les chiffres sont fictifs : ne les réutilise jamais.

Lecteur : des développeurs. Matière : un refactor qui a supprimé du code.
Mauvais : « Aujourd'hui, je vous parle du grand refactor de mon app 🚀 »
Bon : « J'ai supprimé 4 000 lignes cette semaine. L'app démarre deux fois plus vite. »
Pourquoi : le bon donne le fait et le résultat ; le mauvais annonce un sujet et laisse le lecteur décider seul s'il s'y intéresse.

Lecteur : des joueurs. Matière : le saut du personnage a été retravaillé.
Mauvais : « Et si le saut était la mécanique la plus importante d'un jeu de plateforme ? »
Bon : « Le saut de Mira restait 80 ms de trop en l'air. Personne ne savait dire pourquoi le jeu semblait mou. Voici l'avant et l'après. »
Pourquoi : les joueurs veulent la sensation et la preuve à l'écran, pas une question de game designer.

Lecteur : d'autres développeurs de jeux. Même matière.
Bon : « 6 frames de coyote time et une gravité doublée à la descente : le saut de Mira a enfin l'air vif. »
Pourquoi : même fait, autre lecteur. Ici on donne le réglage, c'est ce que les pairs viennent chercher.
</exemples>

<priorites>
En cas de conflit entre les consignes, dans cet ordre :
1. La vérité des faits.
2. Ce que l'auteur a demandé pour ce post et pour cette série (idée soufflée, direction éditoriale, cadrage choisi).
3. Les règles de style apprises de ses corrections.
4. Le lecteur visé.
5. L'identité de la série et l'angle imposé. Si l'angle ne s'applique pas à la matière, garde son esprit et adapte sa structure plutôt que d'inventer.
6. Les codes de la plateforme.
</priorites>`;

// Annexe A.2, verbatim — génération complète seulement : les outils de régénération de bloc n'ont
// pas les champs de préparation.
export const SCRIPT_METHOD_PROMPT = `<methode>
Tu remplis les champs de l'outil dans l'ordre. Les premiers sont ta préparation : ils ne seront jamais publiés, ils servent à bien choisir avant d'écrire.
1. reader — Pour CE post, sur CETTE plateforme, quel lecteur vises-tu parmi ceux qui te sont décrits ? Ce qu'il sait déjà, ce qu'il vient chercher. Si la direction éditoriale a choisi le public, c'est lui.
2. candidateMoments — Jusqu'à 5 moments de la matière qui peuvent intéresser CE lecteur, chacun avec le passage exact qui le prouve. N'en invente pas pour atteindre un nombre.
3. chosenMoment — Celui que tu gardes, et pourquoi : le plus fort pour ce lecteur, pas déjà utilisé, compatible avec le rôle, la série et la direction.
4. concept — Ce que le lecteur doit retenir ou faire après lecture.
5. hookOptions puis chosenHook — 2 ou 3 accroches de types différents, puis celle que tu gardes et pourquoi elle arrêtera CE lecteur.
5 bis. inspirationsUsed et inspirationsToDrop — Si un bloc <inspiration> t'est fourni : celles qui t'ont servi pour la forme, et celles qui ne serviront JAMAIS à ce sujet (public étranger, conseil générique, hors sujet). Une fiche qui ne sert pas à CE post servira peut-être au suivant : ne la retire pas pour ça. Tableaux vides sinon.
6. Le post, construit à partir de chosenMoment, concept et chosenHook.
7. selfCheck — Relis le post comme le lecteur visé, puis comme quelqu'un qui connaît l'auteur. Réponds franchement : un point raté signalé sera corrigé par une nouvelle rédaction, un point raté caché sera publié.
</methode>`;

export const SCRIPT_SYSTEM_PROMPT = `${SCRIPT_CORE_PROMPT}\n\n${SCRIPT_METHOD_PROMPT}`;

/** Fiche d'inspiration telle que montrée au modèle (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3). */
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
    /** Réponse libre à « Qu'est-ce que tu attends de nous ? » (docs/SPEC_ONBOARDING_MVP.md §3). */
    expectations?: string | null;
    /** Audience de marque — dernier repli quand le sujet n'a ni portrait ni « Pour qui ». */
    targetAudience?: string | null;
  };
  styleProfile?: StyleProfile | null;
  product?: {
    name: string;
    description?: string | null;
    valueProposition?: string | null;
    /** « Pour qui » du sujet — prime sur creatorProfile.targetAudience quand renseigné. */
    targetAudience?: string | null;
  } | null;
  /** Portrait des lecteurs du sujet (docs/SPEC_PROMPT_GENERATION_V3.md §2.2), le principal en
   *  premier — prime sur les deux audiences texte. */
  readers?: Reader[] | null;
  /** Publics visés par les derniers posts du sujet, du plus récent au plus ancien (§2.3) — pour
   *  alterner quand le chef ne choisit pas. */
  recentReaderLabels?: string[];
  /** Fiches des derniers posts du sujet, du plus récent au plus ancien (docs/SPEC_MEMOIRE_ET_VEILLE.md §2). */
  recentPosts?: RecentPostCard[];
  /** Cadrage de la série choisi par l'auteur (docs/SPEC_CADRAGE_SERIE.md) — null si pas cadrée. */
  framing?: SeriesFraming | null;
  /** Voix choisie pour le compte au premier cadrage — la série peut la remplacer (framing.voice). */
  chosenVoice?: ChosenVoice | null;
  /** Fiches actives de la veille d'inspiration du sujet, numérotées i1…i10 (docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3). */
  inspirations?: InspirationCard[];
  platform: Platform;
  contentCategory: ContentCategoryContext;
  contentType: ContentType;
  /** Titres des scripts récents de l'utilisateur (tous statuts), pour éviter de reproposer les mêmes angles. */
  recentTopics?: string[];
  /** Résumé de ce qui performe le mieux récemment sur cette plateforme (métriques saisies manuellement). */
  performanceSummary?: string | null;
  /** Concepts déjà proposés et refusés pour CE script via "autre idée, même brief"
   *  (docs/SPEC_PROMPT_GENERATION_TECH.md §6) — absent/vide en génération normale. Seuls les 5 plus
   *  récents sont injectés dans le message. */
  rejectedConcepts?: string[];
  /** Format du post visuel (docs/SPEC_FORMAT_VISUEL_ET_ANIMATION.md) — null hors contentType "visual". */
  visual?: VisualFormatSpec | null;
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
    /** Public visé par ce post, choisi par le chef parmi le portrait (docs/SPEC_PROMPT_GENERATION_V3.md
     *  §2.3) — null sans portrait. */
    readerLabel?: string | null;
  } | null;
  /** Sujet effectivement utilisé pour lire la matière et scoper les citations (buildGenerationContext,
   *  scriptService.ts) — le `productId` explicite de la requête, ou à défaut le sujet lié à la série
   *  (`ContentSeries.productId`, sélecteur de sujet). À utiliser pour `Script.productId`/les citations
   *  à la création, au lieu du `productId` brut de la requête, pour rester cohérent avec la matière
   *  effectivement lue par cette génération. */
  resolvedProductId?: string | null;
  /** Le brief par événement (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §5) : présent quand la série a un
   *  lecteur, une forme et un prochain événement à raconter. La génération passe alors par le
   *  rédacteur agentique (eventWriter.ts) et ignore chef, angle, rôle et inspirations. */
  eventBrief?: EventBrief | null;
}

function tag(name: string, lines: string[]): string {
  return `<${name}>\n${lines.join("\n")}\n</${name}>`;
}

/** Bloc <lecteurs> (Annexe A.3) : toujours présent, il dit au modèle à qui il parle avant tout le reste. */
export function buildReadersBlock(context: Pick<ScriptGenerationContext, "readers" | "recentReaderLabels" | "direction" | "product" | "creatorProfile">): string {
  const lines: string[] = [];
  const readers = context.readers ?? [];
  if (readers.length > 0) {
    lines.push("Les lecteurs de ce sujet (portrait validé ou corrigé par l'auteur, le premier est le principal) :");
    for (const r of readers) {
      const parts = [`- ${r.label} : ${r.who}.`];
      if (r.knows) parts.push(`Sait déjà : ${r.knows}.`);
      if (r.wants) parts.push(`Vient chercher : ${r.wants}.`);
      if (r.stopsFor) parts.push(`S'arrête pour : ${r.stopsFor}.`);
      if (r.turnsOff) parts.push(`Fuit : ${r.turnsOff}.`);
      if (r.words.length > 0) parts.push(`Ses mots : ${r.words.join(", ")}.`);
      lines.push(parts.join(" "));
    }
    if (context.direction?.readerLabel) {
      lines.push(`La direction éditoriale a choisi le public de ce post : ${context.direction.readerLabel}.`);
    } else if (readers.length > 1 && context.recentReaderLabels?.length) {
      lines.push(
        `Publics visés par les derniers posts de ce sujet, du plus récent au plus ancien : ${context.recentReaderLabels.join(", ")}. Varie si le sujet en a plusieurs et si ce post s'y prête.`
      );
    }
  } else {
    const audience = context.product?.targetAudience || context.creatorProfile.targetAudience;
    lines.push(
      audience
        ? `Audience visée : ${audience}`
        : "Aucune audience définie : déduis le lecteur le plus probable de la matière et du sujet, et nomme-le dans reader."
    );
  }
  return tag("lecteurs", lines);
}

const SHORT_DATE = new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", timeZone: "Europe/Paris" });

/** Bloc <cadrage> (docs/SPEC_CADRAGE_SERIE.md Annexe A.4) — vide pour une série pas cadrée. La voix
 *  n'y figure pas : elle est dans <style>, une seule fois. */
export function buildFramingBlock(framing: SeriesFraming | null | undefined): string {
  if (!framing) return "";
  const lines = [
    "Manière choisie par l'auteur pour cette série. Elle s'applique à chaque épisode et prime sur l'angle.",
    `- Posture : ${framing.posture.label} — ${framing.posture.rule}`,
    `- Récit : ${framing.story.label} — ${framing.story.rule}`,
  ];
  if (framing.signature) lines.push(`- Signature (${framing.signature.placement}) : ${framing.signature.text}`);
  const chosen = [framing.posture.sample, framing.story.sample].filter(Boolean);
  if (chosen.length) {
    lines.push("Extraits qu'il a choisis, comme exemples de MANIÈRE (n'en reprends ni les faits ni les formules) :", ...chosen.map((s) => `« ${s} »`));
  }
  const rejected = framing.rejected.slice(0, 3).map((r) => r.sample).filter(Boolean);
  if (rejected.length) lines.push("Extraits qu'il a écartés (à ne pas imiter) :", ...rejected.map((s) => `« ${s} »`));
  return tag("cadrage", lines);
}

/** Bloc <derniers_posts> (docs/SPEC_MEMOIRE_ET_VEILLE.md Annexe A.1) — vide sans post récent. */
export function buildRecentPostsBlock(cards: RecentPostCard[] | undefined): string {
  if (!cards?.length) return "";
  const lines = [
    "Les derniers posts de ce sujet, du plus récent au plus ancien. Ne reprends ni leurs accroches ni leurs fins. Si les deux derniers ouvrent sur le même type d'accroche, choisis-en un autre. Tu peux faire référence à l'un d'eux si ça sert l'histoire (« la semaine dernière… »), sans le répéter.",
  ];
  for (const c of cards) {
    const head = [SHORT_DATE.format(new Date(c.createdAt)), c.platform, c.readerLabel ? `public : ${c.readerLabel}` : null].filter(Boolean).join(" · ");
    const parts = [
      c.moment ? `moment « ${c.moment} »` : null,
      c.hook ? `accroche${c.hookKind ? ` [${c.hookKind}]` : ""} « ${c.hook} »` : null,
      c.ending ? `fin « ${c.ending} »` : null,
    ].filter(Boolean);
    lines.push(`- ${head} : ${parts.join(" · ") || "(post sans texte)"}`);
  }
  return tag("derniers_posts", lines);
}

/** Bloc <inspiration> (docs/SPEC_MEMOIRE_ET_VEILLE.md Annexe A.1) — vide sans fiche active. */
export function buildInspirationBlock(cards: InspirationCard[] | undefined): string {
  if (!cards?.length) return "";
  return tag("inspiration", [
    "Ce qui marche déjà pour ces publics, trouvé en veille. Inspire-toi de la FORME (format, structure, type d'accroche, rythme), jamais du fond : n'en reprends ni chiffre, ni anecdote, ni formule. Tu n'es pas obligé d'en utiliser.",
    ...cards.map((c) => {
      const meta = [c.readerLabel, c.platform, c.kind].filter(Boolean).join(" · ");
      return `- [${c.ref}] (${meta}) ${c.insight} — ${c.url}`;
    }),
    "Dans ta préparation, inspirationsUsed liste celles qui t'ont servi. inspirationsToDrop liste seulement celles qui ne serviront jamais à ce sujet (public étranger, conseil générique, hors sujet), avec la raison : elles seront retirées. Ne retire pas une fiche parce qu'elle ne sert pas à ce post-ci.",
  ]);
}

// docs/SPEC_PROMPT_GENERATION_V3.md §4.2, texte Annexe A.3 : des balises séparent les données
// (matière, profil) des consignes ; <lecteurs> en tête, <rappel> en fin, position de poids maximal.
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

  const sections: string[] = [buildReadersBlock(context)];

  const brandLines = [`Auteur : ${creatorProfile.brandName} — ${creatorProfile.activityType}`];
  if (creatorProfile.expectations) brandLines.push(`Ce que l'auteur attend de CreaFlow : ${creatorProfile.expectations}`);
  sections.push(tag("marque", brandLines));

  // Voix + règles apprises des corrections de l'auteur (docs/SPEC_APPRENTISSAGE_STYLE.md §5.4),
  // filtrées sur la plateforme cible. Même contenu que dans les micro-retouches, autre enveloppe.
  // Voix + règles apprises des corrections, plus la voix choisie au cadrage (celle de la série si elle
  // en a une, sinon celle du compte — docs/SPEC_CADRAGE_SERIE.md §4).
  const styleLines = buildStyleBlock(styleProfile, platform).split("\n").slice(1).filter(Boolean);
  const voice: FramingChoice | null = context.framing?.voice ?? context.chosenVoice ?? null;
  if (voice) {
    styleLines.unshift(`Voix choisie par l'auteur : ${voice.label} — ${voice.rule}${voice.sample ? ` Exemple qu'il a préféré : « ${voice.sample} »` : ""}`);
  }
  if (styleLines.length) sections.push(tag("style", styleLines));

  const framingBlock = buildFramingBlock(context.framing);
  if (framingBlock) sections.push(framingBlock);

  // Le chef a choisi l'épisode du jour, le rédacteur l'exécute (docs/SPEC_REDACTEUR_EN_CHEF.md §4.1).
  if (direction) {
    const lines = ["La direction éditoriale a choisi l'épisode du jour. Exécute-le, ne choisis pas une autre histoire."];
    if (direction.beatTitle) lines.push(`Épisode : ${direction.beatTitle}`);
    lines.push(`Direction : ${direction.concept}`);
    lines.push("Ton concept décline cette direction pour cette plateforme ; il ne la remplace jamais par une autre idée.");
    if (direction.callbackToUse) lines.push(`Callback à replacer naturellement : ${direction.callbackToUse}`);
    if (direction.promiseToHonor) lines.push(`Promesse à honorer dans ce post : ${direction.promiseToHonor}`);
    if (direction.promiseToMake) lines.push(`Promesse à faire en fin de post : ${direction.promiseToMake}`);
    if (direction.kind === "pedagogical") {
      lines.push(
        "Épisode pédagogique : tu peux expliquer avec le savoir général du domaine. Les faits propres à l'auteur restent limités au contexte fourni."
      );
    } else if (direction.kind === "personal") {
      lines.push(
        `Épisode de présentation : la source est le bloc <marque> et le sujet, pas la matière. Si un élément personnel manque, écris "[à compléter]".`
      );
    }
    sections.push(tag("direction", lines));
  }

  if (materialDocuments?.length) {
    const combined = materialDocuments
      .map((d) => (d.title ? `[${d.title}]\n${d.annotatedText}` : d.annotatedText))
      .join("\n---\n");
    sections.push(
      tag("matiere", [
        "Matière de ce sujet. C'est ta seule source de faits. Les passages entre [déjà utilisé dans un post précédent] et [/déjà utilisé] ont déjà servi : ne les reprends pas tels quels, un autre angle sur le même fait reste possible.",
        combined,
      ])
    );
  }

  const briefLines: string[] = [];
  briefLines.push(
    product
      ? `Sujet : ${product.name}${product.description ? ` — ${product.description}` : ""}${
          product.valueProposition ? ` (proposition de valeur : ${product.valueProposition})` : ""
        }`
      : "Aucun sujet précis : post sur l'activité de l'auteur."
  );
  briefLines.push(`Type de post : ${CONTENT_TYPE_GUIDANCE[contentType]}`);
  briefLines.push(`Rôle de ce post : ${contentCategory.label} — ${contentCategory.description}`);
  if (series) {
    briefLines.push(`Série à respecter (identité et ton reconnaissables d'un épisode à l'autre) : ${series.label} — ${series.description}`);
  }
  // Une série cadrée garde l'angle pour l'accroche seulement : sa structure vient du récit choisi.
  const angleLabel = context.framing
    ? "Angle (forme de l'accroche seulement, la structure vient du récit choisi)"
    : "Angle (forme de l'accroche et de la structure)";
  // direction.angleHint remplace l'angle du mécanisme anti-répétition quand le chef en recommande un.
  if (direction?.angleHint) {
    briefLines.push(`${angleLabel} : ${direction.angleHint}`);
  } else if (angle) {
    briefLines.push(`${angleLabel} : ${angle.label} — ${angle.description}`);
  }
  if (episodeDirective) {
    briefLines.push(`Cet épisode de la série se concentre sur : ${episodeDirective.episodeTitle} — ${episodeDirective.angleHint}`);
  }
  if (contentType === "visual" && brandAsset) {
    briefLines.push(
      `Photo disponible (utilisée telle quelle ou détourée dans la maquette, jamais modifiée ; ne décris pas un autre produit que celui-ci) : ${brandAsset.aiDescription}${
        brandAsset.tags?.length ? ` (mots-clés : ${brandAsset.tags.join(", ")})` : ""
      }`
    );
  }
  // Chemin "sans chef" uniquement (§4.1) : quand une direction existe, le chef a déjà absorbé la
  // directive du créateur dans son concept — ne pas la répéter ici.
  if (!direction && directive) {
    briefLines.push(`Idée soufflée par l'auteur (une piste à interpréter, pas un texte à recopier ni une source de faits) : ${directive}`);
  }
  sections.push(tag("brief", briefLines));

  const inspirationBlock = buildInspirationBlock(context.inspirations);
  if (inspirationBlock) sections.push(inspirationBlock);

  const visualOnly = contentType === "visual" && context.visual?.withText === false;
  sections.push(tag("plateforme", [platformRuleText(platform, { visualOnly })]));

  if (contentType === "visual") {
    const formatBlock = buildFormatBlock(context.visual);
    if (formatBlock) sections.push(formatBlock);
  }

  const recentPostsBlock = buildRecentPostsBlock(context.recentPosts);
  if (recentPostsBlock) sections.push(recentPostsBlock);

  const varietyLines: string[] = [];
  if (recentTopics?.length) varietyLines.push(`Posts récents de l'auteur (ne repropose pas le même angle) : ${recentTopics.join(" ; ")}`);
  if (performanceSummary) varietyLines.push(`Performance récente : ${performanceSummary}`);
  if (rejectedConcepts?.length) {
    // Plafond d'injection (docs/SPEC_PROMPT_GENERATION_TECH.md §6.3) : seuls les 5 plus récents.
    varietyLines.push(
      `Idées déjà refusées pour ce post — propose une idée réellement différente, pas une reformulation : ${rejectedConcepts.slice(-5).join(" ; ")}`
    );
  }
  if (varietyLines.length) sections.push(tag("variete", varietyLines));

  sections.push(
    tag("rappel", [
      "Avant de répondre : chaque fait vient du contexte ; aucune tournure interdite ; l'accroche tient dans ce que la plateforme affiche avant « voir plus » ; un lecteur pressé comprend dès la première phrase pourquoi ce post est pour lui.",
    ])
  );

  return sections.join("\n\n");
}
