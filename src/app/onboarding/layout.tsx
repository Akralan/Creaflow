import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

// L'onboarding est un composant client : le titre et l'interdiction d'indexation se posent ici.
export const metadata: Metadata = { title: "Onboarding", robots: NO_INDEX };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
