import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

// La page de connexion est un composant client : le titre et l'interdiction d'indexation se posent ici.
export const metadata: Metadata = { title: "Connexion", robots: NO_INDEX };

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
