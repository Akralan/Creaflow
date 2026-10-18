import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { enforceRateLimit, getClientIp, pseudonymizeIdentifier } from "@/lib/services/rateLimitService";
import { analyzeRepo } from "@/lib/services/startService";

const schema = z.object({ repo: z.string().min(1).max(300) });

/** Lecture anonyme d'un dépôt public et carte à trois champs (docs/SPEC_ENTREE_PAR_LE_REPO.md §4). Rien n'est écrit. */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const { repo } = schema.parse(await request.json());
    if (ip) {
      await enforceRateLimit("start-analyze-ip", ip, 5, 60 * 60);
      // Le même dépôt revient au plus deux fois par minute et par IP : un aller-retour, pas une boucle.
      await enforceRateLimit("start-analyze-repo", pseudonymizeIdentifier(`${ip}:${repo.trim().toLowerCase()}`), 2, 60);
    }
    return NextResponse.json(await analyzeRepo(repo));
  } catch (error) {
    return handleApiError(error);
  }
}
