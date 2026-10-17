import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminQuotasPanel from "@/components/AdminQuotasPanel";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Quotas — admin", robots: NO_INDEX };

/**
 * Custom quotas (docs/SPEC_QUOTAS_ADMIN.md). Reserved for the emails in ADMIN_EMAILS: any other
 * visitor, signed in or not, gets the not-found page — the screen does not exist for them. Outside
 * the app shell (no menu), you get there by typing the address.
 */
export default async function AdminQuotasPage() {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  return <AdminQuotasPanel adminEmail={admin.email} />;
}
