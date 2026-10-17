import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ApiError } from "@/lib/api/errors";
import { getMicroEditQuotaStatus, getQuotaStatus, getSubscriptionForUser } from "@/lib/services/billingService";

/** /admin/quotas screen (docs/SPEC_QUOTAS_ADMIN.md): one account, its counters and its own quotas. */

export const accountQuotasSchema = z.object({
  userId: z.uuid(),
  /** null = normal limit of the trial or plan. */
  scriptLimit: z.number().int().min(0).max(100_000).nullable(),
  microEditLimit: z.number().int().min(0).max(100_000).nullable(),
});

export async function findAccountQuotas(email: string) {
  const user = await db.query.users.findFirst({
    where: eq(sql`lower(${users.email})`, email.trim().toLowerCase()),
    columns: { id: true, email: true, scriptLimit: true, microEditLimit: true },
  });
  if (!user) throw new ApiError(404, "No account with this email.");
  const [scripts, microEdits, subscription] = await Promise.all([
    getQuotaStatus(user.id),
    getMicroEditQuotaStatus(user.id),
    getSubscriptionForUser(user.id),
  ]);
  return {
    userId: user.id,
    email: user.email,
    subscription: subscription ? { plan: subscription.plan, status: subscription.status } : null,
    scripts: { used: scripts.used, limit: scripts.limit, planName: scripts.planName, custom: user.scriptLimit },
    microEdits: { used: microEdits.used, limit: microEdits.limit, planName: microEdits.planName, custom: user.microEditLimit },
  };
}

export async function setAccountQuotas(input: z.infer<typeof accountQuotasSchema>) {
  const [updated] = await db
    .update(users)
    .set({ scriptLimit: input.scriptLimit, microEditLimit: input.microEditLimit })
    .where(eq(users.id, input.userId))
    .returning({ email: users.email });
  if (!updated) throw new ApiError(404, "Account not found.");
  return findAccountQuotas(updated.email);
}
