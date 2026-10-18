import type { Metadata } from "next";
import { Suspense } from "react";
import { geistMono, geistSans } from "@/components/landing/tellovo/fonts";
import LoginLink from "@/components/start/LoginLink";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Signing you in", robots: NO_INDEX };

export default function LoginLinkPage() {
  return (
    <div className={`tv ${geistSans.variable} ${geistMono.variable}`}>
      <Suspense>
        <LoginLink />
      </Suspense>
    </div>
  );
}
