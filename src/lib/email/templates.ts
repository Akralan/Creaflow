import { SERVICE_NAME } from "@/lib/legal/publisher";

/**
 * Les trois emails du chantier (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.2) : texte simple, HTML minimal
 * (un titre, des paragraphes, un bouton), pas de template externe, pas de tracking. Le texte est
 * la version de référence : c'est elle qui apparaît en mode console.
 */
export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function layout(title: string, paragraphs: string[], button?: { label: string; url: string }): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b2622">${escapeHtml(p)}</p>`).join("");
  const cta = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#5b45d8;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="fr"><body style="margin:0;padding:32px 16px;background:#f6f4f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#221d19">${escapeHtml(SERVICE_NAME)}</p>
<h1 style="margin:0 0 16px;font-size:22px;color:#221d19">${escapeHtml(title)}</h1>
${body}${cta}
</div></body></html>`;
}

export function passwordResetEmail(params: { resetUrl: string; expiresInMinutes: number }): EmailContent {
  const intro = `Quelqu'un (vous, normalement) a demandé à réinitialiser le mot de passe de votre compte ${SERVICE_NAME}.`;
  const validity = `Ce lien est valable ${params.expiresInMinutes} minutes et ne sert qu'une fois.`;
  const ignore = "Si vous n'êtes pas à l'origine de cette demande, ignorez cet email : votre mot de passe reste inchangé.";
  return {
    subject: `Réinitialiser votre mot de passe ${SERVICE_NAME}`,
    text: [intro, "", `Choisir un nouveau mot de passe : ${params.resetUrl}`, "", validity, ignore].join("\n"),
    html: layout("Réinitialiser votre mot de passe", [intro, validity, ignore], {
      label: "Choisir un nouveau mot de passe",
      url: params.resetUrl,
    }),
  };
}

export function passwordChangedEmail(params: { contactEmail: string | null }): EmailContent {
  const intro = `Le mot de passe de votre compte ${SERVICE_NAME} vient d'être modifié. Toutes les sessions ouvertes ont été fermées.`;
  const warning = params.contactEmail
    ? `Si ce n'est pas vous, réinitialisez votre mot de passe sans attendre depuis la page de connexion, puis écrivez-nous à ${params.contactEmail}.`
    : "Si ce n'est pas vous, réinitialisez votre mot de passe sans attendre depuis la page de connexion.";
  return {
    subject: `Votre mot de passe ${SERVICE_NAME} a été modifié`,
    text: [intro, "", warning].join("\n"),
    html: layout("Mot de passe modifié", [intro, warning]),
  };
}

export function accountDeletedEmail(): EmailContent {
  const intro = `Votre compte ${SERVICE_NAME} a été supprimé, ainsi que l'ensemble de vos données dans l'application.`;
  const stripe = "Si vous aviez un abonnement, il a été résilié. Vos factures restent accessibles auprès de Stripe pour la durée légale.";
  const bye = "Merci d'avoir essayé le service. Vous pouvez recréer un compte à tout moment avec la même adresse.";
  return {
    subject: `Votre compte ${SERVICE_NAME} a été supprimé`,
    text: [intro, "", stripe, "", bye].join("\n"),
    html: layout("Compte supprimé", [intro, stripe, bye]),
  };
}
