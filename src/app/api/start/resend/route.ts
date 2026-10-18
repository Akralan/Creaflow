import { after, NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { users } from "@/db/schema";
import { handleApiError } from "@/lib/api/errors";
import { sendEmail } from "@/lib/email";
import { loginLinkEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { LOGIN_LINK_TTL_HOURS, issueLoginLink } from "@/lib/services/loginLinkService";
import { resumeStalledJob } from "@/lib/services/startJobService";
import { enforceRateLimit, getClientIp, pseudonymizeIdentifier } from "@/lib/services/rateLimitService";

const schema = z.object({ email: z.email() });

/** Renvoie un lien de connexion (lien expiré ou déjà utilisé). Répond toujours pareil, que l'adresse soit connue ou non. */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip) await enforceRateLimit("start-resend-ip", ip, 5, 60 * 60);
    const email = schema.parse(await request.json()).email.toLowerCase();
    await enforceRateLimit("start-resend-email", pseudonymizeIdentifier(email), 3, 60 * 60);

    const user = await db.query.users.findFirst({ where: eq(users.email, email), columns: { id: true } });
    if (user) {
      // Hors de la réponse : sa durée ne doit pas révéler si l'adresse a un compte.
      after(async () => {
        try {
          if (await resumeStalledJob(user.id)) return;
          const loginUrl = await issueLoginLink(user.id);
          await sendEmail({ to: email, ...loginLinkEmail({ loginUrl, expiresInHours: LOGIN_LINK_TTL_HOURS, fresh: false }) });
        } catch (error) {
          logger.error("Sign-in link could not be resent", error, { userId: user.id });
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
