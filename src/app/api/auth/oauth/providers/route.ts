import { NextResponse } from "next/server";
import { listConfiguredProviders } from "@/lib/oauth/registry";

// Cette route ne lit que process.env, sans aucune API de requête : sans ce marqueur elle pourrait
// être prérendue au build et figer la réponse d'un environnement à l'autre.
export const dynamic = "force-dynamic";

/** Permet à /login de n'afficher que les boutons qui mènent quelque part : un fournisseur dont les
 *  variables d'environnement manquent n'est pas listé. Même philosophie que Stripe — l'app tourne
 *  sans, la fonctionnalité est simplement absente. */
export async function GET() {
  return NextResponse.json({ providers: listConfiguredProviders() });
}
