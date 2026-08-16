import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getAssistantChatState, runAssistantChatTurnForUser } from "@/lib/services/assistantService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({ message: z.string().min(1), urls: z.array(z.url()).max(3).optional() });

export async function GET() {
  try {
    const userId = await requireUserId();
    const { messages, proposals } = await getAssistantChatState(userId);
    return NextResponse.json({ messages, proposals });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // Chaque tour de chat assistant déclenche un appel LLM — protège contre le spam.
    await enforceRateLimit("assistant-chat", userId, 20, 60);
    const { message, urls } = schema.parse(await request.json());
    const { reply, proposals, sourceErrors } = await runAssistantChatTurnForUser(userId, message, urls ?? []);
    return NextResponse.json({ reply, proposals, sourceErrors });
  } catch (error) {
    return handleApiError(error);
  }
}
