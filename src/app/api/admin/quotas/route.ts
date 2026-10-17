import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/admin";
import { accountQuotasSchema, findAccountQuotas, setAccountQuotas } from "@/lib/services/adminQuotaService";
import { ApiError, handleApiError } from "@/lib/api/errors";

/** Quotas d'un compte, réservé aux emails de ADMIN_EMAILS (docs/SPEC_QUOTAS_ADMIN.md) — 404 sinon. */

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const email = request.nextUrl.searchParams.get("email")?.trim();
    if (!email) throw new ApiError(400, "Indique un email.");
    return NextResponse.json({ account: await findAccountQuotas(email) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin();
    const input = accountQuotasSchema.parse(await request.json());
    return NextResponse.json({ account: await setAccountQuotas(input) });
  } catch (error) {
    return handleApiError(error);
  }
}
