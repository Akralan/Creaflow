import type { EmailMessage, EmailSender, EmailSenderIdentity } from "./types";

// Brevo transactional API, verified on 2026-10-16 (developers.brevo.com/reference/sendtransacemail) :
// POST /v3/smtp/email, `api-key` header, body { sender, to, subject, htmlContent, textContent },
// response 201 { messageId }. Direct fetch call, no SDK — same choice as Linear and Notion.
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
        // The Brevo error body is { code, message } — we keep it in the exception message, but
        // never the recipient address or the content: the exception ends up in the logs.
        const detail = await response.text().catch(() => "");
        throw new Error(`Brevo rejected the send (HTTP ${response.status})${detail ? ` : ${detail.slice(0, 300)}` : ""}`);
      }
    },
  };
}
