import { logger } from "@/lib/logger";
import type { EmailMessage, EmailSender } from "./types";

/**
 * Dev mode: the email is not sent, it is written to the logs in full (text version). This is how
 * you get a reset link locally without a Brevo account.
 *
 * In production, the body is never logged: a reset link in the logs (and in Sentry) would hand
 * any account to whoever reads them. getEmailSender refuses anyway to fall back to this mode in
 * production without an explicit `EMAIL_PROVIDER=console`.
 */
export const consoleSender: EmailSender = {
  async send(message: EmailMessage): Promise<void> {
    const production = process.env.NODE_ENV === "production";
    logger.info("Email (console mode, not sent)", {
      to: message.to,
      subject: message.subject,
      ...(production ? {} : { text: message.text }),
    });
  },
};
