import { z } from "zod";
import type { AgenticToolCall, LlmToolDefinition } from "./types";
import { callAgentic } from "./provider";
import type { OnboardingMessage } from "./onboardingChat";
import { KNOWN_PLATFORMS, platformLabel } from "@/lib/social/types";

export type AssistantMessage = OnboardingMessage;

const proposalActionSchema = z.enum(["create", "update"]);
const KNOWN_PLATFORM_KEYS = KNOWN_PLATFORMS.map((p) => p.key);

export const productProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  name: z.string().min(1),
  description: z.string().optional(),
  valueProposition: z.string().optional(),
  // Override d'audience par sujet (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — distinct de l'audience
  // de marque portée par profileProposals. Le prompt système y renvoyait déjà explicitement alors
  // que le champ n'existait pas ici : l'assistant était dirigé vers une action qu'il ne pouvait pas
  // émettre (docs/SPEC_ASSISTANT_AGENTIQUE.md §6.1).
  targetAudience: z.string().optional(),
});
export type ProductProposal = z.infer<typeof productProposalSchema>;

export const seriesProposalSchema = z.object({
  action: proposalActionSchema,
  targetId: z.string().optional(),
  label: z.string().min(1),
  description: z.string().min(1),
  weight: z.number().int().min(0).max(60),
  // Un rôle unique par série (docs/SPEC_SERIES_ET_ROLES.md §1).
  categoryLabel: z.string().min(1),
  platforms: z.array(z.string()),
  // docs/SPEC_REDACTEUR_EN_CHEF.md §4.5 — même typologie que seriesLabels.ts (inférence à la
  // création). Restitué à l'identique sur un update sauf changement demandé, comme platforms.
  // `required` dans le tool mais optionnel ici, et SANS valeur par défaut : un modèle qui omet le
  // champ malgré la contrainte (déjà observé sur usedExcerpts, cf. llm/types.ts) ne doit pas faire
  // échouer tout le tour, et un défaut "rendez_vous" écraserait silencieusement un feuilleton
  // existant à l'acceptation. Absent = mode inchangé.
  mode: z.enum(["feuilleton", "rendez_vous"]).optional(),
  // Sujet dont la série tire sa matière — `undefined` laisse le rattachement inchangé (jamais de
  // détachement implicite : ça viderait la source de matière du rédacteur en chef sans le dire).
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
  // Aiguillage matière×catégorie (docs/SPEC_MATIERE_EDITEUR.md §5.3) — `undefined` conserve la
  // valeur actuelle du rôle (cf. resolveProposal).
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

export const postingGoalProposalSchema = z.object({
  platform: z.string().min(1),
  targetCountPerWeek: z.number().min(0).max(30),
});
export type PostingGoalProposal = z.infer<typeof postingGoalProposalSchema>;

// Audience de marque (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — une seule cible possible
// (CreatorProfile de l'utilisateur), pas de action create/update ni de targetId comme les autres :
// plafonné à 1 élément plutôt que 5 (cf. assistantChatResultSchema).
export const profileProposalSchema = z.object({
  targetAudience: z.string().min(1),
});
export type ProfileProposal = z.infer<typeof profileProposalSchema>;

/** Charge utile de l'outil de proposition. La réponse conversationnelle n'en fait plus partie :
 *  en boucle agentique, c'est le texte libre du modèle qui la porte
 *  (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.2). */
/** Matière première proposée depuis la conversation (docs/SPEC_ASSISTANT_AGENTIQUE.md §5).
 *  L'assistant ne crée jamais de matière lui-même : le SourceMaterial naît à l'acceptation.
 *  `text` porte l'extraction conversationnelle ; `attachmentId` désigne un fichier déposé dans le
 *  fil, dont l'assistant ne connaît que le nom — jamais le contenu. */
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
    message: "materialId est requis pour modifier ou supprimer un document.",
  })
  .refine((p) => p.action !== "create" || !!p.text || !!p.attachmentId, {
    message: "Une création de matière doit porter soit du texte, soit un fichier déposé.",
  });
export type MaterialProposal = z.infer<typeof materialProposalSchema>;

/** Archivage — jamais de suppression (docs/SPEC_SERIES_ET_ROLES.md §7 : un objet archivé reste
 *  référencé par les scripts et créneaux déjà produits). */
export const archiveProposalSchema = z.object({
  kind: z.enum(["series", "category", "angle"]),
  targetId: z.string().min(1),
  reason: z.string().optional(),
});
export type ArchiveProposal = z.infer<typeof archiveProposalSchema>;

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

/** Outils séparés plutôt que des tableaux de plus dans propose_changes : en boucle agentique, un
 *  outil ciblé s'appelle sans avoir à remplir six tableaux vides. */
function buildMaterialTool(context: { productIds: string[]; attachmentIds: string[] }): LlmToolDefinition {
  return {
    name: MATERIAL_TOOL_NAME,
    description:
      "Propose d'ajouter, de modifier ou de retirer un document de matière première. À utiliser quand l'utilisateur raconte une information exploitable (actualité, anecdote, chiffre, décision, retour d'expérience) qui mérite d'être conservée pour nourrir ses futurs contenus, ou quand il a déposé un fichier dans la conversation. Rien n'est enregistré avant sa validation.",
    input_schema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["create", "update", "delete"],
          description: "'create' pour un nouveau document, 'update' pour corriger un document existant, 'delete' pour en retirer un.",
        },
        materialId: {
          type: "string",
          description: "Id EXACT d'un document existant, obtenu via list_materials — requis pour 'update' et 'delete'.",
        },
        productId: enumField(
          context.productIds,
          "Id EXACT du sujet auquel rattacher cette matière. Omets-le SEULEMENT si la matière concerne la marque en général et aucun sujet précis — si tu hésites, demande à l'utilisateur plutôt que de deviner."
        ),
        title: { type: "string", description: "Titre court et descriptif du document." },
        text: {
          type: "string",
          description:
            "Le contenu, rapporté fidèlement d'après ce que l'utilisateur a dit — n'ajoute aucun fait qu'il n'a pas donné, ne romance pas. Laisse vide si la matière vient d'un fichier déposé (attachmentId).",
        },
        attachmentId: enumField(
          context.attachmentIds,
          "Id EXACT d'un fichier déposé par l'utilisateur dans la conversation. Tu n'en connais que le nom : ne prétends jamais savoir ce qu'il contient."
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
      "Propose d'archiver une série, un rôle éditorial ou un angle devenu inutile. L'archivage n'efface rien : les scripts et créneaux déjà produits le conservent. Réservé à une demande claire de l'utilisateur.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["series", "category", "angle"], description: "Nature de l'élément à archiver." },
        targetId: enumField(
          [...context.seriesIds, ...context.categoryIds, ...context.angleIds],
          "Id EXACT de l'élément à archiver, cohérent avec 'kind'."
        ),
        reason: { type: "string", description: "En une phrase, pourquoi cet élément n'a plus lieu d'être." },
      },
      required: ["kind", "targetId"],
    },
  };
}

/** `enum` sur une valeur censée matcher exactement une valeur existante — omis quand la liste est
 *  vide, un `enum: []` rejetterait toute valeur. */
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
    "Id EXACT du sujet dont la série tire sa matière. Omets ce champ si aucun sujet précis ne s'impose, ou pour laisser inchangé le rattachement d'une série existante."
  );

  const platformsField = {
    type: "array",
    description:
      "Réseaux pertinents, à déduire du contexte de la conversation. Tableau VIDE si aucun signal clair (= tous les réseaux, comportement par défaut) — ne restreins qu'avec une bonne raison exprimée par l'utilisateur. Pour une mise à jour, reprends les plateformes actuelles sauf changement explicitement demandé.",
    items: enumField(context.platformKeys, "Clé de plateforme connue (parmi le registre)."),
  };

  return {
    name: ASSISTANT_CHAT_TOOL_NAME,
    description:
      "Enregistre des propositions de création ou de modification (sujets, séries, rôles éditoriaux, angles, objectifs de fréquence, audience de marque) que l'utilisateur validera, éditera ou refusera. N'applique rien directement. N'appelle cet outil QUE si tu as vraiment quelque chose à proposer, et adresse-toi à l'utilisateur dans ta réponse en texte, pas ici.",
    input_schema: {
      type: "object",
      properties: {
        productProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification de produit. La plupart des tours n'en proposent aucune — seulement quand l'utilisateur a donné assez d'info sur un produit nouveau ou existant.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour un nouveau produit, 'update' pour modifier un produit existant." },
              targetId: enumField(context.productIds, "Id EXACT du produit existant à modifier — uniquement si action='update'."),
              name: { type: "string", description: "Nom du produit (valeur complète à jour, même pour une modification partielle)." },
              description: { type: "string", description: "Description du produit." },
              valueProposition: { type: "string", description: "Proposition de valeur du produit." },
              targetAudience: {
                type: "string",
                description:
                  "Audience propre à CE sujet, quand elle diffère de l'audience de marque (ex. l'audience d'un projet technique ≠ celle d'une boutique). Omets ce champ si rien ne la distingue — le sujet retombe alors sur l'audience de marque.",
              },
            },
            required: ["action", "name"],
          },
        },
        seriesProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification de série récurrente ('direction'). La plupart des tours n'en proposent aucune.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour une nouvelle série, 'update' pour modifier une série existante." },
              targetId: enumField(context.seriesIds, "Id EXACT de la série existante à modifier — uniquement si action='update'."),
              label: { type: "string", description: "Nom court et mémorable de la série." },
              description: { type: "string", description: "Identité de la série : angle, ton, structure à respecter." },
              weight: { type: "integer", description: "Pourcentage approximatif des créneaux mensuels (0 à 60)." },
              categoryLabel: enumField(
                context.categoryLabels,
                "Libellé exact du rôle éditorial (unique) que sert cette série. Si tu hésites entre deux rôles, propose deux séries."
              ),
              platforms: platformsField,
              mode: {
                type: "string",
                enum: ["feuilleton", "rendez_vous"],
                description:
                  'Mode de la série : "feuilleton" si les épisodes se suivent et construisent une progression (devlog, coulisses d\'un projet, avancement d\'un chantier) ; "rendez_vous" si les épisodes sont autonomes et ne partagent qu\'un format (news de la semaine, sélection, FAQ, top). En cas de doute, choisis "rendez_vous". Pour une mise à jour, reprends le mode actuel sauf changement explicitement demandé.',
              },
              productId: productIdField,
            },
            required: ["action", "label", "description", "weight", "categoryLabel", "platforms", "mode"],
          },
        },
        categoryProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification de rôle éditorial ('catégorie' côté données). RARE : uniquement sur demande explicite de l'utilisateur ou pour rééquilibrer un mix — la plupart des demandes se traduisent en série, pas en rôle.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour un nouveau rôle, 'update' pour modifier un rôle existant." },
              targetId: enumField(context.categoryIds, "Id EXACT du rôle existant à modifier — uniquement si action='update'."),
              label: { type: "string", description: "Libellé court du rôle." },
              description: { type: "string", description: "Consigne éditoriale du rôle." },
              weight: {
                type: "integer",
                description:
                  "Poids de CE rôle uniquement (5 à 90, % approximatif des créneaux). Ne propose JAMAIS le poids des autres rôles — ils seront réajustés automatiquement pour continuer à sommer à 100%.",
              },
              platforms: platformsField,
              materialHungry: {
                type: "boolean",
                description:
                  "true si ce rôle ne tourne pas sans matière documentée (storytelling, coulisses, retour d'expérience) ; false s'il tourne sans journal de bord (expertise, pédagogie). Sert au calendrier à réserver ces rôles aux jours documentés. Omets ce champ pour laisser la valeur actuelle inchangée.",
              },
            },
            required: ["action", "label", "description", "weight", "platforms"],
          },
        },
        angleProposals: {
          type: "array",
          description:
            "0 à 5 propositions de création/modification d'angle de contenu (variation de traitement au sein d'un rôle). La plupart des tours n'en proposent aucune.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              action: { type: "string", enum: ["create", "update"], description: "'create' pour un nouvel angle, 'update' pour modifier un angle existant." },
              targetId: enumField(context.angleIds, "Id EXACT de l'angle existant à modifier — uniquement si action='update'."),
              label: { type: "string", description: "Nom court de l'angle." },
              description: { type: "string", description: "Consigne de traitement associée à cet angle." },
            },
            required: ["action", "label", "description"],
          },
        },
        postingGoalProposals: {
          type: "array",
          description:
            "0 à 5 propositions de mise à jour d'objectif de fréquence hebdomadaire par plateforme. Pas de distinction create/update : la plateforme identifie la cible.",
          maxItems: 5,
          items: {
            type: "object",
            properties: {
              platform: enumField(context.platformKeys, "Clé de plateforme connue (parmi le registre)."),
              targetCountPerWeek: {
                type: "number",
                description: "Objectif hebdomadaire (0 à 30, par pas de 0.5 — ex: 0.5 = 1 publication toutes les 2 semaines).",
              },
            },
            required: ["platform", "targetCountPerWeek"],
          },
        },
        profileProposals: {
          type: "array",
          description:
            "0 ou 1 proposition de mise à jour de l'AUDIENCE DE MARQUE (pas l'audience d'un sujet précis — ça, c'est product_update). La plupart des tours n'en proposent aucune, seulement quand l'audience se précise clairement dans la conversation et diffère de ce qui est déjà connu.",
          maxItems: 1,
          items: {
            type: "object",
            properties: {
              targetAudience: {
                type: "string",
                description: "Qui achète ou lit, ce qui l'intéresse, ce qu'il doit retenir de la marque — valeur complète à jour, pas seulement le delta.",
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

const SYSTEM_PROMPT = `Tu es l'assistant éditorial de CreaFlow. Tu discutes avec l'utilisateur de sa direction éditoriale et des paramètres de son calendrier de publication, et tu proposes, quand c'est pertinent, des créations ou modifications de PRODUITS (sujets), SÉRIES récurrentes, RÔLES ÉDITORIAUX (appelés 'catégories' dans les données), ANGLES, OBJECTIFS DE FRÉQUENCE par plateforme, et l'AUDIENCE DE MARQUE.

Tu disposes d'OUTILS DE LECTURE sur tout l'espace de travail : la matière première du créateur (ses documents de travail), ses scripts, son calendrier de publication, ses performances réelles, l'état narratif de ses séries en cours, et son profil complet. Sers-t'en quand la réponse en dépend — un rédacteur en chef qui conseille sans avoir lu ce qui est publié ni ce qui est planifié ne sert à rien. Mais ne fouille pas pour le plaisir : sur une question qui n'en a pas besoin, réponds directement. Deux ou trois lectures ciblées valent mieux que dix.

Ta réponse à l'utilisateur est ton texte, pas un appel d'outil. L'outil propose_changes sert uniquement à enregistrer des propositions ; après l'avoir appelé, tu dois toujours répondre en texte à l'utilisateur.

Vocabulaire : face à l'utilisateur, parle toujours de "rôle" ou "rôle éditorial", jamais de "catégorie". Un rôle dit POURQUOI un post existe (expertise, coulisses, preuve sociale...) ; une série dit À QUOI il ressemble (format nommé, reconnaissable) et sert exactement UN rôle.

Règles :
- La SÉRIE est l'objet que l'utilisateur manipule. Quand il décrit un format, un rendez-vous, une idée récurrente, propose une SÉRIE (rattachée à un rôle existant) — pas un rôle. Ne propose la création ou la modification d'un rôle que si l'utilisateur le demande explicitement, ou si aucun rôle existant ne peut accueillir la série et qu'il en manque manifestement un. Le poids des rôles évolue surtout à partir des performances réelles : ne le retouche que sur demande claire.
- Pose une seule question à la fois, de façon conversationnelle.
- Ne propose une création/modification que quand tu as assez d'info — la plupart des tours ne doivent rien proposer (tableaux vides).
- Les objectifs de fréquence n'ont qu'une seule forme, sans distinction create/update : la plateforme identifie la cible, la valeur existante est simplement remplacée.
- L'archivage (propose_archive) ne s'efface jamais : il retire un élément de la circulation sans toucher aux contenus déjà produits. Ne le propose que sur demande claire de l'utilisateur, jamais de ta propre initiative pour "faire le ménage".
- MATIÈRE : quand l'utilisateur te raconte une information factuelle exploitable (une actualité sur un de ses sujets, une anecdote d'atelier, un chiffre, une décision, un retour d'expérience), propose de l'ajouter à sa matière avec propose_material — c'est ce qui nourrira ses prochains contenus. Rapporte fidèlement ce qu'il a dit, sans rien ajouter ni romancer. N'en propose pas à chaque phrase : seulement quand il y a une vraie information à conserver. Si tu ne sais pas à quel sujet la rattacher, demande-lui plutôt que de deviner.
- FICHIERS : quand l'utilisateur dépose un fichier dans la conversation, tu en vois le nom, JAMAIS le contenu. Ne prétends jamais savoir ce qu'il contient et ne le résume pas. C'est son message qui te dit quoi en faire ; s'il n'est pas clair sur le sujet de rattachement, demande — tu pourras le ranger plus tard, le fichier reste disponible.
- Pour 'update', utilise TOUJOURS l'id EXACT fourni dans le contexte (produits/séries/rôles/angles existants) — n'invente jamais d'id, et n'utilise 'update' que si l'utilisateur décrit clairement un élément déjà existant.
- Pour une série, utilise le libellé de rôle EXACT fourni dans le contexte (un seul rôle par série ; si une idée hésite entre deux rôles, propose deux séries).
- Pour un rôle, ne propose QUE le poids du rôle concerné (5 à 90) — jamais celui des autres, ils seront réajustés automatiquement pour continuer à sommer à 100%.
- Une série a un MODE : "feuilleton" (les épisodes se suivent et construisent une progression) ou "rendez_vous" (épisodes autonomes partageant un format). En cas de doute, "rendez_vous". Sur une mise à jour, restitue le mode actuel sauf changement demandé.
- Une série peut tirer sa matière d'un SUJET précis (productId) : renseigne-le quand la série porte manifestement sur un sujet existant, sinon omets le champ — elle retombe alors sur la matière de niveau marque. N'omets jamais ce champ pour "détacher" une série : omettre = laisser inchangé.
- Le champ materialHungry d'un rôle dit s'il a besoin de matière documentée pour tourner (storytelling, coulisses : oui ; expertise, pédagogie : non). Ne le renseigne que si tu le changes vraiment — omettre conserve la valeur actuelle.
- Pour les plateformes (séries et rôles), utilise UNIQUEMENT les clés du registre fourni. Ne restreins à des plateformes précises que si le contexte de la conversation le justifie clairement (ex. l'utilisateur mentionne un réseau en particulier) — sinon laisse le tableau vide (= toutes les plateformes), ne sur-scope jamais sans raison. Pour une mise à jour, restitue les plateformes actuelles de l'élément sauf changement explicitement demandé.
- Tu LIS le calendrier et les scripts, tu ne les MODIFIES jamais. Pas de génération de mois, pas de création/déplacement/suppression de créneau ; pas d'écriture, de réécriture ni de suppression de script. Ce sont les deux domaines de l'utilisateur : le planning et les mots. Si on te demande d'y toucher, dis-le simplement et oriente vers l'écran concerné (Calendrier, ou l'éditeur du script) — tu peux en revanche les lire pour argumenter, résumer, ou repérer un trou.
- Rien n'est jamais enregistré directement : chaque proposition passée à propose_changes sera relue, éditée ou refusée par l'utilisateur avant d'être appliquée — tu peux donc proposer dès que c'est raisonnable, sans sur-demander de confirmation. Ne dis jamais qu'une modification est faite : dis qu'elle est proposée.
- Tu ne dois JAMAIS inventer une information (nom, caractéristique, chiffre, date...) qui ne t'a pas été donnée explicitement par l'utilisateur ou par une source fournie. En cas de doute ou d'info manquante, pose une question de clarification plutôt que de deviner.
- L'audience de marque (qui achète/lit, ce qui l'intéresse, ce qu'il doit retenir) est une donnée de PROFIL, distincte de l'audience éventuelle d'un sujet précis (ça, c'est une propriété du produit — utilise le champ targetAudience d'une proposition de produit, pas profileProposals, dans ce cas). Ne propose une mise à jour de l'audience de marque que si elle se précise clairement et diffère de la valeur déjà connue fournie dans le contexte.`;

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
    weight: number;
    category: { label: string } | null;
    platforms: string[];
    mode: "feuilleton" | "rendez_vous";
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
  /** Audience de marque actuelle (docs/SPEC_PROMPT_GENERATION_TECH.md §5) — null si jamais renseignée. */
  currentTargetAudience?: string | null;
  sources?: Array<{ url: string; text: string }>;
  /** Outils de lecture exposés au modèle, et leur exécution. Injectés par l'appelant plutôt
   *  qu'importés ici : la couche llm/ ne connaît ni la base ni les services
   *  (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.1). */
  readTools: LlmToolDefinition[];
  onReadTool: (name: string, input: unknown) => Promise<unknown>;
  /** Fichiers déposés dans la conversation et pas encore rangés (docs/SPEC_ASSISTANT_AGENTIQUE.md §5.1).
   *  Seul le nom est transmis au modèle — jamais le contenu. */
  attachments?: Array<{ id: string; filename: string }>;
}

export interface AssistantTurnResult {
  /** Réponse conversationnelle : le texte libre du modèle, plus un champ d'outil. */
  reply: string;
  proposals: AssistantChatResult;
  materialProposals: MaterialProposal[];
  archiveProposals: ArchiveProposal[];
  toolCalls: AgenticToolCall[];
  stoppedAtMaxTurns: boolean;
}

export async function runAssistantChatTurn(context: AssistantChatContext): Promise<AssistantTurnResult> {
  // Chaque élément est restitué avec TOUS les champs que l'assistant peut proposer de modifier :
  // proposer un `update` sur un champ qu'on ne lui a pas montré revient à l'écraser à l'aveugle
  // (docs/SPEC_ASSISTANT_AGENTIQUE.md §6).
  const contextLines = [
    context.products.length > 0
      ? `Produits existants : ${context.products
          .map(
            (p) =>
              `[id:${p.id}] ${p.name}${p.description ? ` — ${p.description}` : ""}${
                p.valueProposition ? ` [proposition de valeur : ${p.valueProposition}]` : ""
              }${p.targetAudience ? ` [audience du sujet : ${p.targetAudience}]` : ""}`
          )
          .join(" ; ")}`
      : "Aucun produit enregistré pour l'instant.",
    context.series.length > 0
      ? `Séries existantes : ${context.series
          .map(
            (s) =>
              `[id:${s.id}] ${s.label} (${s.weight}%) — ${s.description} [rôle : ${s.category?.label ?? "aucun"}]${
                s.platforms.length > 0 ? ` [plateformes : ${s.platforms.join(", ")}]` : " [tous réseaux]"
              } [mode : ${s.mode}]${s.product ? ` [matière du sujet : ${s.product.name} (id:${s.product.id})]` : " [aucun sujet lié]"}`
          )
          .join(" ; ")}`
      : "Aucune série active pour l'instant.",
    context.categories.length > 0
      ? `Rôles éditoriaux actifs : ${context.categories
          .map(
            (c) =>
              `[id:${c.id}] ${c.label} (${c.weight}%) — ${c.description}${
                c.platforms.length > 0 ? ` [plateformes : ${c.platforms.join(", ")}]` : " [tous réseaux]"
              }${c.materialHungry ? " [exige de la matière documentée]" : ""}`
          )
          .join(" ; ")}`
      : "Aucun rôle éditorial actif pour l'instant.",
    context.angles.length > 0
      ? `Angles actifs : ${context.angles.map((a) => `[id:${a.id}] ${a.label} — ${a.description}`).join(" ; ")}`
      : "Aucun angle actif pour l'instant.",
    context.postingGoals.length > 0
      ? `Objectifs de fréquence actuels : ${context.postingGoals
          .map((g) => `${platformLabel(g.platform)} : ${g.targetCountPerWeek}/semaine`)
          .join(" ; ")}`
      : "Aucun objectif de fréquence défini pour l'instant.",
    context.currentTargetAudience
      ? `Audience de marque actuelle : ${context.currentTargetAudience}`
      : "Aucune audience de marque renseignée pour l'instant.",
  ];

  const attachments = context.attachments ?? [];
  if (attachments.length > 0) {
    contextLines.push(
      `Fichiers déposés dans la conversation, pas encore rangés en matière (tu n'en connais que le NOM, jamais le contenu) : ${attachments
        .map((a) => `[id:${a.id}] ${a.filename}`)
        .join(" ; ")}`
    );
  }

  const sourceBlocks = (context.sources ?? []).map((s) => `--- Source : ${s.url} ---\n${s.text}`);

  // L'état éditorial de base reste PRÉ-INJECTÉ plutôt qu'exposé en outil : l'assistant en a besoin à
  // chaque message, aller le chercher coûterait un aller-retour par tour pour rien
  // (docs/SPEC_ASSISTANT_AGENTIQUE.md §3.1). Seul ce qui est volumineux ou occasionnel est outillé.
  const system = [
    SYSTEM_PROMPT,
    "",
    "--- État actuel de l'espace de travail ---",
    ...contextLines,
    ...(sourceBlocks.length > 0
      ? [
          "",
          "Informations extraites de pages web fournies par l'utilisateur pour ce tour (contexte factuel, ne rien inventer au-delà) :",
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

  // Un modèle peut appeler propose_changes plusieurs fois dans un même tour : on accumule au lieu
  // d'écraser. Les plafonds par type restent ceux du schéma, appliqués à chaque appel.
  const materialProposals: MaterialProposal[] = [];
  const archiveProposals: ArchiveProposal[] = [];
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
    ],
    maxTokens: 3072,
    onToolCall: async ({ name, input }) => {
      if (name === MATERIAL_TOOL_NAME) {
        const parsed = materialProposalSchema.parse(input);
        materialProposals.push(parsed);
        return { recorded: 1, note: "Proposition de matière enregistrée, en attente de validation. Réponds maintenant en texte." };
      }
      if (name === ARCHIVE_TOOL_NAME) {
        const parsed = archiveProposalSchema.parse(input);
        archiveProposals.push(parsed);
        return { recorded: 1, note: "Proposition d'archivage enregistrée, en attente de validation. Réponds maintenant en texte." };
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
        note: "Propositions enregistrées, en attente de validation par l'utilisateur. Réponds-lui maintenant en texte.",
      };
    },
  });

  return {
    reply: result.reply,
    proposals,
    materialProposals,
    archiveProposals,
    toolCalls: result.toolCalls,
    stoppedAtMaxTurns: result.stoppedAtMaxTurns,
  };
}
