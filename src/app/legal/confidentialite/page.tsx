import Link from "next/link";
import LegalPage, { sectionTitleStyle } from "@/components/LegalPage";
import { color } from "@/lib/design/tokens";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "What data Buildloud processes, why, with which processors, and your rights.",
  alternates: { canonical: "/legal/confidentialite" },
};
import { PUBLISHER, SERVICE_NAME } from "@/lib/legal/publisher";

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14, margin: "12px 0 20px" };
const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "8px 10px",
  borderBottom: `1px solid ${color.border}`,
  color: color.textMuted,
  fontWeight: 600,
};
const tdStyle: React.CSSProperties = { padding: "8px 10px", borderBottom: `1px solid ${color.divider}`, verticalAlign: "top" };

// Reflects the product's actual architecture (docs/TECH.md, docs/SPEC_LEGAL_EMAIL_RGPD.md §2.3): a
// new processor (analytics, new LLM provider, Sentry Session Replay...) must go through here
// before being enabled. Internal draft to be reviewed by a legal professional (GDPR) before
// commercial launch.
export default function ConfidentialitePage() {
  return (
    <LegalPage title="Privacy Policy">
      <p>
        This policy describes the personal data processed by {SERVICE_NAME}, published by{" "}
        {PUBLISHER.name} (see the <Link href="/legal/mentions-legales">legal notice</Link>), the data
        controller within the meaning of the General Data Protection Regulation (GDPR).
      </p>

      <h2 style={sectionTitleStyle}>1. Data collected</h2>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Data</th>
            <th style={thStyle}>When</th>
            <th style={thStyle}>Purpose</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>Email, password (hashed, never stored in plain text)</td>
            <td style={tdStyle}>Account creation</td>
            <td style={tdStyle}>Authentication, service emails</td>
          </tr>
          <tr>
            <td style={tdStyle}>Identity provided by GitHub, Notion or Linear (identifier, name, avatar, email)</td>
            <td style={tdStyle}>Sign-up or sign-in through one of these providers</td>
            <td style={tdStyle}>Authentication, profile pre-filling</td>
          </tr>
          <tr>
            <td style={tdStyle}>Brand profile (name, activity, tone, values, audience, equipment)</td>
            <td style={tdStyle}>Onboarding, manual entry</td>
            <td style={tdStyle}>Personalizing generated content</td>
          </tr>
          <tr>
            <td style={tdStyle}>
              Written material (imported documents, interview answers, contents of your repositories,
              connected pages and projects), topics, series, generated and corrected scripts, calendar,
              messages exchanged with the assistant
            </td>
            <td style={tdStyle}>Use of the service</td>
            <td style={tdStyle}>Operating the service, learning your writing style (specific to your account)</td>
          </tr>
          <tr>
            <td style={tdStyle}>OAuth access tokens (social networks, Google Drive, GitHub, Notion, Linear)</td>
            <td style={tdStyle}>Voluntary connection of a third-party account</td>
            <td style={tdStyle}>Reading your posts, metrics, documents and repositories — revocable at any time</td>
          </tr>
          <tr>
            <td style={tdStyle}>Imported photos, their background-removed version, associated AI description, visual post mockups</td>
            <td style={tdStyle}>Use of the visual resources library</td>
            <td style={tdStyle}>Composing your visual posts</td>
          </tr>
          <tr>
            <td style={tdStyle}>Billing data (plan, subscription status, Stripe customer ID) — never full banking details</td>
            <td style={tdStyle}>Subscribing to a paid plan</td>
            <td style={tdStyle}>Billing, subscription management</td>
          </tr>
          <tr>
            <td style={tdStyle}>IP address, browser, account identifier</td>
            <td style={tdStyle}>Every request; in case of a technical error</td>
            <td style={tdStyle}>Security (rate limiting), error diagnosis</td>
          </tr>
        </tbody>
      </table>

      <h2 style={sectionTitleStyle}>2. Legal basis for processing</h2>
      <p>
        Processing of the data needed to operate the account and the service (authentication, content
        generation, billing, service emails) is based on the performance of the contract between you
        and the publisher (art. 6.1.b GDPR). Connecting third-party accounts is based on your consent,
        given at the time of connection and revocable at any time. Security measures and error
        diagnosis are based on the publisher&apos;s legitimate interest in ensuring the availability
        and security of the service. Keeping invoices is based on a legal obligation.
      </p>

      <h2 style={sectionTitleStyle}>3. Recipients of the data — processors</h2>
      <p>
        Some data is transmitted to technical providers, strictly to the extent necessary for the
        service to work:
      </p>
      <table style={tableStyle}>
        <thead>
          <tr>
            <th style={thStyle}>Provider</th>
            <th style={thStyle}>Role</th>
            <th style={thStyle}>Location</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={tdStyle}>OpenAI</td>
            <td style={tdStyle}>
              AI text generation, editorial assistant, indexing of your images (your material, your
              profile and your instructions are sent to them to produce a response)
            </td>
            <td style={tdStyle}>United States</td>
          </tr>
          <tr>
            <td style={tdStyle}>Google (Gemini API)</td>
            <td style={tdStyle}>Automatic description of your photos (your images are sent to it to be described)</td>
            <td style={tdStyle}>United States</td>
          </tr>
          <tr>
            <td style={tdStyle}>Photoroom</td>
            <td style={tdStyle}>
              Photo background removal — only when you request it for a given photo; the photo is sent
              to them, the result is kept by us
            </td>
            <td style={tdStyle}>France</td>
          </tr>
          <tr>
            <td style={tdStyle}>Cloudflare (R2 storage)</td>
            <td style={tdStyle}>Image storage (imported originals, thumbnails, background-removed versions)</td>
            <td style={tdStyle}>Cloudflare global network</td>
          </tr>
          <tr>
            <td style={tdStyle}>Stripe</td>
            <td style={tdStyle}>Payment and billing processing</td>
            <td style={tdStyle}>United States / Ireland</td>
          </tr>
          <tr>
            <td style={tdStyle}>Brevo</td>
            <td style={tdStyle}>Sending service emails (password reset, security notices)</td>
            <td style={tdStyle}>European Union (France)</td>
          </tr>
          <tr>
            <td style={tdStyle}>Sentry</td>
            <td style={tdStyle}>
              Reporting technical errors (IP address, browser, account identifier, error trace — never
              the content of your scripts or your passwords)
            </td>
            <td style={tdStyle}>United States</td>
          </tr>
          <tr>
            <td style={tdStyle}>GitHub, Notion, Linear</td>
            <td style={tdStyle}>Identity and reading of your repositories, pages and projects — only if you connect the relevant account</td>
            <td style={tdStyle}>United States</td>
          </tr>
          <tr>
            <td style={tdStyle}>Meta (Instagram), LinkedIn, Google (Drive), X</td>
            <td style={tdStyle}>Reading your posts, metrics and images — only if you connect the relevant account</td>
            <td style={tdStyle}>Varies by platform</td>
          </tr>
          <tr>
            <td style={tdStyle}>{PUBLISHER.appHost.name}</td>
            <td style={tdStyle}>Application hosting</td>
            <td style={tdStyle}>{PUBLISHER.appHost.address}</td>
          </tr>
          <tr>
            <td style={tdStyle}>{PUBLISHER.dbHost.name}</td>
            <td style={tdStyle}>Database hosting</td>
            <td style={tdStyle}>{PUBLISHER.dbHost.address}</td>
          </tr>
        </tbody>
      </table>
      <p>
        These providers use your data only to perform the service requested by the publisher, and not
        for their own purposes. AI providers are used through their business offerings, whose terms
        exclude the use of your data to train their models. No data is sold to third parties.
      </p>

      <h2 style={sectionTitleStyle}>4. Transfers outside the European Union</h2>
      <p>
        Several of the providers listed above are located in the United States. These transfers rely
        on the safeguards recognized by the GDPR that apply to each provider: the European
        Commission&apos;s standard contractual clauses, or certification under the EU-US Data Privacy
        Framework.
      </p>

      <h2 style={sectionTitleStyle}>5. Retention period</h2>
      <p>
        Your data is kept as long as your account is active. When you delete your account:
      </p>
      <ul>
        <li>
          your data in the application (profile, material, scripts, calendar, access tokens, stored
          images) is erased <strong>immediately</strong>;
        </li>
        <li>
          your invoices and customer identifier are kept by Stripe for the legal period required by
          accounting obligations (ten years);
        </li>
        <li>
          technical error traces already reported to Sentry are purged at the end of their retention
          period (90 days at most);
        </li>
        <li>
          database backups held by the host are overwritten on a rotating basis within a maximum of
          thirty days.
        </li>
      </ul>
      <p>
        Password reset tokens expire after one hour. Rate-limiting counters are based on the IP
        address and on a fingerprint of the email (never the plain address); they are automatically
        purged within hours of their creation.
      </p>

      <h2 style={sectionTitleStyle}>6. Cookies</h2>
      <p>
        {SERVICE_NAME} uses a single cookie strictly necessary for the service to work: a session
        cookie (httpOnly, secure) that keeps you signed in for seven days. This cookie is not used
        for any advertising tracking or audience measurement, and is therefore not subject to prior
        consent. If an audience-measurement or advertising tool were to be added, this policy would be
        updated and a consent banner added before any activation.
      </p>

      <h2 style={sectionTitleStyle}>7. Emails</h2>
      <p>
        {SERVICE_NAME} only sends you service emails: password reset link, notice of a change to your
        password, account deletion confirmation, information about a change to the terms or prices.
        No newsletter, no prospecting, no open tracking.
      </p>

      <h2 style={sectionTitleStyle}>8. Your rights</h2>
      <p>
        Under the GDPR, you have the right of access, rectification, erasure, restriction,
        portability and objection regarding your personal data. Two of these rights can be exercised
        directly from your account settings (&quot;Account&quot; tab):
      </p>
      <ul>
        <li>
          <strong>Portability and access</strong>: &quot;Download my data&quot; produces a JSON file
          containing all of your data (profile, material, scripts, calendar, connections without their
          tokens, subscription); images are referenced in it by their address.
        </li>
        <li>
          <strong>Erasure</strong>: &quot;Delete my account&quot; immediately erases your data, as
          described in section 5.
        </li>
      </ul>
      <p>
        For other rights, or any question, write to {PUBLISHER.contactEmail}; we reply within one
        month. You may also lodge a complaint with the Commission Nationale de l&apos;Informatique et
        des Libertés (CNIL, www.cnil.fr).
      </p>

      <h2 style={sectionTitleStyle}>9. Security</h2>
      <p>
        Passwords are hashed (never stored in plain text), exchanges with the service are encrypted
        (HTTPS), and access to data is limited to your account. Rate-limiting measures protect the
        service against fraudulent access attempts. Changing your password signs out all open sessions
        and you are notified by email.
      </p>

      <h2 style={sectionTitleStyle}>10. Minors</h2>
      <p>{SERVICE_NAME} is not intended for people under 18.</p>

      <h2 style={sectionTitleStyle}>Contact</h2>
      <p>
        For any question about this policy or your personal data: {PUBLISHER.contactEmail}.
      </p>
    </LegalPage>
  );
}
