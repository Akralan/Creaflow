import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getCurrentUserId } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/errors";

/**
 * Access to the admin screens (docs/SPEC_QUOTAS_ADMIN.md): the emails listed in `ADMIN_EMAILS`,
 * comma-separated, case-insensitive. An admin remains an ordinary account —
 * the email opens these screens IN ADDITION, it changes nothing about how they use the app.
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

/** The signed-in admin, or null (no session, or an account that isn't admin). */
export async function getCurrentAdmin(): Promise<{ id: string; email: string } | null> {
  const userId = await getCurrentUserId();
  if (!userId) return null;
  const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { id: true, email: true } });
  return user && isAdminEmail(user.email) ? user : null;
}

/** For admin routes: 404 for any other account, so the screen stays invisible. */
export async function requireAdmin(): Promise<{ id: string; email: string }> {
  const admin = await getCurrentAdmin();
  if (!admin) throw new ApiError(404, "Page not found.");
  return admin;
}
