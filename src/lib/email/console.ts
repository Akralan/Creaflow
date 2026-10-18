import { logger } from "@/lib/logger";
import type { EmailMessage, EmailSender } from "./types";

/**
 * Dev mode: the email is not sent, it is written to the logs in full (text version). This is how
 * you get a reset link locally without a Brevo account.
 *
 * In production, the body is never logged: a reset link in the logs (and in Sentry) would hand
 * any account to whoever reads them. getEmailSender refuses anyway to fall back to this mode in
 * production without an explicit `EMAIL_PROVIDER=console`.
 *
 * TEMPORARY EXCEPTION — remove before plugging Brevo (see URGENT.md): `EMAIL_LOG_LINKS=1` logs the
 * sign-in links (and only them) of the /start flow in production, so the flow can be tried on the
 * VPS before any sending service exists.
 */
const LOGIN_LINK = /https?:\/\/\S+\/connexion\/lien\?token=\S+/g;

export const consoleSender: EmailSender = {
  async send(message: EmailMessage): Promise<void> {
    const production = process.env.NODE_ENV === "production";
    const links = production && process.env.EMAIL_LOG_LINKS === "1" ? (message.text.match(LOGIN_LINK) ?? []) : [];
    logger.info("Email (console mode, not sent)", {
      to: message.to,
      subject: message.subject,
      ...(production ? {} : { text: message.text }),
      ...(links.length > 0 ? { loginLinks: links } : {}),
    });
  },
};
