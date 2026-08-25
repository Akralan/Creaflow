import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { appendInterviewTurn, getInterviewHistory } from "@/lib/services/materialInterviewService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";
import { handleApiError } from "@/lib/api/errors";

const listSchema = z.object({ productId: z.uuid().optional() });
const turnSchema = z.object({ productId: z.uuid().optional(), message: z.string().min(1) });

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { productId } = listSchema.parse({ productId: request.nextUrl.searchParams.get("productId") ?? undefined });
    const messages = await getInterviewHistory(userId, productId ?? null);
    return NextResponse.json({ messages });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Chaque tour déclenche un appel LLM — même limite que le chat d'onboarding.
    await enforceRateLimit("interview-chat", userId, 20, 60);
    const { productId, message } = turnSchema.parse(await request.json());

    const result = await appendInterviewTurn(userId, productId ?? null, message);

    return NextResponse.json({ reply: result.reply, extractedMaterial: result.extractedMaterial });
  } catch (error) {
    return handleApiError(error);
  }
}
