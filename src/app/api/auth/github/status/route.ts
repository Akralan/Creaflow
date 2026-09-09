import { NextResponse } from "next/server";
import { isGithubConfigured } from "@/lib/github/client";

// Cette route ne lit que process.env, sans aucune API de requête : sans ce marqueur elle pourrait
// être prérendue au build et figer la réponse d'un environnement à l'autre.
export const dynamic = "force-dynamic";

/** Permet à /login de ne pas afficher un bouton qui mènerait à une erreur quand les variables
 *  d'environnement GitHub sont absentes — même philosophie que Stripe : l'app tourne sans, la
 *  fonctionnalité est simplement absente. */
export async function GET() {
  return NextResponse.json({ configured: isGithubConfigured() });
}
