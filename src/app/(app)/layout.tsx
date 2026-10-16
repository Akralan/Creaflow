import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { NO_INDEX } from "@/lib/seo";

// Enveloppe serveur du layout de l'app connectée : son seul rôle est de porter les métadonnées
// (un composant client ne peut pas en exporter). Tout l'écran — barre latérale, vérification de
// session, contextes — vit dans AppShell. Ces pages sont rendues vides sans session : rien à indexer.
export const metadata: Metadata = { robots: NO_INDEX };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
