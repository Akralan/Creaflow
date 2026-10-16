import { createBrevoSender } from "./brevo";
import { consoleSender } from "./console";
import type { EmailMessage, EmailSender, EmailSenderIdentity } from "./types";

export type { EmailMessage, EmailSender } from "./types";

const DEFAULT_FROM: EmailSenderIdentity = { name: "CreaFlow", email: "no-reply@localhost" };

/**
 * `EMAIL_FROM` accepte « Nom <adresse> » ou une adresse nue. Renvoie null si la valeur est absente
 * ou ne contient pas d'adresse exploitable — l'appelant retombe alors sur le défaut.
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
 * Même philosophie que Stripe, GitHub ou le stockage objet : sans `BREVO_API_KEY`, l'app démarre
 * en mode console (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.1). `EMAIL_PROVIDER=brevo` sans clé est une
 * erreur de configuration franche plutôt qu'un silence : on ne veut pas croire qu'un email part
 * alors qu'il finit dans les logs. Même logique en production : une clé oubliée ne doit pas faire
 * basculer silencieusement les liens de réinitialisation vers les logs — il faut demander le mode
 * console explicitement (`EMAIL_PROVIDER=console`), et le corps n'y est alors pas logué.
 */
export function getEmailSender(env: Record<string, string | undefined> = process.env): EmailSender {
  const explicit = env.EMAIL_PROVIDER;
  if (!explicit && !env.BREVO_API_KEY && env.NODE_ENV === "production") {
    throw new Error("Aucun prestataire d'email configuré en production : définis BREVO_API_KEY (ou EMAIL_PROVIDER=console en connaissance de cause).");
  }
  const provider = explicit || (env.BREVO_API_KEY ? "brevo" : "console");
  if (provider === "console") return consoleSender;
  if (provider === "brevo") {
    if (!env.BREVO_API_KEY) {
      throw new Error("EMAIL_PROVIDER=brevo mais BREVO_API_KEY n'est pas défini dans l'environnement.");
    }
    return createBrevoSender(env.BREVO_API_KEY, parseSenderIdentity(env.EMAIL_FROM) ?? DEFAULT_FROM);
  }
  throw new Error(`EMAIL_PROVIDER inconnu : "${provider}" (attendu "brevo" ou "console").`);
}

/** Point d'entrée unique des envois applicatifs. */
export async function sendEmail(message: EmailMessage): Promise<void> {
  await getEmailSender().send(message);
}
