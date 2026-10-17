import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

// Onboarding is a client component: the title and the no-index rule are set here.
export const metadata: Metadata = { title: "Onboarding", robots: NO_INDEX };

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
