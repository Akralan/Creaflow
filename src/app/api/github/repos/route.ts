import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { githubAccounts } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { listPublicRepos, GithubRateLimitError } from "@/lib/github/client";
import { createGithubSources } from "@/lib/services/githubSourceService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { MAX_PRODUCTS } from "@/lib/validation";

const connectSchema = z.object({
  repos: z
    .array(
      z.object({
        externalId: z.string().min(1),
        fullName: z.string().min(1),
        name: z.string().min(1),
        description: z.string().nullable(),
        defaultBranch: z.string().min(1),
        language: z.string().nullable(),
        pushedAt: z.string(),
      })
    )
    .min(1)
    .max(MAX_PRODUCTS),
});

async function requireGithubToken(userId: string): Promise<string> {
  const account = await db.query.githubAccounts.findFirst({ where: eq(githubAccounts.userId, userId) });
  if (!account) {
    throw new ApiError(400, "Aucun compte GitHub connecté.");
  }
  return account.accessToken;
}

export async function GET() {
  try {
    const userId = await requireUserId();
    const token = await requireGithubToken(userId);
    return NextResponse.json({ repos: await listPublicRepos(token) });
  } catch (error) {
    // Le quota atteint n'est pas une panne : 429 et message daté, pas un 500 "Erreur serveur".
    if (error instanceof GithubRateLimitError) {
      return handleApiError(new ApiError(429, error.message));
    }
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId();
    await requireGithubToken(userId);
    const { repos } = connectSchema.parse(await request.json());
    // Synchrone : l'ingestion est du fetch et de l'écriture, aucun appel LLM (le résumé est laissé
    // au backfill paresseux). L'UI restitue le détail dépôt par dépôt à partir du tableau renvoyé.
    const results = await createGithubSources(userId, repos);
    return NextResponse.json({ results }, { status: 201 });
  } catch (error) {
    return handleApiError(error);
  }
}
