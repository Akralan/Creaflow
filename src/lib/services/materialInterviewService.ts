import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { products, subjectInterviewSessions } from "@/db/schema";
import { runInterviewTurn, type InterviewMessage } from "@/lib/llm/materialInterviewChat";
import { createInterviewMaterial } from "@/lib/services/sourceMaterialService";
import { ApiError } from "@/lib/api/errors";

const MAX_HISTORY_MESSAGES = 20;

function sessionWhere(userId: string, productId: string | null) {
  return and(
    eq(subjectInterviewSessions.userId, userId),
    productId ? eq(subjectInterviewSessions.productId, productId) : isNull(subjectInterviewSessions.productId)
  );
}

export async function getInterviewHistory(userId: string, productId: string | null): Promise<InterviewMessage[]> {
  const session = await db.query.subjectInterviewSessions.findFirst({ where: sessionWhere(userId, productId) });
  return (session?.messages as InterviewMessage[] | undefined) ?? [];
}

/**
 * Un tour d'interview (docs/SPEC_MATIERE_EDITEUR.md §3.7) : persiste le message utilisateur + la
 * réponse, et si de la matière a été extraite, crée un SourceMaterial (kind="interview"),
 * immédiatement utilisable — même pipeline que le collage direct (§3).
 */
export async function appendInterviewTurn(userId: string, productId: string | null, userMessage: string) {
  let subjectLabel = "l'activité de la marque";
  if (productId) {
    const product = await db.query.products.findFirst({ where: and(eq(products.id, productId), eq(products.userId, userId)) });
    if (!product) {
      throw new ApiError(404, "Sujet introuvable.");
    }
    subjectLabel = product.name;
  }

  const session = await db.query.subjectInterviewSessions.findFirst({ where: sessionWhere(userId, productId) });
  const priorMessages = (session?.messages as InterviewMessage[] | undefined) ?? [];
  const messagesWithUser: InterviewMessage[] = [...priorMessages, { role: "user", content: userMessage }];

  const result = await runInterviewTurn({ subjectLabel, history: messagesWithUser.slice(-MAX_HISTORY_MESSAGES) });

  const messages: InterviewMessage[] = [...messagesWithUser, { role: "assistant", content: result.assistantReply }];

  if (session) {
    await db
      .update(subjectInterviewSessions)
      .set({ messages, updatedAt: new Date() })
      .where(eq(subjectInterviewSessions.id, session.id));
  } else {
    await db.insert(subjectInterviewSessions).values({ userId, productId, messages });
  }

  let createdMaterialId: string | null = null;
  if (result.extractedMaterial?.trim()) {
    const material = await createInterviewMaterial(userId, { productId, rawText: result.extractedMaterial.trim() });
    createdMaterialId = material.id;
  }

  return { reply: result.assistantReply, extractedMaterial: result.extractedMaterial, createdMaterialId };
}
