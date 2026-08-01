import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { requireUserId } from "@/lib/auth/session";
import { socialProviders, isSocialPlatform } from "@/lib/social";
import { ApiError, handleApiError } from "@/lib/api/errors";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ platform: string }> }
) {
  try {
    await requireUserId();
    const { platform } = await params;
    if (!isSocialPlatform(platform)) {
      throw new ApiError(404, "Plateforme inconnue.");
    }

    const state = crypto.randomBytes(16).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set(`oauth_state_${platform}`, state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });

    return NextResponse.redirect(socialProviders[platform].getAuthUrl(state));
  } catch (error) {
    return handleApiError(error);
  }
}
