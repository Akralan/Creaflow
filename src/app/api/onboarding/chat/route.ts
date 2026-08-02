import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { onboardingSessions } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { runOnboardingChatTurn, type ExtractedOnboardingProfile, type OnboardingMessage } from "@/lib/llm/onboardingChat";
import { finalizeOnboarding, mergeExtractedProfile } from "@/lib/services/onboardingService";
import { handleApiError } from "@/lib/api/errors";

const MAX_HISTORY_MESSAGES = 20;

const schema = z.object({ message: z.string().min(1) });

export async function GET() {
  try {
    const userId = await requireUserId();
    const session = await db.query.onboardingSessions.findFirst({ where: eq(onboardingSessions.userId, userId) });
    return NextResponse.json({
      messages: (session?.messages as OnboardingMessage[] | undefined) ?? [],
      complete: session?.status === "complete",
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    const { message } = schema.parse(await request.json());

    const session = await db.query.onboardingSessions.findFirst({ where: eq(onboardingSessions.userId, userId) });
    const priorMessages = (session?.messages as OnboardingMessage[] | undefined) ?? [];
    const messagesWithUser: OnboardingMessage[] = [...priorMessages, { role: "user", content: message }];

    const result = await runOnboardingChatTurn({ history: messagesWithUser.slice(-MAX_HISTORY_MESSAGES) });

    const messages: OnboardingMessage[] = [...messagesWithUser, { role: "assistant", content: result.assistantReply }];
    const extractedProfile = mergeExtractedProfile(
      (session?.extractedProfile as ExtractedOnboardingProfile | null) ?? {},
      result.extractedFields
    );
    const status = result.complete ? "complete" : "in_progress";

    if (session) {
      await db
        .update(onboardingSessions)
        .set({ messages, extractedProfile, status, updatedAt: new Date() })
        .where(eq(onboardingSessions.id, session.id));
    } else {
      await db.insert(onboardingSessions).values({ userId, messages, extractedProfile, status });
    }

    if (result.complete) {
      await finalizeOnboarding(userId, extractedProfile);
    }

    return NextResponse.json({ reply: result.assistantReply, complete: result.complete, extractedProfile });
  } catch (error) {
    return handleApiError(error);
  }
}
