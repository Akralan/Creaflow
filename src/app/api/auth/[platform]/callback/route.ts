import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections, inspirationVideos } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { socialProviders, hasOAuthProvider } from "@/lib/social";
import { updateStyleProfileForUser } from "@/lib/services/styleProfileService";
import { ApiError, handleApiError } from "@/lib/api/errors";
import { logger } from "@/lib/logger";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const userId = await requireUserId();
    const { platform } = await params;
    if (!hasOAuthProvider(platform)) {
      throw new ApiError(404, "Cette plateforme ne propose pas de connexion OAuth.");
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code) {
      throw new ApiError(400, "Code OAuth manquant.");
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(`oauth_state_${platform}`)?.value;
    const returnTo = cookieStore.get(`oauth_return_${platform}`)?.value || "/";
    cookieStore.delete(`oauth_state_${platform}`);
    cookieStore.delete(`oauth_return_${platform}`);
    if (!state || state !== expectedState) {
      throw new ApiError(400, "State OAuth invalide, réessaie la connexion.");
    }

    const provider = socialProviders[platform]!;
    // `state` sert aussi de code_verifier PKCE pour X (cf. src/lib/social/x.ts) — les autres
    // providers ignorent simplement ce second paramètre.
    const tokens = await provider.exchangeCode(code, state);

    const existing = await db.query.socialConnections.findFirst({
      where: and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)),
    });

    if (existing) {
      await db
        .update(socialConnections)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          accessTokenExpiresAt: tokens.expiresAt ?? null,
          status: "ok",
          platformUserId: tokens.platformUserId,
          connectedAt: new Date(),
        })
        .where(eq(socialConnections.id, existing.id));
    } else {
      await db.insert(socialConnections).values({
        userId,
        platform,
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        accessTokenExpiresAt: tokens.expiresAt ?? null,
        platformUserId: tokens.platformUserId,
      });
    }

    // La récupération des posts peut échouer indépendamment (ex: accès API restreint
    // sur LinkedIn, cf. commentaire dans lib/social/linkedin.ts) sans invalider la
    // connexion du compte, qui est déjà enregistrée à ce stade.
    try {
      const posts = await provider.fetchRecentPosts(tokens);
      if (posts.length > 0) {
        await db.insert(inspirationVideos).values(
          posts.map((post) => ({
            userId,
            platform,
            externalUrl: post.externalUrl,
            captionText: post.captionText,
            metadata: post.metadata,
          }))
        );
        await updateStyleProfileForUser(userId);
      }
    } catch (err) {
      logger.error("Récupération des posts échouée (connexion tout de même enregistrée)", err, { platform });
    }

    const redirectUrl = new URL(returnTo, request.url);
    redirectUrl.searchParams.set("connected", platform);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    return handleApiError(error);
  }
}
