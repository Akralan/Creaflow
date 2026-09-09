import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { setSessionCookie } from "@/lib/auth/session";
import { resolveOAuthAccount } from "@/lib/services/oauthAccountService";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { getIdentityProvider } from "./registry";

/**
 * Les deux moitiés du trajet OAuth d'un fournisseur d'identité, paramétrées par son identifiant.
 *
 * Extraites des routes pour que `/api/auth/oauth/[provider]/*` et les routes GitHub historiques
 * partagent exactement le même code : les URL de callback GitHub sont déposées sur github.com
 * depuis le chantier précédent et ne peuvent pas changer, mais rien ne justifie deux
 * implémentations (docs/SPEC_CONNECTEURS_ET_SUJETS.md §8).
 */

const STATE_COOKIE_MAX_AGE = 600;

function stateCookieName(providerId: string): string {
  return `oauth_state_${providerId}`;
}

function resolveProvider(providerId: string) {
  const provider = getIdentityProvider(providerId);
  if (!provider) {
    throw new ApiError(404, "Ce fournisseur ne propose pas de connexion.");
  }
  if (!provider.isConfigured()) {
    // Configuration absente : 404 plutôt que 500, la fonctionnalité n'existe simplement pas sur
    // cet environnement — même philosophie que Stripe et GitHub.
    throw new ApiError(404, "Ce fournisseur n'est pas configuré sur cet environnement.");
  }
  return provider;
}

/** Pas de `requireUserId()` : c'est une porte d'entrée (inscription ET connexion), pas une
 *  connexion de compte posée depuis l'app — contrairement à /api/auth/[platform]/connect. */
export async function handleOAuthStart(providerId: string): Promise<NextResponse> {
  try {
    const provider = resolveProvider(providerId);

    const state = crypto.randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(stateCookieName(providerId), state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: STATE_COOKIE_MAX_AGE,
    });

    return NextResponse.redirect(provider.buildAuthorizeUrl(state));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function handleOAuthCallback(request: NextRequest, providerId: string): Promise<NextResponse> {
  try {
    const provider = resolveProvider(providerId);

    // Même esprit que signup-ip : une connexion tierce peut créer un compte, c'est donc aussi une
    // porte de création massive à protéger. Compteur par fournisseur, pour qu'un abus sur l'un
    // ne ferme pas les autres.
    const ip = getClientIp(request);
    if (ip) {
      await enforceRateLimit(`oauth-${providerId}`, ip, 10, 60 * 60);
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code) {
      throw new ApiError(400, "Code OAuth manquant.");
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(stateCookieName(providerId))?.value;
    cookieStore.delete(stateCookieName(providerId));
    if (!state || state !== expectedState) {
      throw new ApiError(400, "State OAuth invalide, réessaie la connexion.");
    }

    const { tokens, identity } = await provider.exchangeCode(code, state);
    if (!identity.providerUserId) {
      throw new ApiError(502, `${provider.displayName} n'a pas renvoyé d'identifiant de compte exploitable.`);
    }

    const { userId, isNew } = await resolveOAuthAccount(providerId, identity, tokens);
    await setSessionCookie(userId);

    return NextResponse.redirect(new URL(isNew ? "/onboarding" : "/calendar", request.url));
  } catch (error) {
    return handleApiError(error);
  }
}
