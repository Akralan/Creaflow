import type { Metadata } from "next";
import { Suspense } from "react";
import { geistMono, geistSans } from "@/components/landing/tellovo/fonts";
import StartFlow from "@/components/start/StartFlow";
import { NO_INDEX } from "@/lib/seo";

// The landing's onboarding, wired to the real services (docs/SPEC_ENTREE_PAR_LE_REPO.md §2).
export const metadata: Metadata = { title: "Your first week of content", robots: NO_INDEX };

export default function StartPage() {
  return (
    <div className={`tv ${geistSans.variable} ${geistMono.variable}`}>
      <Suspense>
        <StartFlow />
      </Suspense>
    </div>
  );
}
