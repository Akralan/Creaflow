import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import type { ContentType } from "./prompts";

// Annexe A.4 de docs/SPEC_PROMPT_GENERATION_TECH.md — texte à recopier tel quel, identique sur les
// 2 tools de génération.
const CONCEPT_FIELD_DESCRIPTION =
  "À rédiger en premier, avant tous les autres champs : en 1 ou 2 phrases, l'idée unique de ce post, à qui il s'adresse précisément, et ce que cette personne doit retenir ou faire après l'avoir vu. Une vraie décision éditoriale — pas une paraphrase du brief.";

// Annexe B.6 de docs/SPEC_REDACTEUR_EN_CHEF.md, verbatim — identique sur les 2 tools de génération.
const PROMISES_MADE_FIELD_DESCRIPTION =
  'Les promesses explicites que ce script fait à l\'audience ("je publierai le verdict", "la semaine prochaine je teste X"), copiées telles qu\'elles apparaissent dans le script. Tableau vide [] si le script n\'en fait aucune.';

export const storyboardStepSchema = z.object({
  planNumber: z.number().int().positive(),
  description: z.string().min(1),
});

const baseFields = {
  // Première propriété du schéma — l'ordre des propriétés est le mécanisme qui force le LLM à
  // décider l'idée avant de rédiger le reste (docs/SPEC_PROMPT_GENERATION_TECH.md §4.1) : ne pas
  // déplacer. Persisté sur Script.concept par createScriptRecord (scriptService.ts).
  concept: z.string().min(1),
  title: z.string().min(1),
  caption: z.string().min(1),
  hashtags: z.array(z.string()).min(1),
  // Citations post-génération (docs/SPEC_MATIERE_EDITEUR.md §3) — passages copiés mot pour mot
  // depuis la matière factuelle fournie, utilisés comme base de ce script. `required` côté JSON
  // schema des 2 tools (voir plus bas) : un champ vraiment optionnel est rempli de façon peu
  // fiable par le modèle (observé en usage réel — tantôt absent, tantôt renseigné, mêmes entrées).
  // `.default([])` ici en filet de sécurité si le provider l'omet quand même.
  usedExcerpts: z.array(z.string()).default([]),
  // Annexe B.6 (docs/SPEC_REDACTEUR_EN_CHEF.md Lot B3) — `required` côté JSON schema des 2 tools,
  // même raisonnement que usedExcerpts (un champ optionnel est rempli de façon peu fiable) ;
  // `.default([])` en filet de sécurité si le provider l'omet quand même.
  promisesMade: z.array(z.string()).default([]),
};

export const visualScriptSchema = z.object({
  ...baseFields,
  hookVisual: z.string().min(1),
  storyboard: z.array(storyboardStepSchema).min(1),
});
export type VisualGeneratedScript = z.infer<typeof visualScriptSchema> & { contentType: "visual" };

export const textScriptSchema = z.object({
  ...baseFields,
  hashtags: z.array(z.string()), // vide accepté : certaines plateformes texte (newsletter...) n'en utilisent pas.
  hookText: z.string().min(1),
});
export type TextGeneratedScript = z.infer<typeof textScriptSchema> & { contentType: "text" };

// --- Préparation et relecture (docs/SPEC_PROMPT_GENERATION_V3.md §3, Annexe A.4) ---
// Lues à part des champs du post, avec tolérance : un provider qui les omettrait ne doit jamais faire
// échouer une génération, il perd seulement la trace.

const pickSchema = z.object({ index: z.number().int(), why: z.string() });

export const generationPrepSchema = z.object({
  reader: z.object({ label: z.string(), knows: z.string().default(""), wants: z.string().default("") }),
  candidateMoments: z
    .array(z.object({ moment: z.string(), excerpt: z.string().default("") }))
    .default([])
    .transform((list) => list.slice(0, 5)),
  chosenMoment: pickSchema,
  hookOptions: z.array(z.object({ kind: z.string(), text: z.string() })).default([]),
  chosenHook: pickSchema,
  // docs/SPEC_MEMOIRE_ET_VEILLE.md §3.3 — références i1…i10 des fiches d'inspiration.
  inspirationsUsed: z.array(z.string()).default([]),
  inspirationsToDrop: z.array(z.object({ ref: z.string(), why: z.string().default("") })).default([]),
  selfCheck: z.object({
    factsFromMaterial: z.boolean(),
    bannedPhrasesFound: z.array(z.string()).default([]),
    readerTest: z.string(),
    authorTest: z.boolean(),
  }),
});
export type GenerationPrep = z.infer<typeof generationPrepSchema>;

/** Persisté sur `scripts.generationTrace` : la préparation, la relecture et le résultat des contrôles. */
export type GenerationTrace = GenerationPrep & {
  version: 3;
  /** Fiches d'inspiration montrées à cette génération, pour appliquer les retours après enregistrement. */
  inspirationsShown?: Array<{ ref: string; id: string }>;
  checks: { failures: string[]; retried: boolean };
};

export type GeneratedScript = (VisualGeneratedScript | TextGeneratedScript) & { trace?: GenerationTrace };

export const GENERATE_VISUAL_POST_TOOL_NAME = "generate_visual_post";
export const GENERATE_TEXT_POST_TOOL_NAME = "generate_text_post";

const pickField = (what: string, list: string, why: string) => ({
  type: "object",
  description: what,
  properties: {
    index: { type: "integer", description: `Sa position dans ${list}, à partir de 0.` },
    why: { type: "string", description: why },
  },
  required: ["index", "why"],
  additionalProperties: false,
});

// Annexe A.4 — dans cet ordre, avant `title` : l'ordre des propriétés est l'ordre d'écriture.
const PREP_FIELDS = {
  reader: {
    type: "object",
    description: "Le public visé par ce post.",
    properties: {
      label: { type: "string", description: "Le nom du public, repris du portrait s'il y en a un (ex. « Joueurs »)." },
      knows: { type: "string", description: "Ce que ce lecteur sait déjà du sujet, en une phrase." },
      wants: { type: "string", description: "Ce qu'il vient chercher en lisant ce post, en une phrase." },
    },
    required: ["label", "knows", "wants"],
    additionalProperties: false,
  },
  candidateMoments: {
    type: "array",
    description: "Jusqu'à 5 moments de la matière qui peuvent intéresser ce lecteur. N'en invente pas pour atteindre un nombre.",
    items: {
      type: "object",
      properties: {
        moment: { type: "string", description: "Le moment en une phrase : ce qui s'est passé." },
        excerpt: {
          type: "string",
          description:
            "Le passage de la matière, copié mot pour mot, qui le prouve. Chaîne vide si le moment vient du contexte marque ou d'un épisode pédagogique.",
        },
      },
      required: ["moment", "excerpt"],
      additionalProperties: false,
    },
  },
  chosenMoment: pickField("Le moment retenu.", "candidateMoments", "Pourquoi lui, pour ce lecteur, en une phrase."),
};

const HOOK_PREP_FIELDS = {
  hookOptions: {
    type: "array",
    description: "2 ou 3 accroches candidates, de types différents.",
    items: {
      type: "object",
      properties: {
        kind: { type: "string", description: "chiffre | aveu | contre-intuitif | avant-après | scène | question-précise" },
        text: { type: "string", description: "L'accroche complète." },
      },
      required: ["kind", "text"],
      additionalProperties: false,
    },
  },
  chosenHook: pickField(
    "L'accroche retenue.",
    "hookOptions",
    "Pourquoi elle arrêtera ce lecteur, en une phrase. Le champ hookText ou hookVisual la reprend ou l'affine."
  ),
  // docs/SPEC_MEMOIRE_ET_VEILLE.md Annexe A.5.
  inspirationsUsed: {
    type: "array",
    description: "Les références (i1, i2…) des fiches d'inspiration qui t'ont servi pour la forme. Tableau vide si aucune, ou s'il n'y a pas de bloc <inspiration>.",
    items: { type: "string" },
  },
  inspirationsToDrop: {
    type: "array",
    description:
      "Les fiches qui ne serviront jamais à ce sujet (public étranger, conseil générique, hors sujet), à retirer. Pas celles qui ne servent simplement pas à ce post. Tableau vide si aucune.",
    items: {
      type: "object",
      properties: {
        ref: { type: "string", description: "La référence (i1, i2…)." },
        why: { type: "string", description: "Pourquoi elle ne sert pas, en une phrase." },
      },
      required: ["ref", "why"],
      additionalProperties: false,
    },
  },
};

// En dernier, après promisesMade.
const SELF_CHECK_FIELD = {
  selfCheck: {
    type: "object",
    description: "Ta relecture du post, honnête. Un point raté signalé sera corrigé par une nouvelle rédaction.",
    properties: {
      factsFromMaterial: { type: "boolean", description: "Vrai si chaque fait propre à l'auteur vient du contexte fourni." },
      bannedPhrasesFound: {
        type: "array",
        description: "Les tournures interdites ou « à bannir » présentes dans le post, recopiées. Tableau vide s'il n'y en a aucune.",
        items: { type: "string" },
      },
      readerTest: {
        type: "string",
        description: "En une phrase, pourquoi le lecteur visé s'arrêterait sur ce post. Écris exactement « aucune » si tu n'en trouves pas.",
      },
      authorTest: { type: "boolean", description: "Vrai si quelqu'un qui connaît l'auteur croirait qu'il a écrit ce post lui-même." },
    },
    required: ["factsFromMaterial", "bannedPhrasesFound", "readerTest", "authorTest"],
    additionalProperties: false,
  },
};

const PREP_REQUIRED = ["reader", "candidateMoments", "chosenMoment", "concept", "hookOptions", "chosenHook", "inspirationsUsed", "inspirationsToDrop"];

export const generateVisualPostTool: LlmToolDefinition = {
  name: GENERATE_VISUAL_POST_TOOL_NAME,
  description:
    "Renvoie un post visuel complet (image unique, carrousel ou animation courte), précédé de sa préparation et suivi de sa relecture.",
  input_schema: {
    type: "object",
    properties: {
      ...PREP_FIELDS,
      concept: { type: "string", description: CONCEPT_FIELD_DESCRIPTION },
      ...HOOK_PREP_FIELDS,
      title: { type: "string", description: "Le nom de l'idée, pas du sujet : court, spécifique à ce post, impossible à réutiliser pour un autre." },
      hookVisual: {
        type: "string",
        description: "Description de la composition visuelle qui capte l'attention (image unique, ou 1re slide d'un carrousel).",
      },
      storyboard: {
        type: "array",
        description: "Découpage en slides numérotées si carrousel (une seule entrée si image unique).",
        items: {
          type: "object",
          properties: {
            planNumber: { type: "integer" },
            description: {
              type: "string",
              description: "Le contenu d'une slide : ce qu'on voit et le texte affiché, au service de l'idée du concept.",
            },
          },
          required: ["planNumber", "description"],
          additionalProperties: false,
        },
      },
      caption: { type: "string", description: "Développe l'idée du concept avec les détails de la matière. Un seul appel à l'action, à la fin, s'il sert le lecteur. Respecte la longueur donnée par <plateforme>." },
      hashtags: {
        type: "array",
        description: "Chaque hashtag sert la découverte du post, dans le nombre donné par <plateforme>. Jamais décoratif.",
        items: { type: "string" },
      },
      usedExcerpts: {
        type: "array",
        description: "OBLIGATOIRE — ne jamais omettre ce champ. Passages copiés MOT POUR MOT depuis la matière factuelle fournie que tu as utilisés comme base de ce script, un par information factuelle reprise. Renvoie un tableau vide [] si aucune matière ne t'a été fournie ou si tu n'en as repris aucun passage mot pour mot.",
        items: { type: "string" },
      },
      promisesMade: {
        type: "array",
        description: PROMISES_MADE_FIELD_DESCRIPTION,
        items: { type: "string" },
      },
      ...SELF_CHECK_FIELD,
    },
    required: [...PREP_REQUIRED, "title", "hookVisual", "storyboard", "caption", "hashtags", "usedExcerpts", "promisesMade", "selfCheck"],
    additionalProperties: false,
  },
};

export const generateTextPostTool: LlmToolDefinition = {
  name: GENERATE_TEXT_POST_TOOL_NAME,
  description: "Renvoie un post texte seul, précédé de sa préparation et suivi de sa relecture.",
  input_schema: {
    type: "object",
    properties: {
      ...PREP_FIELDS,
      concept: { type: "string", description: CONCEPT_FIELD_DESCRIPTION },
      ...HOOK_PREP_FIELDS,
      title: { type: "string", description: "Le nom de l'idée, pas du sujet : court, spécifique à ce post, impossible à réutiliser pour un autre." },
      hookText: { type: "string", description: "La première phrase du texte : elle crée un manque qui oblige à lire la deuxième." },
      caption: { type: "string", description: "Développe l'idée du concept avec les détails de la matière. Un seul appel à l'action, à la fin, s'il sert le lecteur. Respecte la longueur donnée par <plateforme>." },
      hashtags: {
        type: "array",
        description: "Chaque hashtag sert la découverte du post, dans le nombre donné par <plateforme>. Jamais décoratif. Vide si la plateforme n'en utilise pas.",
        items: { type: "string" },
      },
      usedExcerpts: {
        type: "array",
        description: "OBLIGATOIRE — ne jamais omettre ce champ. Passages copiés MOT POUR MOT depuis la matière factuelle fournie que tu as utilisés comme base de ce script, un par information factuelle reprise. Renvoie un tableau vide [] si aucune matière ne t'a été fournie ou si tu n'en as repris aucun passage mot pour mot.",
        items: { type: "string" },
      },
      promisesMade: {
        type: "array",
        description: PROMISES_MADE_FIELD_DESCRIPTION,
        items: { type: "string" },
      },
      ...SELF_CHECK_FIELD,
    },
    required: [...PREP_REQUIRED, "title", "hookText", "caption", "hashtags", "usedExcerpts", "promisesMade", "selfCheck"],
    additionalProperties: false,
  },
};

export function toolForContentType(contentType: ContentType): LlmToolDefinition {
  if (contentType === "visual") return generateVisualPostTool;
  return generateTextPostTool;
}
