import type { EmailMessage, EmailSender, EmailSenderIdentity } from "./types";

// API transactionnelle Brevo, vérifiée le 2026-10-16 (developers.brevo.com/reference/sendtransacemail) :
// POST /v3/smtp/email, en-tête `api-key`, corps { sender, to, subject, htmlContent, textContent },
// réponse 201 { messageId }. Appel fetch direct, pas de SDK — même choix que Linear et Notion.
const BREVO_SEND_ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export function createBrevoSender(apiKey: string, sender: EmailSenderIdentity): EmailSender {
  return {
    async send(message: EmailMessage): Promise<void> {
      const response = await fetch(BREVO_SEND_ENDPOINT, {
        method: "POST",
        headers: {
          "api-key": apiKey,
          "content-type": "application/json",
          accept: "application/json",
        },
        body: JSON.stringify({
          sender: { name: sender.name, email: sender.email },
          to: [{ email: message.to }],
          subject: message.subject,
          htmlContent: message.html,
          textContent: message.text,
        }),
      });
      if (!response.ok) {
        // Le corps d'erreur Brevo est { code, message } — on le garde dans le message d'exception,
        // jamais l'adresse du destinataire ni le contenu : l'exception remonte dans les logs.
        const detail = await response.text().catch(() => "");
        throw new Error(`Brevo a refusé l'envoi (HTTP ${response.status})${detail ? ` : ${detail.slice(0, 300)}` : ""}`);
      }
    },
  };
}
