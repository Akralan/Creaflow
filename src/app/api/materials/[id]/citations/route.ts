import { NextResponse } from "next/server";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { sourceMaterialCitations } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { getMaterialForUser } from "@/lib/services/sourceMaterialService";
import { handleApiError } from "@/lib/api/errors";

/** Citations pointant vers ce document, tous scripts confondus — sert au surlignage dans le panneau
 *  Matière (docs/SPEC_MATIERE_EDITEUR.md §3, visualisation de debug demandée par l'utilisateur). */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = await requireUserId();
    const { id } = await params;
    await getMaterialForUser(userId, id); // 404 si le document n'existe pas / n'appartient pas à l'utilisateur

    const citations = await db.query.sourceMaterialCitations.findMany({
      where: and(eq(sourceMaterialCitations.sourceMaterialId, id), eq(sourceMaterialCitations.userId, userId)),
      with: { script: { columns: { id: true, title: true } } },
    });

    return NextResponse.json({
      citations: citations.map((c) => ({
        id: c.id,
        scriptId: c.script?.id ?? null,
        scriptTitle: c.script?.title ?? null,
        excerpt: c.excerpt,
        matchStart: c.matchStart,
        matchLength: c.matchLength,
      })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
