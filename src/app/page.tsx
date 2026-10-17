import type { Metadata } from "next";
import { redirect } from "next/navigation";
import LandingPage from "@/components/landing/LandingPage";
import { resolveSignedInDestination } from "@/lib/auth/entry";

// Server component (docs/SPEC_SEO.md §1): the landing arrives complete in the HTML, titles and
// text included — that's what search engines and link previews (WhatsApp, LinkedIn,
// Slack) read, since they don't run JavaScript. A signed-in user is redirected on the
// server, without the blank screen the old check on mount used to produce.
export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function RootPage() {
  const destination = await resolveSignedInDestination();
  if (destination) redirect(destination);
  return <LandingPage />;
}
