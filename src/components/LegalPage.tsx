import Link from "next/link";
import type { ReactNode } from "react";
import { color, fontBody, fontHeading } from "@/lib/design/tokens";
import Wordmark from "@/components/Wordmark";
import { heading1Style } from "@/components/ui/TextField";
import { isPublisherComplete } from "@/lib/legal/publisher";

const LEGAL_LINKS = [
  { href: "/legal/cgu", label: "Terms of Use and Sale" },
  { href: "/legal/confidentialite", label: "Privacy Policy" },
  { href: "/legal/mentions-legales", label: "Legal Notice" },
];

/** Last-updated date shared by the three documents — they were rewritten together. */
export const LEGAL_UPDATED_AT = "October 16, 2026";

/**
 * Shared layout for the 3 legal pages — readable typography, no marketing layout.
 *
 * The "being finalized" banner is not text to remove by hand: it is displayed as long as
 * src/lib/legal/publisher.ts contains a placeholder, and disappears by itself afterwards
 * (docs/SPEC_LEGAL_EMAIL_RGPD.md §2.1). The three documents remain internal drafts, to be
 * reviewed by a legal professional before commercial launch — in particular the liability,
 * withdrawal and governing-law clauses.
 */
export default function LegalPage({
  title,
  updatedAt = LEGAL_UPDATED_AT,
  children,
}: {
  title: string;
  updatedAt?: string;
  children: ReactNode;
}) {
  const complete = isPublisherComplete();
  return (
    <div style={{ background: color.pageBg, minHeight: "100vh", fontFamily: fontBody, color: color.text2 }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "56px 24px 80px" }}>
        <Link href="/" style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: fontHeading, fontWeight: 700, fontSize: 18, color: color.text, textDecoration: "none" }}>
          <Wordmark size={24} />
        </Link>

        <h1 style={{ ...heading1Style, marginTop: 28, marginBottom: 6 }}>{title}</h1>
        <p style={{ margin: "0 0 36px", fontSize: 13, color: color.textFaint }}>Last updated: {updatedAt}</p>

        {!complete && (
          <p
            style={{
              margin: "0 0 28px",
              padding: "12px 16px",
              borderRadius: 10,
              background: "oklch(0.97 0.04 85)",
              border: "1px solid oklch(0.85 0.1 85)",
              fontSize: 14,
              color: color.text2,
            }}
          >
            <strong>Document being finalized.</strong> The information in square brackets will be
            completed before the service launches commercially.
          </p>
        )}

        <div style={{ fontSize: 15, lineHeight: 1.7, color: color.text3 }}>{children}</div>

        <nav style={{ display: "flex", gap: 20, flexWrap: "wrap", marginTop: 56, paddingTop: 24, borderTop: `1px solid ${color.divider}` }}>
          {LEGAL_LINKS.map((l) => (
            <Link key={l.href} href={l.href} style={{ fontSize: 13, color: color.textMuted }}>
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

export const sectionTitleStyle: React.CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 700,
  fontSize: 19,
  margin: "36px 0 12px",
  color: color.text,
};
