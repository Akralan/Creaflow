import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import type { ContentType } from "./prompts";
import { storyboardStepSchema } from "./scriptSchema";

/**
 * Micro-retouches dans l'éditeur (docs/SPEC_MATIERE_EDITEUR.md §4.4/§4.6) : deux gestes, pas plus —
 * sélection→instruction (rewrite_selection) et régénération d'un bloc (regenerate_*). Chacun reste
 * un appel LLM texte court et contraint, jamais une re-génération de structure complète.
 */

export const REWRITE_SELECTION_SYSTEM_PROMPT = `Tu es un rédacteur qui retouche un texte existant à la demande, pour CreaFlow.

Règles :
- Tu ne réécris QUE le passage sélectionné, fourni ci-dessous — jamais le reste du script.
- Applique l'instruction donnée, rien d'autre.
- Garde la langue, le ton et le format du texte d'origine sauf si l'instruction demande explicitement de les changer.
- Si l'instruction demande de supprimer/enlever/retirer le passage : renvoie une chaîne VIDE. Ne le reformule pas, ne le raccourcis pas, ne le résume pas — supprimer veut dire qu'il ne doit plus rien rester de ce passage, pas une version plus courte.
- De la matière factuelle sur le sujet peut être fournie ci-dessous (documents déposés par l'utilisateur) — sers-t'en si l'instruction le demande ou le suggère (ex. « base-toi sur... », « parle plutôt de... »), copié MOT POUR MOT pour toute information factuelle reprise.
- Tu ne dois JAMAIS inventer une information factuelle (nom, chiffre, date, anecdote, résultat...) qui ne t'a pas été donnée explicitement — ni dans le texte d'origine, ni dans la matière fournie. Si une précision manque, écris littéralement "[à compléter]" plutôt que d'inventer.
- Renvoie uniquement le texte de remplacement via l'outil fourni, sans guillemets ni commentaire autour.
- Le champ "usedExcerpts" de l'outil est obligatoire : renvoie un tableau vide [] si tu n'as repris aucun passage mot pour mot depuis la matière fournie.`;

export const REWRITE_SELECTION_TOOL_NAME = "rewrite_selection";
export const rewriteSelectionTool: LlmToolDefinition = {
  name: REWRITE_SELECTION_TOOL_NAME,
  description: "Renvoie le texte de remplacement pour la sélection, appliquant l'instruction donnée.",
  input_schema: {
    type: "object",
    properties: {
      rewrittenText: {
        type: "string",
        description:
          "Texte de remplacement, prêt à insérer à la place exacte de la sélection. Chaîne VIDE si l'instruction demande de supprimer ce passage — jamais une reformulation ou un raccourci à la place d'une vraie suppression.",
      },
      usedExcerpts: {
        type: "array",
        description:
          "OBLIGATOIRE — ne jamais omettre ce champ. Passages copiés MOT POUR MOT depuis la matière factuelle fournie que tu as utilisés dans ce remplacement. Tableau vide [] si aucune matière fournie ou utilisée.",
        items: { type: "string" },
      },
    },
    required: ["rewrittenText", "usedExcerpts"],
    additionalProperties: false,
  },
};

export const rewriteSelectionResultSchema = z.object({
  rewrittenText: z.string(),
  usedExcerpts: z.array(z.string()).default([]),
});

export function buildRewriteSelectionUserMessage(params: {
  brandContext: string;
  selectedText: string;
  instruction: string;
  materialDocuments?: Array<{ id: string; title: string | null; annotatedText: string }>;
}): string {
  const lines = [params.brandContext, `Passage sélectionné à retoucher : "${params.selectedText}"`, `Instruction : ${params.instruction}`];
  if (params.materialDocuments?.length) {
    const combined = params.materialDocuments
      .map((d) => (d.title ? `[${d.title}]\n${d.annotatedText}` : d.annotatedText))
      .join("\n\n---\n\n");
    lines.push(
      `Matière factuelle disponible sur ce sujet (utilise-la si l'instruction le demande, MOT POUR MOT pour tout fait repris) :\n${combined}`
    );
  }
  return lines.filter(Boolean).join("\n\n");
}

// --- Régénération d'un seul bloc ---

export type MicroEditBlock = "hook" | "storyboard" | "caption" | "hashtags";

export function toolForBlock(block: MicroEditBlock, contentType: ContentType): LlmToolDefinition {
  if (block === "hook") {
    if (contentType === "video") {
      return {
        name: "regenerate_hook",
        description: "Régénère uniquement l'accroche (hook) du script vidéo — visuel, texte à l'écran et audio.",
        input_schema: {
          type: "object",
          properties: {
            hookVisual: { type: "string", description: "Description du visuel des 3 premières secondes." },
            hookText: { type: "string", description: "Texte à afficher à l'écran pendant l'accroche." },
            hookAudio: { type: "string", description: "Ce qui est dit ou entendu pendant l'accroche." },
          },
          required: ["hookVisual", "hookText", "hookAudio"],
        },
      };
    }
    if (contentType === "visual") {
      return {
        name: "regenerate_hook",
        description: "Régénère uniquement l'accroche visuelle (composition) du post.",
        input_schema: {
          type: "object",
          properties: {
            hookVisual: { type: "string", description: "Composition visuelle qui capte l'attention (1re slide ou image unique)." },
          },
          required: ["hookVisual"],
        },
      };
    }
    // Pour un post texte, l'accroche EST la première phrase du texte actuel (fourni comme référence
    // fixe dans le message, cf. microEditService.ts) — le titre est inclus pour rester cohérent avec
    // ce même texte, mais SI le titre actuel décrit déjà bien le sujet, le renvoyer inchangé plutôt
    // que de le changer pour changer (champ `required`, jamais omis, pour la fiabilité — cf.
    // usedExcerpts dans scriptSchema.ts — mais la valeur peut rester identique à l'actuelle).
    return {
      name: "regenerate_hook",
      description: "Régénère l'accroche (première phrase du texte) cohérente avec le texte actuel fourni, et ajuste le titre uniquement s'il ne correspond plus à ce texte.",
      input_schema: {
        type: "object",
        properties: {
          hookText: { type: "string", description: "Première phrase du texte actuel, pensée pour capter l'attention — cohérente avec ce texte, pas avec un ancien sujet." },
          title: {
            type: "string",
            description: "Titre cohérent avec le texte actuel fourni. Renvoie le titre actuel INCHANGÉ s'il décrit déjà bien ce texte — ne le change que si le sujet réel du texte ne correspond plus au titre actuel.",
          },
        },
        required: ["hookText", "title"],
        additionalProperties: false,
      },
    };
  }
  if (block === "storyboard") {
    return {
      name: "regenerate_storyboard",
      description: "Régénère uniquement le découpage en plans (vidéo) ou slides (visuel) du script.",
      input_schema: {
        type: "object",
        properties: {
          storyboard: {
            type: "array",
            description: "Découpage en plans/slides simples et numérotés.",
            items: {
              type: "object",
              properties: { planNumber: { type: "integer" }, description: { type: "string" } },
              required: ["planNumber", "description"],
            },
          },
        },
        required: ["storyboard"],
      },
    };
  }
  if (block === "caption") {
    return {
      name: "regenerate_caption",
      description: "Régénère uniquement la légende (ou le corps du texte) du script.",
      input_schema: {
        type: "object",
        properties: { caption: { type: "string", description: "Légende ou corps du texte, prêt à publier." } },
        required: ["caption"],
      },
    };
  }
  return {
    name: "regenerate_hashtags",
    description: "Régénère uniquement la liste de hashtags.",
    input_schema: {
      type: "object",
      properties: {
        hashtags: { type: "array", description: "Liste de hashtags pertinents pour la plateforme visée.", items: { type: "string" } },
      },
      required: ["hashtags"],
    },
  };
}

const blockResultSchemas = {
  hook: z.object({
    hookVisual: z.string().optional(),
    hookText: z.string().optional(),
    hookAudio: z.string().optional(),
    // Présent uniquement pour contentType "text" (cf. toolForBlock) — le titre ajusté si besoin.
    title: z.string().optional(),
  }),
  storyboard: z.object({ storyboard: z.array(storyboardStepSchema).min(1) }),
  caption: z.object({ caption: z.string().min(1) }),
  hashtags: z.object({ hashtags: z.array(z.string()) }),
} as const;

export function parseBlockResult(block: MicroEditBlock, args: unknown) {
  return blockResultSchemas[block].parse(args);
}
