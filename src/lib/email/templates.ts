import { SERVICE_NAME } from "@/lib/legal/publisher";

/**
 * The three emails of this workstream (docs/SPEC_LEGAL_EMAIL_RGPD.md §3.2): plain text, minimal
 * HTML (a title, paragraphs, a button), no external template, no tracking. The text is the
 * reference version: it is the one shown in console mode.
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
  return `<!doctype html><html lang="en"><body style="margin:0;padding:32px 16px;background:#f6f4f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#221d19">${escapeHtml(SERVICE_NAME)}</p>
<h1 style="margin:0 0 16px;font-size:22px;color:#221d19">${escapeHtml(title)}</h1>
${body}${cta}
</div></body></html>`;
}

export function passwordResetEmail(params: { resetUrl: string; expiresInMinutes: number }): EmailContent {
  const intro = `Someone (you, presumably) asked to reset the password for your ${SERVICE_NAME} account.`;
  const validity = `This link is valid for ${params.expiresInMinutes} minutes and can only be used once.`;
  const ignore = "If you didn't make this request, ignore this email: your password remains unchanged.";
  return {
    subject: `Reset your ${SERVICE_NAME} password`,
    text: [intro, "", `Choose a new password : ${params.resetUrl}`, "", validity, ignore].join("\n"),
    html: layout("Reset your password", [intro, validity, ignore], {
      label: "Choose a new password",
      url: params.resetUrl,
    }),
  };
}

export function passwordChangedEmail(params: { contactEmail: string | null }): EmailContent {
  const intro = `The password for your ${SERVICE_NAME} account has just been changed. All open sessions have been signed out.`;
  const warning = params.contactEmail
    ? `If this wasn't you, reset your password right away from the sign-in page, then write to us at ${params.contactEmail}.`
    : "If this wasn't you, reset your password right away from the sign-in page.";
  return {
    subject: `Your ${SERVICE_NAME} password has been changed`,
    text: [intro, "", warning].join("\n"),
    html: layout("Password changed", [intro, warning]),
  };
}

export function accountDeletedEmail(): EmailContent {
  const intro = `Your ${SERVICE_NAME} account has been deleted, along with all of your data in the app.`;
  const stripe = "If you had a subscription, it has been canceled. Your invoices remain available through Stripe for the legally required period.";
  const bye = "Thanks for trying the service. You can create a new account at any time with the same address.";
  return {
    subject: `Your ${SERVICE_NAME} account has been deleted`,
    text: [intro, "", stripe, "", bye].join("\n"),
    html: layout("Account deleted", [intro, stripe, bye]),
  };
}
