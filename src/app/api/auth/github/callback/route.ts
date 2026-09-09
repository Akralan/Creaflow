import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { exchangeCode, fetchViewer } from "@/lib/github/client";
import { resolveGithubAccount } from "@/lib/services/githubAuthService";
import { setSessionCookie } from "@/lib/auth/session";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";

export async function GET(request: NextRequest) {
  try {
    // Même esprit que signup-ip : une connexion GitHub peut créer un compte, c'est donc aussi une
    // porte de création massive à protéger.
    const ip = getClientIp(request);
    if (ip) {
      await enforceRateLimit("github-oauth", ip, 10, 60 * 60);
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code) {
      throw new ApiError(400, "Code OAuth manquant.");
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get("github_oauth_state")?.value;
    cookieStore.delete("github_oauth_state");
    if (!state || state !== expectedState) {
      throw new ApiError(400, "State OAuth invalide, réessaie la connexion.");
    }

    const { accessToken, scope } = await exchangeCode(code);
    const viewer = await fetchViewer(accessToken);
    const { userId, isNew } = await resolveGithubAccount(viewer, accessToken, scope);

    await setSessionCookie(userId);

    return NextResponse.redirect(new URL(isNew ? "/onboarding" : "/calendar", request.url));
  } catch (error) {
    return handleApiError(error);
  }
}
