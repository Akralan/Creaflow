import { NextResponse } from "next/server";
import { requireUserId } from "@/lib/auth/session";
import { handleApiError } from "@/lib/api/errors";
import { getPlan, PLANS, type PlanId } from "@/lib/billing/plans";
import { getQuotaStatus, getSubscriptionForUser } from "@/lib/services/billingService";

export async function GET() {
  try {
    const userId = await requireUserId();
    const [subscription, quota] = await Promise.all([getSubscriptionForUser(userId), getQuotaStatus(userId)]);

    return NextResponse.json({
      subscription: subscription
        ? {
            plan: subscription.plan,
            planName: getPlan(subscription.plan as PlanId).name,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            cancelAtPeriodEnd: subscription.cancelAtPeriodEnd,
          }
        : null,
      quota,
      plans: Object.values(PLANS).map((p) => ({ id: p.id, name: p.name, scriptsPerMonth: p.scriptsPerMonth })),
    });
  } catch (error) {
    return handleApiError(error);
  }
}
