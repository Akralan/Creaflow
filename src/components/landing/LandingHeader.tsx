"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { accent, accentAlpha, accentHover, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import Wordmark from "@/components/Wordmark";
import { OPEN_PRICING_EVENT, PRICING_ENABLED } from "@/components/landing/LandingOffer";
import { FEATURES_ENABLED } from "@/components/landing/flags";

const logoLinkStyle: CSSProperties = { display: "flex", alignItems: "center", gap: 10, color: text.body };
const logoLinkHover: CSSProperties = { color: text.body };

const navLinkStyle: CSSProperties = { display: "none", fontSize: 15, fontWeight: 500, color: text.secondary };
const navLinkHover: CSSProperties = { color: text.body };

const tarifsLinkStyle: CSSProperties = { fontSize: 15, fontWeight: 500, color: text.secondary, padding: "8px 6px" };
const tarifsLinkHover: CSSProperties = { color: text.body };

const ctaLinkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 14.5,
  fontWeight: 600,
  color: "#fffdfa",
  padding: "10px 16px",
  borderRadius: 11,
  background: accent,
  boxShadow: `0 10px 22px -14px ${accentAlpha(0.9)}`,
  transition: "background .25s ease, transform .25s ease",
};
const ctaLinkHover: CSSProperties = { background: accentHover, color: "#fffdfa", transform: "translateY(-1px)" };

export default function LandingHeader() {
  return (
    <header
      data-header=""
      style={{
        position: "sticky",
        top: 0,
        zIndex: 50,
        background: "rgba(250,249,245,0.72)",
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
          <Wordmark size={27} />
        </Link>
        <nav style={{ display: "flex", alignItems: "center", gap: "clamp(8px, 1.6vw, 26px)" }}>
          {FEATURES_ENABLED ? (
            <Link href="#fonctionnalites" style={navLinkStyle} {...hoverHandlers(navLinkStyle, navLinkHover)}>
              Features
            </Link>
          ) : (
            <Link href="#ce-que-ca-change" style={navLinkStyle} {...hoverHandlers(navLinkStyle, navLinkHover)}>
              What changes
            </Link>
          )}
          {/* Pricing replaces the final CTA with a fade: the link asks for it to be shown before jumping there. */}
          {PRICING_ENABLED && (
            <Link
              href="#tarifs"
              style={tarifsLinkStyle}
              {...hoverHandlers(tarifsLinkStyle, tarifsLinkHover)}
              onClick={() => window.dispatchEvent(new CustomEvent(OPEN_PRICING_EVENT))}
            >
              Pricing
            </Link>
          )}
          <Link href="/login" style={tarifsLinkStyle} {...hoverHandlers(tarifsLinkStyle, tarifsLinkHover)}>
            Log in
          </Link>
          <Link href="/onboarding" style={ctaLinkStyle} {...hoverHandlers(ctaLinkStyle, ctaLinkHover)}>
            Generate my week
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
