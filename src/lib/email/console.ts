import { logger } from "@/lib/logger";
import type { EmailMessage, EmailSender } from "./types";

/**
 * Mode dev : l'email n'est pas envoyé, il est écrit dans les logs en entier (version texte). C'est
 * comme ça qu'on récupère un lien de réinitialisation en local sans compte Brevo.
 *
 * En production, le corps n'est jamais logué : un lien de réinitialisation dans les logs (et dans
 * Sentry) donnerait n'importe quel compte à qui les lit. getEmailSender refuse de toute façon de
 * retomber sur ce mode en production sans `EMAIL_PROVIDER=console` explicite.
 */
export const consoleSender: EmailSender = {
  async send(message: EmailMessage): Promise<void> {
    const production = process.env.NODE_ENV === "production";
    logger.info("Email (mode console, non envoyé)", {
      to: message.to,
      subject: message.subject,
      ...(production ? {} : { text: message.text }),
    });
  },
};
