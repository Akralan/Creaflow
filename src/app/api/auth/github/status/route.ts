import { NextResponse } from "next/server";
import { githubIdentityProvider } from "@/lib/oauth/github";

export const dynamic = "force-dynamic";

/** Conservée le temps que les appelants basculent sur /api/auth/oauth/providers, qui rend la même
 *  information pour tous les fournisseurs à la fois. */
export async function GET() {
  return NextResponse.json({ configured: githubIdentityProvider.isConfigured() });
}
