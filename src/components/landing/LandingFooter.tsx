"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { accentText, text } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";

const linkStyle: CSSProperties = { fontSize: 14, color: text.muted };
const linkHover: CSSProperties = { color: accentText };

export default function LandingFooter() {
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
        <span style={{ fontSize: 14, color: text.faint }}>© 2026 CreaFlow. Tous droits réservés.</span>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 22 }}>
          {/* Le design source pointe vers des ancres factices (#cgu/#confidentialite/#mentions) —
              remplacées ici par les routes légales réelles du repo. */}
          <Link href="/legal/cgu" style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
            CGU
          </Link>
          <Link href="/legal/confidentialite" style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
            Politique de confidentialité
          </Link>
          <Link href="/legal/mentions-legales" style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
            Mentions légales
          </Link>
        </div>
      </div>
    </footer>
  );
}
