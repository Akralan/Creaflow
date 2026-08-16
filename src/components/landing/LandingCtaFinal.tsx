"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentHover, text } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";

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

export default function LandingCtaFinal() {
  return (
    <section data-screen-label="CTA final" style={{ position: "relative", overflow: "hidden", borderTop: "1px solid rgba(34,29,25,0.07)" }}>
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
          padding: "clamp(72px, 10vw, 132px) clamp(18px, 5vw, 44px)",
          textAlign: "center",
        }}
      >
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
          Vos cinq premiers scripts vous attendent
        </h2>
        <p
          data-reveal=""
          data-delay={80}
          style={{ margin: "20px auto 0", fontSize: "1.06rem", lineHeight: 1.55, color: text.secondary, maxWidth: "42ch", textWrap: "pretty" }}
        >
          Dix minutes de conversation, et votre ligne éditoriale est prête. Sans carte bancaire.
        </p>
        <div data-reveal="" data-delay={160} style={{ marginTop: 32 }}>
          <Link href="/login?mode=signup" style={ctaStyle} {...hoverHandlers(ctaStyle, ctaHover)}>
            Démarrer gratuitement
            <span style={{ fontFamily: fontMono, fontSize: 15 }}>→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
