import { NextRequest } from "next/server";
import { handleOAuthCallback } from "@/lib/oauth/handlers";

/** Enveloppe conservée : `GITHUB_OAUTH_REDIRECT_URI` pointe ici et est déposée sur github.com.
 *  Toute la logique est commune (src/lib/oauth/handlers.ts). */
export async function GET(request: NextRequest) {
  return handleOAuthCallback(request, "github");
}
