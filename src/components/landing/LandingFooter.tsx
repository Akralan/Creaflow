"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { accentText, text } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import Wordmark from "@/components/Wordmark";
import { getContactEmail } from "@/lib/legal/publisher";

const linkStyle: CSSProperties = { fontSize: 14, color: text.muted };
const linkHover: CSSProperties = { color: accentText };

export default function LandingFooter() {
  // Null while the publisher identity is a placeholder: no broken mailto on the landing.
  const contactEmail = getContactEmail();
  return (
    <footer style={{ borderTop: "1px solid rgba(34,29,25,0.08)" }}>
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "30px clamp(18px, 5vw, 44px) 44px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontSize: 14, color: text.faint }}>
          <Wordmark size={19} />
          © 2026 Tellovo. All rights reserved.
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
          {/* The source design points to dummy anchors (#cgu/#confidentialite/#mentions) —
              replaced here by the repo's real legal routes. */}
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
              Contact
            </a>
          )}
          <Link href="/legal/cgu" style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
            Terms of Service
          </Link>
          <Link href="/legal/confidentialite" style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
            Privacy Policy
          </Link>
          <Link href="/legal/mentions-legales" style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
            Legal Notice
          </Link>
        </div>
      </div>
    </footer>
  );
}
