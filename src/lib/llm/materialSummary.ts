import { z } from "zod";
import type { LlmToolDefinition } from "./types";
import { callStructured } from "./provider";

/**
 * Summary of a material document in one or two sentences. Born with the editor-in-chief
 * (docs/SPEC_REDACTEUR_EN_CHEF.md §3.1, removed by docs/SPEC_REDACTEUR_PAR_EVENEMENTS.md Lot 4), it
 * still serves the reader portrait, the series framing and the display under each document.
 */

const MAX_SUMMARY_LENGTH = 300;

const SUMMARIZE_MATERIAL_TOOL_NAME = "summarize_material";

const summarizeMaterialTool: LlmToolDefinition = {
  name: SUMMARIZE_MATERIAL_TOOL_NAME,
  description: "Summarizes the narrative potential of a raw material document.",
  input_schema: {
    type: "object",
    properties: {
      summary: {
        type: "string",
        description: "The narrative summary of the document in 1-2 sentences, 40 words maximum, in English.",
      },
    },
    required: ["summary"],
  },
};

const SUMMARIZE_MATERIAL_SYSTEM_PROMPT = `You summarize a raw material document for a content creator's editorial direction. In 1 to 2 sentences (40 words maximum), say what HAPPENED in this document and where its narrative potential lies: the event, the change, the striking number, the failure, the decision or the surprise. Don't describe the document ("this document contains..."): tell what it teaches. If it only contains data without an event, say so in one factual sentence. Write in English, even if the document is in another language. Answer via the provided tool.`;

const materialSummarySchema = z.object({ summary: z.string() });

/** A single document per call, sent in full. */
export async function summarizeMaterial(rawText: string, title?: string | null): Promise<string> {
  const userMessage = title ? `[${title}]\n${rawText}` : rawText;
  const args = await callStructured({
    system: SUMMARIZE_MATERIAL_SYSTEM_PROMPT,
    userMessage,
    tool: summarizeMaterialTool,
    maxTokens: 256,
  });
  const { summary } = materialSummarySchema.parse(args);
  return summary.length > MAX_SUMMARY_LENGTH ? summary.slice(0, MAX_SUMMARY_LENGTH) : summary;
}
