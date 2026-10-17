import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Interview-chat — second entry point for feeding the corpus (docs/SPEC_MATIERE_EDITEUR.md §3.7):
 * for someone who doesn't keep a journal, the corpus isn't pasted, it's extracted. Same home-made
 * pattern as onboarding (one question at a time, never a disguised form) (the late onboarding chat).
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
  description: "Replies to the user's message and extracts the factual material given in this turn, if any. All text in English.",
  input_schema: {
    type: "object",
    properties: {
      assistantReply: {
        type: "string",
        description: "Next question or follow-up, conversational — ask ONE question at a time.",
      },
      extractedMaterial: {
        type: ["string", "null"],
        description:
          "Concrete factual content given by the user IN THIS TURN (anecdote, decision, number, bug, learning), cleanly reworded. null if the message contains nothing usable.",
      },
    },
    required: ["assistantReply", "extractedMaterial"],
  },
};

const SYSTEM_PROMPT = `You interview a creator to bring out concrete material to reuse in their future social media posts — they don't keep a journal, their material is in their head, your role is to extract it.

Rules:
- Ask a single question at a time, never a disguised form — about concrete facts: a recent anecdote, a decision made, a number, a problem encountered, a lesson learned.
- After each answer, follow up on another concrete angle rather than staying on the same subject too long.
- You must NEVER invent factual information that was not explicitly given to you by the user. Reword what they say, add nothing.
- If the user's message contains no usable factual information (greeting, hesitation...), extractedMaterial must be null.
- Write in English.`;

export interface MaterialInterviewContext {
  subjectLabel: string;
  history: InterviewMessage[];
}

export async function runInterviewTurn(context: MaterialInterviewContext): Promise<InterviewTurnResult> {
  const transcript = [
    `Interview subject: ${context.subjectLabel}`,
    ...context.history.map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`),
  ].join("\n");

  const args = await callStructured({
    system: SYSTEM_PROMPT,
    userMessage: transcript,
    tool: recordInterviewTurnTool,
    maxTokens: 1024,
  });

  return interviewTurnResultSchema.parse(args);
}
