"use client";

import type { CSSProperties } from "react";
import { fontMono } from "@/lib/design/tokens";
import { accent, bg, text, ink } from "@/components/landing/theme";
import SourceIcon from "@/components/landing/SourceIcon";
import type { SourceKind } from "@/components/landing/personas";

/**
 * Bandeau sous le hero : d'où vient la matière (GitHub, Notion, Linear, fichiers) et où
 * partent les posts. Remplace l'ancien défilé de métiers — la cible prioritaire se reconnaît
 * à ses outils, pas à son secteur (docs/PRODUCT.md §2.1).
 */
const pill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 14px 8px 11px",
  borderRadius: 999,
  background: bg.card,
  border: `1px solid ${ink(0.09)}`,
  fontSize: 14,
  fontWeight: 600,
  color: text.body,
  whiteSpace: "nowrap",
};

const label: CSSProperties = {
  fontFamily: fontMono,
  fontSize: 11.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: text.faint,
  whiteSpace: "nowrap",
};

const sources: Array<{ kind: SourceKind; name: string }> = [
  { kind: "github", name: "GitHub" },
  { kind: "notion", name: "Notion" },
  { kind: "linear", name: "Linear" },
  { kind: "file", name: "Notes .md / .txt" },
];

export default function LandingSources() {
  return (
    <section
      data-screen-label="Sources"
      style={{
        borderTop: "1px solid rgba(34,29,25,0.07)",
        borderBottom: "1px solid rgba(34,29,25,0.07)",
        background: bg.soft2,
      }}
    >
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "clamp(18px, 2.4vw, 26px) clamp(18px, 5vw, 44px)",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "center",
          gap: "12px clamp(14px, 2vw, 28px)",
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 10 }}>
          <span style={label}>Branche</span>
          {sources.map((s) => (
            <span key={s.name} style={pill}>
              <SourceIcon kind={s.kind} style={{ color: text.secondary }} />
              {s.name}
            </span>
          ))}
        </div>
        <span style={{ fontFamily: fontMono, color: accent, fontSize: 18 }} aria-hidden="true">
          →
        </span>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: "6px 10px" }}>
          <span style={label}>Publie sur</span>
          <span style={{ fontSize: 14.5, fontWeight: 600, color: text.secondary, whiteSpace: "nowrap" }}>
            LinkedIn · TikTok · Instagram · YouTube
          </span>
        </div>
      </div>
    </section>
  );
}
