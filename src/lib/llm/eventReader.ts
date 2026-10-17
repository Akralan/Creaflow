import { z } from "zod";
import type { LlmToolDefinition } from "./types";

/**
 * Le lecteur d'événements (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3) : un agent qui lit TOUTE la
 * matière d'un sujet, document par document et en entier, et en sort des événements datés. Il
 * remplace le rédacteur en chef, qui ne voyait qu'un résumé d'une phrase par document.
 *
 * Ce module ne contient que le prompt, les outils et les schémas de validation ; l'orchestration
 * (lecture en base, enregistrement, marquage des documents lus) est dans
 * src/lib/services/materialEventService.ts.
 */

export const EVENT_KINDS = ["failure", "decision", "result", "feedback", "milestone"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export const EVENT_KIND_LABELS: Record<EventKind, string> = {
  failure: "Échec",
  decision: "Décision",
  result: "Résultat",
  feedback: "Retour",
  milestone: "Étape",
};

export const DATE_PRECISIONS = ["day", "month", "unknown"] as const;
export type DatePrecision = (typeof DATE_PRECISIONS)[number];

/** Taille d'une partie de document renvoyée par `read_document`. Un journal de commits de 100 Ko
 *  fait neuf parties : lisible en entier sans jamais saturer un tour. */
export const DOCUMENT_PART_CHARS = 12_000;

/** Longueur maximale du passage copié qui prouve l'événement. */
export const MAX_EXCERPT_CHARS = 300;

export const LIST_DOCUMENTS_TOOL = "list_documents";
export const READ_DOCUMENT_TOOL = "read_document";
export const SAVE_EVENT_TOOL = "save_event";

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** Ce que le modèle envoie à `save_event`, avant normalisation (date vide autorisée). */
export const saveEventInputSchema = z.object({
  date: z.string().trim(),
  datePrecision: z.enum(DATE_PRECISIONS),
  title: z.string().trim().min(1).max(160),
  whatHappened: z.string().trim().min(1).max(1500),
  whatChanged: z.string().trim().max(1000),
  kind: z.enum(EVENT_KINDS),
  audiences: z.array(z.string().trim().min(1)).max(5),
  sourceMaterialId: z.string().trim().min(1),
  excerpt: z.string().trim().min(1).max(MAX_EXCERPT_CHARS * 2),
});
export type SaveEventInput = z.infer<typeof saveEventInputSchema>;

export interface NormalizedEventDate {
  date: string | null;
  datePrecision: DatePrecision;
}

/**
 * Une date de précision `day` ou `month` doit être un jour ISO valide ; au mois, le jour est ramené
 * au 1er. `unknown` efface la date. Une date impossible est une erreur renvoyée au modèle, qui
 * corrige son appel.
 */
export function normalizeEventDate(date: string, precision: DatePrecision): NormalizedEventDate {
  if (precision === "unknown") return { date: null, datePrecision: "unknown" };
  if (!ISO_DAY.test(date)) {
    throw new Error(`Date « ${date} » invalide : attendu AAAA-MM-JJ, ou datePrecision "unknown" si le texte ne la donne pas.`);
  }
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new Error(`Date « ${date} » impossible dans le calendrier.`);
  }
  return { date: precision === "month" ? `${date.slice(0, 7)}-01` : date, datePrecision: precision };
}

/** Espaces, retours à la ligne et apostrophes normalisés : le modèle recopie « tel quel » à une
 *  ponctuation près, pas au caractère près. */
export function normalizeForMatch(text: string): string {
  return text
    .replace(/[’‘`´]/g, "'")
    // Les guillemets disparaissent des deux côtés : « x » et "x" doivent se retrouver, espaces compris.
    .replace(/["“”«»]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** Le passage doit se trouver dans le document : c'est la preuve que l'événement n'est pas inventé. */
export function excerptIsInDocument(excerpt: string, documentText: string): boolean {
  const needle = normalizeForMatch(excerpt);
  return needle.length > 0 && normalizeForMatch(documentText).includes(needle);
}

export function splitDocumentIntoParts(text: string, partChars = DOCUMENT_PART_CHARS): string[] {
  if (text.length <= partChars) return [text];
  const parts: string[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = Math.min(cursor + partChars, text.length);
    // Coupe à une fin de ligne quand c'est possible : une entrée de journal ne doit pas être
    // tranchée en deux au milieu d'une phrase.
    if (end < text.length) {
      const newline = text.lastIndexOf("\n", end);
      if (newline > cursor + partChars / 2) end = newline + 1;
    }
    parts.push(text.slice(cursor, end));
    cursor = end;
  }
  return parts;
}

export function buildEventReaderTools(params: { audienceLabels: string[] }): LlmToolDefinition[] {
  const audienceProperty =
    params.audienceLabels.length > 0
      ? { type: "array", items: { type: "string", enum: params.audienceLabels }, description: "Les publics du sujet pour qui cet événement est intéressant. Vide si tu ne sais pas." }
      : { type: "array", items: { type: "string" }, description: "Vide : aucun public n'est encore défini pour ce sujet." };

  return [
    {
      name: LIST_DOCUMENTS_TOOL,
      description: "Les documents du sujet qui restent à lire, avec leur nombre de parties.",
      input_schema: { type: "object", properties: {}, required: [] },
    },
    {
      name: READ_DOCUMENT_TOOL,
      description: "Le texte intégral d'une partie d'un document. Lis toutes les parties d'un document, dans l'ordre.",
      input_schema: {
        type: "object",
        properties: {
          documentId: { type: "string", description: "Id du document, tel que list_documents le donne." },
          part: { type: "integer", description: "Numéro de la partie, à partir de 1." },
        },
        required: ["documentId", "part"],
      },
    },
    {
      name: SAVE_EVENT_TOOL,
      description:
        "Enregistre UN événement trouvé dans le document en cours de lecture. Appelle-le dès que tu rencontres l'événement, avant de continuer à lire.",
      input_schema: {
        type: "object",
        properties: {
          date: { type: "string", description: "AAAA-MM-JJ. Au mois près : AAAA-MM-01. Chaîne vide si la précision est unknown." },
          datePrecision: { type: "string", enum: [...DATE_PRECISIONS], description: "day : le texte donne le jour. month : le mois seulement. unknown : aucune date dans le texte." },
          title: { type: "string", description: "Le moment, pas un thème. « Le testeur lâche la manette au bout de 40 secondes », jamais « Le test »." },
          whatHappened: { type: "string", description: "2 à 5 phrases : les faits, avec les chiffres et les noms tels qu'ils sont dans le texte. Rien d'autre." },
          whatChanged: { type: "string", description: "Ce que ça a changé ensuite d'après le texte (une décision, un abandon, un chiffre qui bouge). Chaîne vide si le texte ne le dit pas." },
          kind: { type: "string", enum: [...EVENT_KINDS], description: "failure : quelque chose a cassé ou raté. decision : un choix pris. result : une mesure, un chiffre. feedback : ce qu'une personne a dit ou fait. milestone : une étape franchie, une première fois." },
          audiences: audienceProperty,
          sourceMaterialId: { type: "string", description: "Id du document où se trouve l'événement." },
          excerpt: { type: "string", description: `Le passage exact du document qui prouve l'événement, copié tel quel, ${MAX_EXCERPT_CHARS} caractères au plus.` },
        },
        required: ["date", "datePrecision", "title", "whatHappened", "whatChanged", "kind", "audiences", "sourceMaterialId", "excerpt"],
      },
    },
  ];
}

export interface EventReaderPromptContext {
  brandName: string;
  subjectName: string;
  subjectDescription: string | null;
  audiences: Array<{ label: string; who: string }>;
  unreadDocuments: number;
  alreadyReadDocuments: number;
  existingEvents: Array<{ date: string | null; title: string }>;
}

export function buildEventReaderSystemPrompt(context: EventReaderPromptContext): string {
  return `Tu es le lecteur de la matière de ${context.brandName}, sur le sujet « ${context.subjectName} ». Tu lis tout ce qui a été déposé et tu en sors les événements : ce qui s'est passé, quand, et ce que ça a changé. Tu n'écris jamais de post : d'autres s'en serviront pour raconter.

Un événement est un moment précis : un échec, une décision, un résultat mesuré, ce qu'une personne a dit ou fait, une étape franchie. Ce n'est ni un thème, ni une fonctionnalité, ni une description de comment le système marche. « Le premier testeur lâche la manette au bout de 40 secondes parce que le saut semble mou », jamais « Le test » ni « La mécanique de saut ». (Exemple fictif : ne le réutilise jamais.)

<methode>
1. Appelle ${LIST_DOCUMENTS_TOOL}.
2. Lis chaque document qui reste à lire, en entier, partie par partie et dans l'ordre, avec ${READ_DOCUMENT_TOOL}. Ne saute aucune partie.
3. Dès que tu rencontres un événement, enregistre-le avec ${SAVE_EVENT_TOOL}, avant de continuer. Plusieurs événements dans une même partie : plusieurs appels.
4. Quand tout est lu, réponds en une ou deux phrases ce que tu as lu et combien d'événements tu as enregistrés.
</methode>

<regles>
- Les faits viennent du texte, et seulement du texte. Chiffres, noms, dates : tels quels. Rien n'est déduit, rien n'est arrondi, rien n'est ajouté.
- La date est celle que le texte donne. Un journal daté : la date de l'entrée (précision day). Un texte qui dit « en mars » : le mois (precision month). Une doc technique sans date : unknown, même si tu as une intuition. « Dernière mise à jour : octobre 2026 » date le document, pas ce qu'il rapporte : un fait tiré d'une telle doc est unknown, sauf si le texte lui donne sa propre date.
- Dans un journal, chaque entrée datée qui rapporte quelque chose est un événement : n'en saute pas parce qu'elle paraît petite. Le tout premier moment d'un projet (la conversation ou le constat qui l'a déclenché, le premier prototype) est un événement, et souvent le plus important.
- Un même document peut donner plusieurs événements à la même date s'il raconte plusieurs choses ce jour-là (une décision et un échec, par exemple).
- Une doc technique qui décrit comment le système fonctionne ne contient pas d'événement, sauf ce qu'elle rapporte d'arrivé : une mesure (« 4 % de faux positifs sur 120 répétitions »), un abandon (« statut : abandonné »), un seuil choisi après un test. Dans ce cas enregistre-le, avec precision unknown si rien ne le date.
- Un journal de commits : pas un événement par commit. Regroupe, et garde ce qui raconte quelque chose : une décision, un échec, un chiffre, un abandon, une première fois. Un simple « ajout de la page X » n'est pas un événement.
- Un événement déjà enregistré (liste ci-dessous) ne se réenregistre pas, même raconté par un autre document. Passe.
- whatChanged dit la suite que le texte donne (« une semaine après, la caméra à 45° est imposée »). Si le texte ne dit rien, chaîne vide : ne devine pas.
- excerpt est copié tel quel du document, ${MAX_EXCERPT_CHARS} caractères au plus. C'est la preuve. Un passage introuvable fait refuser l'événement : recopie alors plus court et plus exactement.
- audiences : seulement parmi les publics listés. Vide si aucun ne s'impose.
</regles>`;
}

export function buildEventReaderUserMessage(context: EventReaderPromptContext): string {
  const lines: string[] = [];
  lines.push(`Sujet : ${context.subjectName}${context.subjectDescription ? ` — ${context.subjectDescription}` : ""}`);
  if (context.audiences.length > 0) {
    lines.push("Publics du sujet :");
    for (const a of context.audiences) lines.push(`- ${a.label} : ${a.who}`);
  } else {
    lines.push("Publics du sujet : aucun défini pour l'instant (laisse audiences vide).");
  }
  lines.push(
    `Documents à lire : ${context.unreadDocuments}.${context.alreadyReadDocuments > 0 ? ` Déjà lus lors d'une lecture précédente : ${context.alreadyReadDocuments}, ne les relis pas.` : ""}`
  );
  if (context.existingEvents.length > 0) {
    lines.push(`Événements déjà enregistrés (${context.existingEvents.length}), à ne pas refaire :`);
    for (const e of context.existingEvents) lines.push(`- ${e.date ?? "date inconnue"} : ${e.title}`);
  } else {
    lines.push("Aucun événement enregistré pour l'instant.");
  }
  lines.push("", `Commence par ${LIST_DOCUMENTS_TOOL}.`);
  return lines.join("\n");
}

// --- Qualification des publics (docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md §3) ---
// Les événements lus avant que le portrait des lecteurs existe n'ont pas de public ; quand le portrait
// naît ou change, on leur en donne un en un appel structuré par lot, sans relire les documents.

export const QUALIFY_EVENTS_TOOL = "qualify_events";

export const qualifiedEventsSchema = z.object({
  events: z.array(z.object({ id: z.string().min(1), audiences: z.array(z.string().trim().min(1)).max(5) })),
});

export function buildQualifyEventsTool(audienceLabels: string[]): LlmToolDefinition {
  return {
    name: QUALIFY_EVENTS_TOOL,
    description: "Dit, pour chaque événement, à quels publics du sujet il peut intéresser.",
    input_schema: {
      type: "object",
      properties: {
        events: {
          type: "array",
          description: "Un élément par événement fourni, dans le même ordre, avec son id tel quel.",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              audiences: {
                type: "array",
                items: { type: "string", enum: audienceLabels },
                description: "Les publics pour qui cet événement vaut un post. Vide si aucun : il restera visible de toutes les séries.",
              },
            },
            required: ["id", "audiences"],
          },
        },
      },
      required: ["events"],
    },
  };
}

export function buildQualifyEventsPrompt(params: {
  subjectName: string;
  readers: Array<{ label: string; who: string; wants: string; stopsFor: string; turnsOff: string }>;
  events: Array<{ id: string; date: string | null; title: string; whatHappened: string; kind: string }>;
}): { system: string; userMessage: string } {
  const system = `Tu ranges les événements de la ligne de temps de « ${params.subjectName} » par public. Pour chaque événement, dis à quels publics du sujet il peut faire un post qui les arrête : un public est retenu si l'événement lui apprend quelque chose qu'il vient chercher, pas s'il peut vaguement le concerner. Un événement peut viser plusieurs publics, ou aucun. Ne modifie pas les événements, ne saute aucun id.`;
  const readers = params.readers
    .map((r) => `- ${r.label} : ${r.who}${r.wants ? ` Vient chercher : ${r.wants}` : ""}${r.stopsFor ? ` S'arrête pour : ${r.stopsFor}` : ""}${r.turnsOff ? ` Fuit : ${r.turnsOff}` : ""}`)
    .join("\n");
  const events = params.events.map((e) => `- [${e.id}] ${e.date ?? "sans date"} · ${e.kind} · ${e.title} — ${e.whatHappened}`).join("\n");
  return { system, userMessage: `Publics du sujet :\n${readers}\n\nÉvénements :\n${events}\n\nRéponds via ${QUALIFY_EVENTS_TOOL}.` };
}

/** Plafond de tours pour une lecture : chaque partie demande au moins un tour, et les enregistrements
 *  s'ajoutent (souvent groupés dans le même tour). Borné pour qu'une lecture ne tourne jamais sans fin. */
export function maxTurnsForParts(totalParts: number): number {
  return Math.min(160, 12 + totalParts * 4);
}
