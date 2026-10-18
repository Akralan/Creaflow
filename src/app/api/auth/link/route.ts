import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError } from "@/lib/api/errors";
import { setSessionCookie } from "@/lib/auth/session";
import { consumeLoginLink } from "@/lib/services/loginLinkService";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";
import { generateOtherPosts, requestOtherPosts } from "@/lib/services/startJobService";

const schema = z.object({ token: z.string().min(20).max(200) });

/**
 * Consomme le lien d'un email : ouvre la session, et au premier usage lance l'écriture des deux autres
 * posts de la semaine (docs/SPEC_ENTREE_PAR_LE_REPO.md §6). Appelé par la page à son ouverture, jamais
 * par un GET, pour qu'un scanner de liens de messagerie ne brûle pas le jeton.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip) await enforceRateLimit("login-link-ip", ip, 20, 60 * 60);
    const { token } = schema.parse(await request.json());
    const { userId } = await consumeLoginLink(token);
    await setSessionCookie(userId);
    if (await requestOtherPosts(userId)) after(() => generateOtherPosts(userId));
    return NextResponse.json({ ok: true, redirect: "/calendar" });
  } catch (error) {
    return handleApiError(error);
  }
}
