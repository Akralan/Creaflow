import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handleApiError } from "@/lib/api/errors";
import { sendEmail } from "@/lib/email";
import { loginLinkEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { LOGIN_LINK_TTL_HOURS, issueLoginLink } from "@/lib/services/loginLinkService";
import { enforceRateLimit, getClientIp, pseudonymizeIdentifier } from "@/lib/services/rateLimitService";

const schema = z.object({ email: z.email() });

/**
 * Se connecter, c'est demander un lien (docs/SPEC_CONNEXION_PAR_LIEN.md) : il n'y a plus de mot de
 * passe. Même réponse que l'adresse ait un compte ou non, et l'envoi part après la réponse pour que
 * sa durée ne le révèle pas non plus. Le lien est celui de /start : 24 h, un seul usage, un nouveau
 * lien invalide les précédents.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip) await enforceRateLimit("login-link-request-ip", ip, 10, 60 * 60);
    const email = schema.parse(await request.json()).email.toLowerCase();
    await enforceRateLimit("login-link-request-email", pseudonymizeIdentifier(email), 5, 60 * 60);

    const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (user) {
      after(async () => {
        try {
          const loginUrl = await issueLoginLink(user.id);
          await sendEmail({ to: email, ...loginLinkEmail({ loginUrl, expiresInHours: LOGIN_LINK_TTL_HOURS, fresh: false }) });
        } catch (error) {
          logger.error("Sign-in link could not be sent", error, { userId: user.id });
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
