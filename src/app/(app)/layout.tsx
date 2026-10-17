import type { Metadata } from "next";
import AppShell from "@/components/AppShell";
import { NO_INDEX } from "@/lib/seo";

// Server wrapper for the signed-in app layout: its only job is to carry the metadata
// (a client component cannot export it). The whole screen — sidebar, session check,
// contexts — lives in AppShell. These pages render empty without a session: nothing to index.
export const metadata: Metadata = { robots: NO_INDEX };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
