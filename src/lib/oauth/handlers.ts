import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { getCurrentUserId, setSessionCookie } from "@/lib/auth/session";
import { resolveOAuthAccount } from "@/lib/services/oauthAccountService";
import { enforceRateLimit, getClientIp } from "@/lib/services/rateLimitService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { getIdentityProvider } from "./registry";
import { isOnboardingComplete } from "@/lib/services/onboardingService";

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

function returnCookieName(providerId: string): string {
  return `oauth_return_${providerId}`;
}

/** Chemin interne uniquement : un `returnTo` absolu, en `//hôte`, ou glissant une tabulation ou un
 *  retour à la ligne (que l'analyseur d'URL supprime : « /<tab>/evil.com » devient « //evil.com »)
 *  ferait de la route une redirection ouverte. On n'accepte que l'ASCII imprimable, puis on vérifie
 *  que l'URL résolue reste sur l'origine. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !/^\/(?![/\\])[\x21-\x7e]*$/.test(value)) return null;
  const base = "http://creaflow.invalid";
  return new URL(value, base).origin === base ? value : null;
}

function withError(path: string, message: string): string {
  return `${path}${path.includes("?") ? "&" : "?"}oauthError=${encodeURIComponent(message)}`;
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

/** Pas de `requireUserId()` : c'est une porte d'entrée (inscription ET connexion). Mais quand une
 *  session est déjà ouverte, le même trajet BRANCHE le compte tiers sur l'utilisateur connecté
 *  (docs/SPEC_ONBOARDING_MVP.md §3) — c'est le callback qui le décide, en lisant la session.
 *  `returnTo` (chemin interne) dit où revenir : l'écran de l'onboarding ou des paramètres. */
export async function handleOAuthStart(providerId: string, returnTo: string | null = null): Promise<NextResponse> {
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
    const returnPath = safeReturnPath(returnTo);
    if (returnPath) {
      cookieStore.set(returnCookieName(providerId), returnPath, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: STATE_COOKIE_MAX_AGE,
      });
    } else {
      cookieStore.delete(returnCookieName(providerId));
    }

    return NextResponse.redirect(provider.buildAuthorizeUrl(state));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function handleOAuthCallback(request: NextRequest, providerId: string): Promise<NextResponse> {
  const cookieStore = await cookies();
  const returnPath = safeReturnPath(cookieStore.get(returnCookieName(providerId))?.value);
  cookieStore.delete(returnCookieName(providerId));
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

    const expectedState = cookieStore.get(stateCookieName(providerId))?.value;
    cookieStore.delete(stateCookieName(providerId));
    if (!state || state !== expectedState) {
      throw new ApiError(400, "State OAuth invalide, réessaie la connexion.");
    }

    const { tokens, identity } = await provider.exchangeCode(code, state);
    if (!identity.providerUserId) {
      throw new ApiError(502, `${provider.displayName} n'a pas renvoyé d'identifiant de compte exploitable.`);
    }

    const sessionUserId = await getCurrentUserId();
    const { userId, isNew } = await resolveOAuthAccount(providerId, identity, tokens, sessionUserId);
    if (userId !== sessionUserId) await setSessionCookie(userId);

    // Sans profil, l'onboarding n'est pas terminé : on y retourne, même pour un compte existant.
    const hasProfile = !isNew && (await isOnboardingComplete(userId));
    const destination = returnPath ?? (hasProfile ? "/calendar" : "/onboarding");
    return NextResponse.redirect(new URL(destination, request.url));
  } catch (error) {
    // Le trajet est une suite de redirections : une erreur métier (compte déjà utilisé, email non
    // vérifié) revient sur l'écran de départ, lisible, plutôt qu'en JSON brut dans le navigateur.
    if (error instanceof ApiError && error.status < 500) {
      return NextResponse.redirect(new URL(withError(returnPath ?? "/login", error.message), request.url));
    }
    return handleApiError(error);
  }
}
