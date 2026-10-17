import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getAssistantChatState, runAssistantChatTurnForUser } from "@/lib/services/assistantService";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

const schema = z.object({ message: z.string().min(1) });

export async function GET() {
  try {
    const userId = await requireUserId();
    const { messages, proposals, attachments } = await getAssistantChatState(userId);
    return NextResponse.json({ messages, proposals, attachments });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    // An assistant chat turn now triggers SEVERAL LLM calls (agentic loop, up to
    // maxTurns — docs/SPEC_ASSISTANT_AGENTIQUE.md §2.3/§9.4): the cap still counts turns
    // of conversation, but it is tightened accordingly.
    await enforceRateLimit("assistant-chat", userId, 10, 60);
    const { message } = schema.parse(await request.json());
    const { reply, proposals, attachments } = await runAssistantChatTurnForUser(userId, message);
    return NextResponse.json({ reply, proposals, attachments });
  } catch (error) {
    return handleApiError(error);
  }
}
