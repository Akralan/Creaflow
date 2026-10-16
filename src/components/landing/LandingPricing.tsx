"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentHover, accentText, bg, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import styles from "@/components/landing/landing.module.css";

// Grille de tarifs, rendue repliée sous le CTA final (cf. LandingOffer). Version « mensuel »
// uniquement — cf. src/lib/billing/plans.ts pour les quotas de scripts de chaque plan.
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

const featureList: CSSProperties = { margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 };
const featureItem: CSSProperties = { display: "flex", gap: 9, alignItems: "flex-start", fontSize: 14, lineHeight: 1.45, color: text.secondary };

function Check() {
  return (
    <span style={{ color: accent, fontFamily: fontMono, fontSize: 12.5, lineHeight: "20px", flexShrink: 0 }} aria-hidden="true">
      ✓
    </span>
  );
}

const backStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "9px 14px 9px 11px",
  borderRadius: 999,
  border: `1px solid ${ink(0.14)}`,
  background: "transparent",
  color: text.secondary,
  fontSize: 14,
  fontWeight: 600,
  fontFamily: "inherit",
  cursor: "pointer",
  transition: "background .25s ease, color .25s ease",
};
const backHover: CSSProperties = { background: ink(0.05), color: text.body };

type Props = {
  onBack: () => void;
};

export default function LandingPricing({ onBack }: Props) {
  return (
    <div style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(44px, 7vw, 96px) clamp(18px, 5vw, 44px) clamp(56px, 8vw, 104px)" }}>
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "12px 32px", marginBottom: "clamp(26px, 3.5vw, 40px)" }}>
        <div>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, marginBottom: 14 }}>
            <button type="button" onClick={onBack} style={backStyle} {...hoverHandlers(backStyle, backHover)}>
              <span style={{ fontFamily: fontMono, fontSize: 13 }}>←</span>
              Retour
            </button>
            <p style={{ margin: 0, fontFamily: fontMono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: text.faint }}>
              Tarifs
            </p>
          </div>
          <h3
            style={{
              margin: 0,
              fontFamily: fontHeading,
              fontWeight: 600,
              fontSize: "clamp(1.6rem, 3.2vw, 2.3rem)",
              lineHeight: 1.06,
              letterSpacing: "-0.03em",
              color: text.heading,
              textWrap: "balance",
            }}
          >
            Commencez sans rien payer
          </h3>
        </div>
        <p style={{ margin: 0, fontSize: "1rem", color: text.secondary, lineHeight: 1.55, maxWidth: "40ch" }}>
          Sans engagement. Change de formule ou arrête quand tu veux.
        </p>
      </div>

      <div className={styles.pricingGrid}>
        <article className={styles.pricingCard} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <div>
            <p style={planName}>Essai gratuit</p>
            <p style={priceStyle}>0 €</p>
            <p style={planDescription}>Pour voir ce que CreaFlow écrit avec ta marque.</p>
          </div>
          <ul style={featureList}>
            <li style={featureItem}><Check />5 scripts offerts, à vie</li>
            <li style={featureItem}><Check />30 micro-retouches dans l&apos;éditeur</li>
            <li style={featureItem}><Check />Sans carte bancaire</li>
          </ul>
          <Link href="/login?mode=signup" style={outlineCta} {...hoverHandlers(outlineCta, outlineCtaHover)}>
            Créer mon compte
          </Link>
        </article>

        <article className={styles.pricingCard} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <div>
            <p style={planName}>Starter</p>
            <p style={{ margin: 0, display: "flex", alignItems: "baseline", gap: 7 }}>
              <span style={priceStyle}>20 €</span>
              <span style={{ fontSize: "0.95rem", color: text.muted }}>/mois</span>
            </p>
            <p style={planDescription}>De quoi publier deux fois par semaine, toute l&apos;année.</p>
          </div>
          <ul style={featureList}>
            <li style={featureItem}><Check />30 scripts générés par mois</li>
            <li style={featureItem}><Check />150 micro-retouches par mois</li>
            <li style={featureItem}><Check />Toutes les fonctionnalités</li>
          </ul>
          <Link href="/login?mode=signup" style={outlineCta} {...hoverHandlers(outlineCta, outlineCtaHover)}>
            Choisir Starter
          </Link>
        </article>

        <article className={styles.pricingCard} style={proCardBase} {...hoverHandlers(proCardBase, proCardHover)}>
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
            <p style={planDescription}>Pour être présent tous les jours, sur plusieurs plateformes.</p>
          </div>
          <ul style={featureList}>
            <li style={featureItem}><Check />150 scripts générés par mois</li>
            <li style={featureItem}><Check />600 micro-retouches par mois</li>
            <li style={featureItem}><Check />Toutes les fonctionnalités</li>
          </ul>
          <Link href="/login?mode=signup" style={primaryCta} {...hoverHandlers(primaryCta, primaryCtaHover)}>
            Choisir Pro
          </Link>
        </article>
      </div>
    </div>
  );
}
