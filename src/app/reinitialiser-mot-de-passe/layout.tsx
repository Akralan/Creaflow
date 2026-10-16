import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

// Page atteinte uniquement par un lien reçu par email : jamais dans un moteur de recherche.
export const metadata: Metadata = { title: "Réinitialiser le mot de passe", robots: NO_INDEX };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
