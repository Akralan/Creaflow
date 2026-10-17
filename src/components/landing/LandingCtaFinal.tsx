"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentHover, accentText, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import PostFan from "@/components/landing/PostFan";
import styles from "@/components/landing/landing.module.css";

const ctaStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "17px 32px",
  borderRadius: 15,
  background: accent,
  color: "#fffdfa",
  fontSize: 17,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  boxShadow: "0 16px 34px -14px oklch(0.55 0.2 292 / 0.9)",
  animation: "cf-bob 5.5s ease-in-out infinite",
  transition: "background .3s ease",
};
const ctaHover: CSSProperties = { background: accentHover, color: "#fffdfa" };

const pricingToggleStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "15px 22px",
  borderRadius: 15,
  border: `1px solid ${ink(0.14)}`,
  background: "rgba(255,253,250,0.6)",
  color: text.body,
  fontSize: 15.5,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  transition: "background .25s ease, border-color .25s ease",
};
const pricingToggleHover: CSSProperties = { background: "rgba(255,253,250,1)", borderColor: ink(0.26), color: text.body };

type Props = {
  /** Absent when pricing is hidden (see PRICING_ENABLED in LandingOffer). */
  onShowPricing?: () => void;
};

/**
 * Closing word, with the repeated CTA — the last thing seen before the footer. Takes up a
 * full screen (the panel used to stop halfway, which broke the section stacking),
 * the post fan grows with the window (see --card-w in .fan).
 */
export default function LandingCtaFinal({ onShowPricing }: Props) {
  return (
    <div data-screen-label="Final CTA" className={styles.ctaFinal} style={{ position: "relative", overflow: "hidden" }}>
      <div
        data-parallax=""
        data-speed="0.14"
        style={{
          position: "absolute",
          top: "-20vw",
          left: "50%",
          transform: "translateX(-50%)",
          width: "60vw",
          height: "50vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, oklch(0.6 0.19 292 / 0.24), transparent 66%)",
          filter: "blur(36px)",
          animation: "cf-float-b 23s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          width: "100%",
          padding: "clamp(28px, 4vw, 56px) clamp(18px, 5vw, 44px) clamp(40px, 6vw, 72px)",
          textAlign: "center",
        }}
      >
        <PostFan />
        <h2
          data-reveal=""
          style={{
            margin: "0 auto",
            fontFamily: fontHeading,
            fontWeight: 700,
            fontSize: "clamp(2.1rem, 5.4vw, 3.7rem)",
            lineHeight: 1.02,
            letterSpacing: "-0.038em",
            color: text.heading,
            maxWidth: "20ch",
            textWrap: "balance",
          }}
        >
          Go back to building.
        </h2>
        <p
          data-reveal=""
          data-delay={80}
          style={{ margin: "20px auto 0", fontSize: "1.06rem", lineHeight: 1.55, color: text.secondary, maxWidth: "44ch", textWrap: "pretty" }}
        >
          Connect a source, pick your posting days, and your first week is drafted. Free, no credit card.
        </p>
        <div
          data-reveal=""
          data-delay={160}
          style={{ marginTop: 32, display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 14 }}
        >
          <Link href="/onboarding" style={ctaStyle} {...hoverHandlers(ctaStyle, ctaHover)}>
            Start for free
            <span style={{ fontFamily: fontMono, fontSize: 15 }}>→</span>
          </Link>
          {onShowPricing && (
            <button type="button" onClick={onShowPricing} style={pricingToggleStyle} {...hoverHandlers(pricingToggleStyle, pricingToggleHover)}>
              See pricing
              <span style={{ color: accentText, fontFamily: fontMono, fontSize: 14 }}>→</span>
            </button>
          )}
        </div>
        {onShowPricing && (
          <p data-reveal="" data-delay={220} style={{ margin: "18px auto 0", fontSize: 13.5, color: text.faint }}>
            Then from $20 a month, cancel anytime.
          </p>
        )}
      </div>
    </div>
  );
}
