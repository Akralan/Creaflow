"use client";

import { useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookMarked, Code, TrendingUp, Users } from "lucide-react";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentHover, bg, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import styles from "@/components/landing/landing.module.css";

const buttonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  padding: "13px 22px",
  borderRadius: 12,
  border: "none",
  background: accent,
  color: "#fffdfa",
  fontFamily: "inherit",
  fontSize: 15.5,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  whiteSpace: "nowrap",
  cursor: "pointer",
  transition: "background .25s ease, transform .25s ease",
};
const buttonHover: CSSProperties = { background: accentHover, transform: "translateY(-1px)" };

const stepIcon: CSSProperties = {
  display: "grid",
  placeItems: "center",
  width: 48,
  height: 48,
  borderRadius: 14,
  background: bg.card,
  border: `1px solid ${ink(0.09)}`,
  boxShadow: `0 8px 20px -14px ${ink(0.45)}`,
  color: text.body,
};
const stepIconAccent: CSSProperties = { ...stepIcon, background: accent, border: `1px solid ${accent}`, color: "#fffdfa", boxShadow: `0 10px 24px -12px ${accentAlpha(0.9)}` };

const STEPS = [
  { Icon: Code, label: "We read what you ship.", accent: false },
  { Icon: Users, label: "We write the posts.", accent: false },
  { Icon: TrendingUp, label: "Customers show up before launch.", accent: true },
];

export default function LandingHero() {
  const router = useRouter();
  const [repo, setRepo] = useState("");

  // The repository field is a placeholder for now: the onboarding takes over from here.
  function submit(e: FormEvent) {
    e.preventDefault();
    router.push("/onboarding");
  }

  return (
    <section id="top" data-screen-label="Hero" className={styles.heroSection}>
      <div
        style={{
          width: "100%",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "clamp(24px, 5vh, 64px) clamp(18px, 5vw, 44px)",
          textAlign: "center",
        }}
      >
        <h1
          className={styles.heroTitle}
          style={{
            margin: "0 auto",
            fontFamily: fontHeading,
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: "-0.05em",
            color: text.heading,
          }}
        >
          <span className={styles.heroLine} style={{ animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) both" }}>
            Just build.
          </span>
          <span className={styles.heroLine} style={{ animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) .12s both" }}>
            We grow{" "}
            <span className={styles.heroUnderlined}>
              your audience.
              <span className={styles.heroUnderline} style={{ color: accent }} />
            </span>
          </span>
        </h1>
        <p
          style={{
            margin: "clamp(16px, 3vh, 34px) auto 0",
            fontSize: "clamp(1.02rem, 1.5vw, 1.2rem)",
            lineHeight: 1.55,
            color: text.secondary,
            maxWidth: "46ch",
            textWrap: "balance",
            animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .3s both",
          }}
        >
          Tellovo reads what you ship on GitHub, Notion or Linear and writes your posts for X and LinkedIn. You just
          review.
        </p>

        <div style={{ marginTop: "clamp(20px, 4vh, 40px)", animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .42s both" }}>
          <form
            onSubmit={submit}
            className={styles.heroForm}
            style={{ background: "#ffffff", border: `1px solid ${ink(0.1)}`, boxShadow: `0 12px 30px -20px ${ink(0.35)}` }}
          >
            <BookMarked size={16} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0, color: text.faint }} />
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="github.com/you/your-saas"
              aria-label="Your GitHub repository"
              autoComplete="off"
              spellCheck={false}
              style={{
                flex: 1,
                minWidth: 0,
                border: "none",
                outline: "none",
                background: "transparent",
                fontFamily: fontMono,
                fontSize: 14,
                color: text.body,
              }}
            />
            <button type="submit" style={buttonStyle} {...hoverHandlers(buttonStyle, buttonHover)}>
              Generate my week
              <ArrowRight size={17} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </form>
          <p style={{ margin: "14px 0 0", fontSize: 13.5, color: text.faint }}>Free to start. No credit card.</p>
        </div>

        <div className={styles.heroSteps} style={{ animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .5s both" }}>
          {STEPS.map(({ Icon, label, accent: highlighted }, i) => (
            <div key={label} style={{ display: "contents" }}>
              {i > 0 && (
                <span className={styles.heroStepArrow} aria-hidden="true">
                  <ArrowRight size={18} strokeWidth={1.8} />
                </span>
              )}
              <div className={styles.heroStep}>
                <span style={highlighted ? stepIconAccent : stepIcon}>
                  <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                </span>
                <span style={{ fontFamily: fontHeading, fontWeight: 600, fontSize: "clamp(1.05rem, 1.5vw, 1.25rem)", lineHeight: 1.25, letterSpacing: "-0.02em", color: text.heading, maxWidth: "17ch", textWrap: "balance" }}>
                  {label}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
