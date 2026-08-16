"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentHover, accentText, bg, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";

// Le design source expose un prop `billing` (mensuel/annuel) mais aucun interrupteur n'est
// visible dans le HTML rendu — c'est une variante interne à l'outil de design, pas un vrai
// composant interactif. On implémente uniquement la version "mensuel" (cf. src/lib/billing/plans.ts
// pour les quotas de scripts associés à chaque plan).
const cardBase: CSSProperties = {
  background: bg.card,
  border: `1px solid ${ink(0.08)}`,
  borderRadius: 20,
  padding: "clamp(24px, 2.8vw, 34px)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  transition: "transform .35s cubic-bezier(.2,.75,.2,1), box-shadow .35s ease",
};
const cardHover: CSSProperties = { transform: "translateY(-4px)", boxShadow: `0 22px 40px -32px ${ink(0.5)}` };

const proCardBase: CSSProperties = {
  position: "relative",
  background: bg.card,
  border: `1.5px solid ${accentAlpha(0.45)}`,
  borderRadius: 20,
  padding: "clamp(24px, 2.8vw, 34px)",
  display: "flex",
  flexDirection: "column",
  gap: 18,
  boxShadow: `0 2px 4px ${ink(0.04)}, 0 30px 56px -38px ${accentAlpha(0.8)}`,
  transition: "transform .35s cubic-bezier(.2,.75,.2,1), box-shadow .35s ease",
};
const proCardHover: CSSProperties = { transform: "translateY(-5px)", boxShadow: `0 34px 62px -34px ${accentAlpha(0.9)}` };

const outlineCta: CSSProperties = {
  marginTop: "auto",
  display: "block",
  textAlign: "center",
  padding: "13px 20px",
  borderRadius: 13,
  border: `1px solid ${ink(0.16)}`,
  color: text.body,
  fontSize: 15.5,
  fontWeight: 600,
  transition: "background .25s ease",
};
const outlineCtaHover: CSSProperties = { background: ink(0.05), color: text.body };

const primaryCta: CSSProperties = {
  marginTop: "auto",
  display: "block",
  textAlign: "center",
  padding: "13px 20px",
  borderRadius: 13,
  background: accent,
  color: "#fffdfa",
  fontSize: 15.5,
  fontWeight: 600,
  boxShadow: `0 12px 24px -14px ${accentAlpha(0.9)}`,
  transition: "background .25s ease",
};
const primaryCtaHover: CSSProperties = { background: accentHover, color: "#fffdfa" };

const priceStyle: CSSProperties = {
  fontFamily: fontHeading,
  fontWeight: 700,
  fontSize: "clamp(2.2rem, 3.6vw, 2.8rem)",
  letterSpacing: "-0.04em",
  color: text.heading,
};
const planName: CSSProperties = {
  margin: "0 0 14px",
  fontFamily: fontHeading,
  fontWeight: 600,
  fontSize: "1.1rem",
  color: text.heading,
  letterSpacing: "-0.015em",
};
const planDescription: CSSProperties = { margin: "12px 0 0", fontSize: "0.97rem", lineHeight: 1.55, color: text.secondary };

export default function LandingPricing() {
  return (
    <section
      id="tarifs"
      data-screen-label="Tarifs"
      style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(64px, 9vw, 116px) clamp(18px, 5vw, 44px)" }}
    >
      <p
        data-reveal=""
        style={{
          margin: "0 0 12px",
          fontFamily: fontMono,
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: text.faint,
        }}
      >
        Tarifs
      </p>
      <h2
        data-reveal=""
        data-delay={60}
        style={{
          margin: "0 0 10px",
          fontFamily: fontHeading,
          fontWeight: 600,
          fontSize: "clamp(1.85rem, 3.8vw, 2.9rem)",
          lineHeight: 1.06,
          letterSpacing: "-0.034em",
          color: text.heading,
          maxWidth: "20ch",
          textWrap: "balance",
        }}
      >
        Commencez sans rien payer
      </h2>
      <p data-reveal="" data-delay={120} style={{ margin: "0 0 clamp(30px, 4vw, 48px)", fontSize: "1.03rem", color: text.secondary, lineHeight: 1.55 }}>
        Sans engagement. Changez de formule ou arrêtez quand vous voulez.
      </p>

      <div style={{ display: "grid", gap: "clamp(14px, 1.8vw, 20px)", gridTemplateColumns: "repeat(auto-fit, minmax(276px, 1fr))", alignItems: "stretch" }}>
        <article data-reveal="" style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <div>
            <p style={planName}>Essai gratuit</p>
            <p style={priceStyle}>0 €</p>
            <p style={planDescription}>5 scripts offerts, à vie. Sans carte bancaire, sans engagement.</p>
          </div>
          <Link href="/login?mode=signup" style={outlineCta} {...hoverHandlers(outlineCta, outlineCtaHover)}>
            Créer mon compte
          </Link>
        </article>

        <article data-reveal="" data-delay={80} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <div>
            <p style={planName}>Starter</p>
            <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={priceStyle}>20 €</span>
              <span style={{ fontSize: "0.95rem", color: text.muted }}>/mois</span>
            </p>
            <p style={planDescription}>30 scripts générés par mois. De quoi publier deux fois par semaine, toute l&apos;année.</p>
          </div>
          <Link href="/login?mode=signup" style={outlineCta} {...hoverHandlers(outlineCta, outlineCtaHover)}>
            Choisir Starter
          </Link>
        </article>

        <article data-reveal="" data-delay={160} style={proCardBase} {...hoverHandlers(proCardBase, proCardHover)}>
          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
              <p style={{ margin: 0, fontFamily: fontHeading, fontWeight: 600, fontSize: "1.1rem", color: text.heading, letterSpacing: "-0.015em" }}>
                Pro
              </p>
              <span style={{ fontSize: 12.5, fontWeight: 600, padding: "4px 11px", borderRadius: 999, background: accentAlpha(0.12), color: accentText }}>
                Le plus choisi
              </span>
            </div>
            <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={priceStyle}>45 €</span>
              <span style={{ fontSize: "0.95rem", color: text.muted }}>/mois</span>
            </p>
            <p style={planDescription}>150 scripts générés par mois. Pour être présent tous les jours, sur plusieurs plateformes.</p>
          </div>
          <Link href="/login?mode=signup" style={primaryCta} {...hoverHandlers(primaryCta, primaryCtaHover)}>
            Choisir Pro
          </Link>
        </article>
      </div>
    </section>
  );
}
