import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireUserId } from "@/lib/auth/session";
import { socialProviders, hasOAuthProvider } from "@/lib/social";
import { ApiError, handleApiError } from "@/lib/api/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    await requireUserId();
    const { platform } = await params;
    if (!hasOAuthProvider(platform)) {
      throw new ApiError(404, "Cette plateforme ne propose pas de connexion OAuth.");
    }

    // 32 octets (64 caractères hex) plutôt que 16 : satisfait aussi bien le rôle de nonce CSRF
    // que les contraintes RFC 7636 du code_verifier PKCE requis par X (43-128 caractères parmi
    // [A-Za-z0-9-._~], dont l'hexadécimal est un sous-ensemble strict) — cf. src/lib/social/x.ts.
    const state = crypto.randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(`oauth_state_${platform}`, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    // Mémorise l'écran d'origine (onboarding, paramètres, ...) pour y revenir après le callback.
    const returnTo = request.nextUrl.searchParams.get("returnTo") || "/";
    cookieStore.set(`oauth_return_${platform}`, returnTo, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(socialProviders[platform]!.getAuthUrl(state));
  } catch (error) {
    return handleApiError(error);
  }
}
