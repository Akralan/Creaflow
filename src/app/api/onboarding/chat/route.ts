import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { onboardingSessions, users } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import {
  runDevOnboardingChatTurn,
  runOnboardingChatTurn,
  type ExtractedOnboardingProfile,
  type OnboardingMessage,
  type OnboardingSeriesProposal,
} from "@/lib/llm/onboardingChat";
import { buildDevOnboardingContext } from "@/lib/services/devOnboardingContext";
import { finalizeOnboarding, mergeExtractedProfile } from "@/lib/services/onboardingService";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit } from "@/lib/services/rateLimitService";

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
    // Chaque tour de chat d'onboarding déclenche un appel LLM — protège contre le spam.
    await enforceRateLimit("onboarding-chat", userId, 20, 60);
    const { message } = schema.parse(await request.json());

    const session = await db.query.onboardingSessions.findFirst({ where: eq(onboardingSessions.userId, userId) });
    const priorMessages = (session?.messages as OnboardingMessage[] | undefined) ?? [];
    const messagesWithUser: OnboardingMessage[] = [...priorMessages, { role: "user", content: message }];

    // Deux parcours, un seul endpoint : le prompt dev reçoit le profil GitHub et les dépôts déjà
    // ingérés, et n'a droit qu'à deux ou trois questions. Le contrat de sortie est identique, donc
    // tout ce qui suit (fusion, finalisation) ne distingue pas les deux.
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { onboardingTrack: true },
    });

    const result =
      user?.onboardingTrack === "dev"
        ? await runDevOnboardingChatTurn({
            history: messagesWithUser.slice(-MAX_HISTORY_MESSAGES),
            dev: await buildDevOnboardingContext(userId),
          })
        : await runOnboardingChatTurn({ history: messagesWithUser.slice(-MAX_HISTORY_MESSAGES) });

    const extractedProfile = mergeExtractedProfile(
      (session?.extractedProfile as ExtractedOnboardingProfile | null) ?? {},
      result.extractedFields
    );
    const status = result.complete ? "complete" : "in_progress";

    // La finalisation (profil, rôles, séries) précède la persistance du fil : un échec de
    // finalisation laisse la session en l'état — l'utilisateur peut simplement renvoyer un message.
    // Les séries générées sont renvoyées structurées : l'UI les affiche en composant de sélection
    // (POST /api/onboarding/series-selection) plutôt que de les créer en silence.
    let series: OnboardingSeriesProposal[] = [];
    if (result.complete) {
      const finalized = await finalizeOnboarding(userId, extractedProfile);
      series = finalized.map((s) => ({
        id: s.id,
        label: s.label,
        description: s.description,
        mode: s.mode,
        categoryLabel: s.category?.label ?? null,
      }));
    }

    const messages: OnboardingMessage[] = [...messagesWithUser, { role: "assistant", content: result.assistantReply }];

    if (session) {
      await db
        .update(onboardingSessions)
        .set({ messages, extractedProfile, status, updatedAt: new Date() })
        .where(eq(onboardingSessions.id, session.id));
    } else {
      await db.insert(onboardingSessions).values({ userId, messages, extractedProfile, status });
    }

    return NextResponse.json({ reply: result.assistantReply, complete: result.complete, series, extractedProfile });
  } catch (error) {
    return handleApiError(error);
  }
}
