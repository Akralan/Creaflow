import type { Metadata } from "next";
import { notFound } from "next/navigation";
import AdminQuotasPanel from "@/components/AdminQuotasPanel";
import { getCurrentAdmin } from "@/lib/auth/admin";
import { NO_INDEX } from "@/lib/seo";

export const metadata: Metadata = { title: "Quotas — admin", robots: NO_INDEX };

/**
 * Quotas personnalisés (docs/SPEC_QUOTAS_ADMIN.md). Réservé aux emails de ADMIN_EMAILS : tout autre
 * visiteur, connecté ou non, reçoit la page introuvable — l'écran n'existe pas pour lui. Hors de la
 * coquille de l'app (pas de menu), on y vient en tapant l'adresse.
 */
export default async function AdminQuotasPage() {
  const admin = await getCurrentAdmin();
  if (!admin) notFound();
  return <AdminQuotasPanel adminEmail={admin.email} />;
}
