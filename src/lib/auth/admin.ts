import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";

/**
 * Accès aux écrans d'admin (docs/SPEC_QUOTAS_ADMIN.md) : les emails listés dans `ADMIN_EMAILS`,
 * séparés par des virgules, sans tenir compte de la casse. Un admin reste un compte ordinaire —
 * l'email lui ouvre EN PLUS ces écrans, il ne change rien à son usage de l'application.
 */
export function parseAdminEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean)
  );
}

export function isAdminEmail(email: string, adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS)): boolean {
  return adminEmails.has(email.trim().toLowerCase());
}

/** L'admin connecté, ou null (pas de session, ou compte qui n'est pas admin). */
export async function getCurrentAdmin(): Promise<{ id: string; email: string } | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, email: true } });
  return user && isAdminEmail(user.email) ? user : null;
}

/** Pour les routes d'admin : 404 pour tout autre compte, pour que l'écran reste invisible. */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new ApiError(404, "Page introuvable.");
  return admin;
}
