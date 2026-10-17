import type { Metadata } from "next";
import { NO_INDEX } from "@/lib/seo";

// Page reached only through a link received by email: never in a search engine.
export const metadata: Metadata = { title: "Reset password", robots: NO_INDEX };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
