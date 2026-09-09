import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { buildAuthorizeUrl } from "@/lib/github/client";
import { handleApiError } from "@/lib/api/errors";

/** Pas de requireUserId() : c'est une porte d'entrée (inscription ET connexion), pas une connexion
 *  de compte posée depuis l'app — contrairement à /api/auth/[platform]/connect. */
export async function GET() {
  try {
    const state = crypto.randomBytes(32).toString("hex");
    const cookieStore = await cookies();
    cookieStore.set("github_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 600,
    });
    return NextResponse.redirect(buildAuthorizeUrl(state));
  } catch (error) {
    return handleApiError(error);
  }
}
