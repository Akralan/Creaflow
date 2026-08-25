import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { applySelectionInstruction, regenerateBlock, type SelectionBlockField } from "@/lib/services/microEditService";
import { enforceMicroEditQuota } from "@/lib/services/billingService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const BLOCK_FIELD_RE = /^(title|hookVisual|hookText|hookAudio|caption|storyboard\.\d+)$/;

const schema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("selection_instruction"),
    blockField: z.string().regex(BLOCK_FIELD_RE, "Champ inconnu."),
    selectedText: z.string().min(1),
    instruction: z.string().min(1),
  }),
  z.object({
    action: z.literal("block_regenerate"),
    block: z.enum(["hook", "storyboard", "caption", "hashtags"]),
  }),
]);

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    // Micro-retouche = appel LLM texte court, mais reste un appel LLM — limite dédiée, plus généreuse
    // que "script-generate" puisque l'itération est tout le but de l'éditeur (§4.4).
    await enforceRateLimit("script-micro-edit", userId, 40, 60);
    const body = schema.parse(await request.json());
    await enforceMicroEditQuota(userId);

    const script =
      body.action === "selection_instruction"
        ? await applySelectionInstruction(userId, id, {
            blockField: body.blockField as SelectionBlockField,
            selectedText: body.selectedText,
            instruction: body.instruction,
          })
        : await regenerateBlock(userId, id, body.block);

    return NextResponse.json({ script });
  } catch (error) {
    return handleApiError(error);
  }
}
