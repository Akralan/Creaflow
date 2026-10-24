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

function layout(title: string, paragraphs: string[], button?: { label: string; url: string }, post?: string): string {
  const body = paragraphs.map((p) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b2622">${escapeHtml(p)}</p>`).join("");
  const draft = post
    ? `<div style="margin:6px 0 18px;padding:16px 18px;border:1px solid #e6e1da;border-radius:12px;background:#faf9f6;font-size:15px;line-height:1.6;color:#2b2622;white-space:pre-wrap">${escapeHtml(post)}</div>`
    : "";
  const cta = button
    ? `<p style="margin:22px 0"><a href="${escapeHtml(button.url)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#5b45d8;color:#ffffff;text-decoration:none;font-weight:600">${escapeHtml(button.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="en"><body style="margin:0;padding:32px 16px;background:#f6f4f1;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px">
<p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#221d19">${escapeHtml(SERVICE_NAME)}</p>
<h1 style="margin:0 0 16px;font-size:22px;color:#221d19">${escapeHtml(title)}</h1>
${body}${draft}${cta}
</div></body></html>`;
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

/**
 * The email that closes the /start flow (docs/SPEC_ENTREE_PAR_LE_REPO.md §6): the first post in full,
 * then a button that signs in and opens the other two. The link signs in without a password.
 */
export function firstPostEmail(params: { productName: string; postText: string; loginUrl: string; expiresInHours: number }): EmailContent {
  const intro = `Here is the first post of your week for ${params.productName}, written from your repository.`;
  const rest = "Your two other posts of the week are waiting in the app. The button below signs you in — no password needed.";
  const validity = `This link is valid for ${params.expiresInHours} hours.`;
  return {
    subject: "Your first week of content is ready",
    text: [intro, "", params.postText, "", rest, `See your other posts: ${params.loginUrl}`, "", validity].join("\n"),
    html: layout("Your first week of content is ready", [intro], undefined, params.postText).replace(
      "</div></body></html>",
      `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#2b2622">${escapeHtml(rest)}</p><p style="margin:22px 0"><a href="${escapeHtml(params.loginUrl)}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#5b45d8;color:#ffffff;text-decoration:none;font-weight:600">See your other posts</a></p><p style="margin:0;font-size:13px;color:#6b645d">${escapeHtml(validity)}</p></div></body></html>`
    ),
  };
}

/** Same door without a post: the generation failed or the account already existed. */
export function loginLinkEmail(params: { loginUrl: string; expiresInHours: number; fresh: boolean }): EmailContent {
  const intro = params.fresh
    ? "Your first week of content is ready to open. The button below signs you in — no password needed."
    : `Here is your link to sign in to ${SERVICE_NAME} — no password needed.`;
  const validity = `This link is valid for ${params.expiresInHours} hours and can only be used once.`;
  return {
    subject: params.fresh ? "Your first week of content is ready" : `Sign in to ${SERVICE_NAME}`,
    text: [intro, "", `Open ${SERVICE_NAME}: ${params.loginUrl}`, "", validity].join("\n"),
    html: layout(params.fresh ? "Your first week is ready" : "Sign in", [intro, validity], { label: `Open ${SERVICE_NAME}`, url: params.loginUrl }),
  };
}
