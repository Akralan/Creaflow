import { after, NextRequest, NextResponse } from "next/server";
import { handleApiError } from "@/lib/api/errors";
import { sendEmail } from "@/lib/email";
import { loginLinkEmail } from "@/lib/email/templates";
import { logger } from "@/lib/logger";
import { LOGIN_LINK_TTL_HOURS, issueLoginLink } from "@/lib/services/loginLinkService";
import { enforceRateLimit, getClientIp, pseudonymizeIdentifier } from "@/lib/services/rateLimitService";
import { resumeStalledJob, runStartJob } from "@/lib/services/startJobService";
import { createStartAccount, startSchema } from "@/lib/services/startService";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Fin de la carte de /start : crée le compte quand l'email arrive et lance la génération en fond
 * (docs/SPEC_ENTREE_PAR_LE_REPO.md §5). Répond pareil pour une adresse nouvelle et pour une adresse
 * déjà connue (on lui envoie alors seulement un lien de connexion), sans ouvrir de session.
 */
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    if (ip) await enforceRateLimit("start-create-ip", ip, 3, 60 * 60);
    const body = startSchema.parse(await request.json());
    await enforceRateLimit("start-create-email", pseudonymizeIdentifier(body.email.toLowerCase()), 3, 24 * 60 * 60);

    const { userId, created } = await createStartAccount(body);

    if (created) {
      after(() => runStartJob(userId));
    } else {
      after(async () => {
        try {
          if (await resumeStalledJob(userId)) return;
          const user = await db.query.users.findFirst({ where: eq(users.id, userId), columns: { email: true } });
          if (!user) return;
          const loginUrl = await issueLoginLink(userId);
          await sendEmail({ to: user.email, ...loginLinkEmail({ loginUrl, expiresInHours: LOGIN_LINK_TTL_HOURS, fresh: false }) });
        } catch (error) {
          logger.error("Sign-in link could not be sent to an existing account", error, { userId });
        }
      });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
