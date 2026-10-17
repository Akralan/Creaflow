import { createBrevoSender } from "./brevo";
import { consoleSender } from "./console";
import type { EmailMessage, EmailSender, EmailSenderIdentity } from "./types";

export type { EmailMessage, EmailSender } from "./types";

const DEFAULT_FROM: EmailSenderIdentity = { name: "Tellovo", email: "no-reply@localhost" };

/**
 * `EMAIL_FROM` accepts "Name <address>" or a bare address. Returns null if the value is missing
 * or contains no usable address — the caller then falls back to the default.
 */
export function parseSenderIdentity(raw: string | undefined): EmailSenderIdentity | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  const withName = trimmed.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (withName) {
    const name = withName[1].trim().replace(/^"|"$/g, "");
    return { name: name || DEFAULT_FROM.name, email: withName[2] };
  }
  if (/^[^<>\s]+@[^<>\s]+$/.test(trimmed)) {
    return { name: DEFAULT_FROM.name, email: trimmed };
  }
  return null;
}

/**
 * Same philosophy as Stripe, GitHub or object storage: without `BREVO_API_KEY`, the app starts
 * in console mode (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.1). `EMAIL_PROVIDER=brevo` without a key is
 * a plain configuration error rather than silence: we don't want to believe an email is going
 * out when it ends up in the logs. Same logic in production: a forgotten key must not silently
 * switch reset links to the logs — console mode must be requested explicitly
 * (`EMAIL_PROVIDER=console`), and the body is then not logged.
 */
export function getEmailSender(env: Record<string, string | undefined> = process.env): EmailSender {
  const explicit = env.EMAIL_PROVIDER;
  if (!explicit && !env.BREVO_API_KEY && env.NODE_ENV === "production") {
    throw new Error("No email provider configured in production: set BREVO_API_KEY (or EMAIL_PROVIDER=console knowingly).");
  }
  const provider = explicit || (env.BREVO_API_KEY ? "brevo" : "console");
  if (provider === "console") return consoleSender;
  if (provider === "brevo") {
    if (!env.BREVO_API_KEY) {
      throw new Error("EMAIL_PROVIDER=brevo but BREVO_API_KEY is not set in the environment.");
    }
    return createBrevoSender(env.BREVO_API_KEY, parseSenderIdentity(env.EMAIL_FROM) ?? DEFAULT_FROM);
  }
  throw new Error(`Unknown EMAIL_PROVIDER: "${provider}" (expected "brevo" or "console").`);
}

/** Single entry point for application email sends. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  await getEmailSender().send(message);
}
