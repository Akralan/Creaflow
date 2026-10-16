import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import { resolveSignedInDestination } from "@/lib/auth/entry";

// Composant serveur (docs/SPEC_SEO.md §1) : la landing arrive complète dans le HTML, titres et
// texte compris — c'est ce que lisent les moteurs et les aperçus de liens (WhatsApp, LinkedIn,
// Slack), qui n'exécutent pas de JavaScript. Un utilisateur déjà connecté est redirigé côté
// serveur, sans l'écran blanc que produisait l'ancienne vérification au montage.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function RootPage() {
  const destination = await resolveSignedInDestination();
  if (destination) redirect(destination);
  return <LandingPage />;
}
