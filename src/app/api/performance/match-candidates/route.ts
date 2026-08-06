import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { postMatchCandidates } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const userId = await requireUserId();
    const candidates = await db.query.postMatchCandidates.findMany({
      where: and(eq(postMatchCandidates.userId, userId), eq(postMatchCandidates.status, "pending")),
      orderBy: (c, { desc }) => [desc(c.score)],
      with: { script: { columns: { title: true } } },
    });

    return NextResponse.json({
      candidates: candidates.map(({ script, ...c }) => ({ ...c, scriptTitle: script.title })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
