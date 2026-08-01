import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { socialConnections } from "@/db/schema";
import { requireUserId } from "@/lib/auth/session";
import { SOCIAL_PLATFORMS } from "@/lib/social";
import { handleApiError } from "@/lib/api/errors";

export async function GET() {
  try {
    const userId = await requireUserId();
    const connections = await db.query.socialConnections.findMany({
      where: eq(socialConnections.userId, userId),
      columns: { platform: true, connectedAt: true },
    });

    const status = SOCIAL_PLATFORMS.map((platform) => {
      const found = connections.find((c) => c.platform === platform);
      return {
        platform,
        connected: Boolean(found),
        connectedAt: found?.connectedAt ?? null,
      };
    });

    return NextResponse.json({ connections: status });
  } catch (error) {
    return handleApiError(error);
  }
}
