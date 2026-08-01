import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections, inspirationVideos } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { socialProviders, isSocialPlatform } from "@/lib/social";
import { updateStyleProfileForUser } from "@/lib/services/styleProfileService";
import { ApiError, handleApiError } from "@/lib/api/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    const userId = await requireUserId();
    const { platform } = await params;
    if (!isSocialPlatform(platform)) {
      throw new ApiError(404, "Plateforme inconnue.");
    }

    const code = request.nextUrl.searchParams.get("code");
    const state = request.nextUrl.searchParams.get("state");
    if (!code) {
      throw new ApiError(400, "Code OAuth manquant.");
    }

    const cookieStore = await cookies();
    const expectedState = cookieStore.get(`oauth_state_${platform}`)?.value;
    cookieStore.delete(`oauth_state_${platform}`);
    if (!state || state !== expectedState) {
      throw new ApiError(400, "State OAuth invalide, réessaie la connexion.");
    }

    const provider = socialProviders[platform];
    const tokens = await provider.exchangeCode(code);

    const existing = await db.query.socialConnections.findFirst({
      where: and(eq(socialConnections.userId, userId), eq(socialConnections.platform, platform)),
    });

    if (existing) {
      await db
        .update(socialConnections)
        .set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
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
      console.error(`Récupération des posts ${platform} échouée (connexion tout de même enregistrée) :`, err);
    }

    return NextResponse.redirect(new URL(`/?connected=${platform}`, request.url));
  } catch (error) {
    return handleApiError(error);
  }
}
