"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading } from "@/lib/design/tokens";
import { text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import BrandMark from "@/components/landing/BrandMark";
import { OPEN_PRICING_EVENT, PRICING_ENABLED } from "@/components/landing/LandingOffer";

const logoLinkStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, color: text.body };
const logoLinkHover: CSSProperties = { color: text.body };

const navLinkStyle: CSSProperties = { display: "none", fontSize: 15, fontWeight: 500, color: text.secondary };
const navLinkHover: CSSProperties = { color: text.body };

const tarifsLinkStyle: CSSProperties = { fontSize: 15, fontWeight: 500, color: text.secondary, padding: "8px 6px" };
const tarifsLinkHover: CSSProperties = { color: text.body };

const ctaLinkStyle: CSSProperties = {
  fontSize: 15,
  fontWeight: 500,
  color: text.body,
  padding: "9px 17px",
  borderRadius: 999,
  border: `1px solid ${ink(0.15)}`,
  transition: "background .25s ease, transform .25s ease",
};
const ctaLinkHover: CSSProperties = { background: ink(0.06), color: text.body, transform: "translateY(-1px)" };

export default function LandingHeader() {
  return (
    <header
      data-header=""
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(247,244,239,0.72)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${ink(0)}`,
        transition: "border-color .35s ease, background .35s ease",
      }}
    >
      <div
        style={{
          maxWidth: 1160,
          margin: "0 auto",
          padding: "15px clamp(18px, 5vw, 44px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <Link href="#top" style={logoLinkStyle} {...hoverHandlers(logoLinkStyle, logoLinkHover)}>
          <BrandMark size={30} />
          <span style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 20.5, letterSpacing: "-0.025em" }}>
            CreaFlow
          </span>
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 1.6vw, 26px)" }}>
          <Link href="#fonctionnalites" style={navLinkStyle} {...hoverHandlers(navLinkStyle, navLinkHover)}>
            Fonctionnalités
          </Link>
          {/* Les tarifs remplacent le CTA final en fondu : le lien demande l'affichage avant d'y aller. */}
          {PRICING_ENABLED && (
            <Link
              href="#tarifs"
              style={tarifsLinkStyle}
              {...hoverHandlers(tarifsLinkStyle, tarifsLinkHover)}
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PRICING_EVENT))}
            >
              Tarifs
            </Link>
          )}
          <Link href="/login?mode=signup" style={ctaLinkStyle} {...hoverHandlers(ctaLinkStyle, ctaLinkHover)}>
            Se connecter
          </Link>
        </nav>
      </div>
    </header>
  );
}
