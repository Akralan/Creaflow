import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Interview-chat — deuxième porte d'alimentation du corpus (docs/SPEC_MATIERE_EDITEUR.md §3.7) :
 * pour qui ne tient pas de journal, le corpus ne se colle pas, il s'extrait. Pattern maison identique
 * à l'onboarding (une question à la fois, jamais un formulaire déguisé) — cf. onboardingChat.ts.
 */
export interface InterviewMessage {
  role: "user" | "assistant";
  content: string;
}

export const interviewTurnResultSchema = z.object({
  assistantReply: z.string().min(1),
  extractedMaterial: z.string().nullable(),
});
export type InterviewTurnResult = z.infer<typeof interviewTurnResultSchema>;

const RECORD_INTERVIEW_TURN_TOOL_NAME = "record_interview_turn";
const recordInterviewTurnTool: LlmToolDefinition = {
  name: RECORD_INTERVIEW_TURN_TOOL_NAME,
  description: "Répond au message de l'utilisateur et extrait la matière factuelle donnée à ce tour, le cas échéant.",
  input_schema: {
    type: "object",
    properties: {
      assistantReply: {
        type: "string",
        description: "Question suivante ou relance, conversationnelle — pose UNE question à la fois.",
      },
      extractedMaterial: {
        type: ["string", "null"],
        description:
          "Contenu factuel concret donné par l'utilisateur À CE TOUR (anecdote, décision, chiffre, bug, learning), reformulé proprement. null si le message ne contient rien d'exploitable.",
      },
    },
    required: ["assistantReply", "extractedMaterial"],
  },
};

const SYSTEM_PROMPT = `Tu interviewes un créateur pour faire émerger de la matière concrète à réutiliser dans ses futurs posts social media — il ne tient pas de journal, sa matière est dans sa tête, ton rôle est de l'extraire.

Règles :
- Pose une seule question à la fois, jamais un formulaire déguisé — sur des faits concrets : une anecdote récente, une décision prise, un chiffre, un problème rencontré, un apprentissage.
- Après chaque réponse, relance sur un autre angle concret plutôt que de rester sur le même sujet trop longtemps.
- Tu ne dois JAMAIS inventer une information factuelle qui ne t'a pas été donnée explicitement par l'utilisateur. Reformule ce qu'il dit, n'ajoute rien.
- Si le message de l'utilisateur ne contient aucune information factuelle exploitable (salutation, hésitation...), extractedMaterial doit être null.`;

export interface MaterialInterviewContext {
  subjectLabel: string;
  history: InterviewMessage[];
}

export async function runInterviewTurn(context: MaterialInterviewContext): Promise<InterviewTurnResult> {
  const transcript = [
    `Sujet de l'interview : ${context.subjectLabel}`,
    ...context.history.map((m) => `${m.role === "user" ? "Utilisateur" : "Assistant"} : ${m.content}`),
  ].join("\n");

  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: transcript,
    tool: recordInterviewTurnTool,
    maxTokens: 1024,
  });

  return interviewTurnResultSchema.parse(args);
}
