"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, accentHover, bg, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import SourceIcon from "@/components/landing/SourceIcon";
import { pausePersonaRotation, usePersona } from "@/components/landing/usePersona";
import styles from "@/components/landing/landing.module.css";

const ctaStyle: CSSProperties = {
  position: "relative",
  overflow: "hidden",
  display: "inline-flex",
  alignItems: "center",
  gap: 10,
  padding: "16px 28px",
  borderRadius: 15,
  background: accent,
  color: "#fffdfa",
  fontSize: 16.5,
  fontWeight: 600,
  letterSpacing: "-0.01em",
  boxShadow: `0 14px 30px -14px ${accentAlpha(0.85)}`,
  transition: "transform .3s cubic-bezier(.2,.75,.2,1), box-shadow .3s ease, background .3s ease",
};
const ctaHover: CSSProperties = {
  background: accentHover,
  color: "#fffdfa",
  transform: "translateY(-2px)",
  boxShadow: `0 20px 38px -16px ${accentAlpha(0.95)}`,
};

const secondaryStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  padding: "15px 20px",
  borderRadius: 15,
  color: text.body,
  fontSize: 15.5,
  fontWeight: 600,
  border: `1px solid ${ink(0.14)}`,
  background: "rgba(255,253,250,0.55)",
  transition: "background .25s ease, border-color .25s ease",
};
const secondaryHover: CSSProperties = { background: "rgba(255,253,250,1)", borderColor: ink(0.26), color: text.body };

const scheduleItemBase: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 11,
  background: bg.card,
  border: `1px solid ${ink(0.07)}`,
  borderRadius: 11,
  padding: "9px 11px",
  transition: "transform .3s ease",
};
const scheduleItemHighlighted: CSSProperties = {
  ...scheduleItemBase,
  border: `1px solid ${accentAlpha(0.32)}`,
  boxShadow: `0 10px 24px -20px ${accentAlpha(0.9)}`,
};
const scheduleItemHover: CSSProperties = { transform: "translateX(3px)" };

const mono = fontMono;

const railIcon: CSSProperties = { width: 26, height: 26, borderRadius: 8, background: ink(0.06) };
const railIconActive: CSSProperties = { ...railIcon, background: accentAlpha(0.16), boxShadow: `inset 0 0 0 1px ${accentAlpha(0.3)}` };

const sourceChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  padding: "5px 10px 5px 8px",
  borderRadius: 8,
  background: bg.card,
  border: `1px solid ${ink(0.07)}`,
  fontSize: 11.5,
  fontWeight: 600,
  color: text.body,
  minWidth: 0,
};

const provenanceTag: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  fontFamily: mono,
  fontSize: 10.5,
  color: accentText,
  background: accentAlpha(0.09),
  borderRadius: 6,
  padding: "3px 7px",
  whiteSpace: "nowrap",
};

export default function LandingHero() {
  const { persona, fadeClass } = usePersona();

  return (
    <section id="top" data-screen-label="Hero" style={{ position: "relative", overflow: "hidden" }}>
      <div
        data-parallax=""
        data-speed="0.12"
        style={{
          position: "absolute",
          top: "-14vw",
          left: "-8vw",
          width: "46vw",
          height: "46vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, oklch(0.62 0.19 292 / 0.28), transparent 68%)",
          filter: "blur(28px)",
          animation: "cf-float-a 17s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />
      <div
        data-parallax=""
        data-speed="0.2"
        style={{
          position: "absolute",
          top: "6vw",
          right: "-14vw",
          width: "42vw",
          height: "42vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, oklch(0.72 0.13 62 / 0.3), transparent 66%)",
          filter: "blur(34px)",
          animation: "cf-float-b 21s ease-in-out infinite",
          pointerEvents: "none",
        }}
      />

      <div
        className={styles.heroGrid}
        style={{
          position: "relative",
          maxWidth: 1160,
          margin: "0 auto",
          padding: "clamp(36px, 6.5vw, 88px) clamp(18px, 5vw, 44px) clamp(48px, 7vw, 96px)",
        }}
      >
        {/* Text column */}
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 9,
              padding: "6px 14px 6px 10px",
              borderRadius: 999,
              background: "rgba(255,253,250,0.8)",
              border: `1px solid ${ink(0.09)}`,
              color: accentText,
              fontSize: 13.5,
              fontWeight: 500,
              marginBottom: "clamp(18px, 2.6vw, 28px)",
              boxShadow: `0 6px 18px -14px ${ink(0.5)}`,
              animation: "cf-rise .8s cubic-bezier(.2,.75,.2,1) both",
              maxWidth: "100%",
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, flexShrink: 0, animation: "cf-blink 2.6s ease-in-out infinite" }} />
            <span className={fadeClass} style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {persona.badge}
            </span>
          </div>
          <h1
            className={styles.heroTitle}
            style={{
              margin: 0,
              fontFamily: fontHeading,
              fontWeight: 700,
              lineHeight: 0.98,
              letterSpacing: "-0.042em",
              maxWidth: "15ch",
              color: text.heading,
              textWrap: "balance",
            }}
          >
            <span className={styles.heroLine} style={{ animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) both" }}>Your work becomes</span>{" "}
            <span className={styles.heroLine} style={{ animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) .1s both" }}>your best</span>{" "}
            <span className={styles.heroLine} style={{ animation: "cf-rise .9s cubic-bezier(.2,.75,.2,1) .2s both", color: accent, whiteSpace: "nowrap" }}>salesperson.</span>
          </h1>
          <p
            style={{
              margin: "clamp(16px, 2.4vw, 26px) 0 0",
              fontSize: "clamp(1.02rem, 1.5vw, 1.2rem)",
              lineHeight: 1.55,
              color: text.secondary,
              maxWidth: "46ch",
              textWrap: "pretty",
              animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .3s both",
            }}
          >
            Connect GitHub, Notion or Linear, or paste your notes. Buildloud reads what you actually did and writes
            ready-to-publish posts for you. Never made up, never repeated.
          </p>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 12,
              marginTop: "clamp(22px, 3.4vw, 36px)",
              animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .42s both",
            }}
          >
            <Link href="/onboarding" style={ctaStyle} {...hoverHandlers(ctaStyle, ctaHover)}>
              Start for free
              <span style={{ fontFamily: mono, fontSize: 15 }}>→</span>
            </Link>
            <Link href="#comment-ca-marche" className={styles.hideOnPhone} style={secondaryStyle} {...hoverHandlers(secondaryStyle, secondaryHover)}>
              How it works
            </Link>
          </div>
          <p
            style={{
              margin: "14px 0 0",
              fontSize: 13.5,
              color: text.faint,
              animation: "cf-rise 1s cubic-bezier(.2,.75,.2,1) .48s both",
            }}
          >
            Ten minutes to get started. No credit card.
          </p>
        </div>

        {/* Demo column: app window whose examples rotate between three profiles */}
        <div
          className={styles.heroDemoOuter}
          style={{ animation: "cf-rise 1.1s cubic-bezier(.2,.75,.2,1) .35s both" }}
          onMouseEnter={() => pausePersonaRotation(true)}
          onMouseLeave={() => pausePersonaRotation(false)}
        >
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "8% -6% -6% -6%",
              borderRadius: 40,
              background: `radial-gradient(ellipse at 50% 40%, ${accentAlpha(0.22)}, transparent 70%)`,
              filter: "blur(30px)",
              pointerEvents: "none",
            }}
          />
          <div className={styles.heroDemoTilt}>
            <div
              style={{
                position: "relative",
                background: bg.card,
                border: `1px solid ${ink(0.08)}`,
                borderRadius: 22,
                padding: 10,
                boxShadow: `0 2px 4px ${ink(0.03)}, 0 50px 90px -48px ${ink(0.5)}, 0 30px 60px -40px ${accentAlpha(0.45)}`,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 8px 11px" }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f0a9a0", flexShrink: 0 }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#f3cf8e", flexShrink: 0 }} />
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#a9d9a8", flexShrink: 0 }} />
                <span className={fadeClass} style={{ marginLeft: 8, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontFamily: mono, fontSize: 11, letterSpacing: "0.06em", color: text.fainter }}>
                  {persona.windowTitle}
                </span>
                <span style={{ marginLeft: "auto", flexShrink: 0, display: "inline-flex", alignItems: "center", gap: 6, fontFamily: mono, fontSize: 10.5, color: accentText, letterSpacing: "0.06em", whiteSpace: "nowrap" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent, animation: "cf-blink 2.6s ease-in-out infinite" }} />
                  SYNCED
                </span>
              </div>

              <div
                style={{
                  borderRadius: 15,
                  background: "#faf7f2",
                  border: `1px solid ${ink(0.06)}`,
                  display: "grid",
                  gridTemplateColumns: "44px minmax(0, 1fr)",
                  overflow: "hidden",
                }}
              >
                {/* Navigation rail */}
                <div className={styles.hideOnPhone} style={{ borderRight: `1px solid ${ink(0.06)}`, padding: "12px 9px", display: "grid", gap: 9, alignContent: "start", justifyItems: "center" }}>
                  <span style={railIconActive} />
                  <span style={railIcon} />
                  <span style={railIcon} />
                  <span style={railIcon} />
                </div>

                <div className={`${styles.demoContent} ${fadeClass}`} style={{ padding: "clamp(12px, 1.6vw, 16px)", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 12, minWidth: 0 }}>
                  {/* Connected sources */}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {persona.sources.map((source) => (
                      <span key={source.name} style={sourceChip}>
                        <SourceIcon kind={source.kind} style={{ color: text.secondary }} />
                        <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{source.name}</span>
                        <span style={{ fontFamily: mono, fontSize: 10, color: text.faint, whiteSpace: "nowrap" }}>{source.detail}</span>
                      </span>
                    ))}
                  </div>

                  {/* Week */}
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 8 }}>
                      <span style={{ fontFamily: fontHeading, fontWeight: 600, fontSize: 14.5, color: text.heading, letterSpacing: "-0.015em" }}>
                        This week
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 10.5, color: text.faint, letterSpacing: "0.06em" }}>3 SCHEDULED</span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}>
                      {persona.schedule.map((item) => {
                        const base = item.highlighted ? scheduleItemHighlighted : scheduleItemBase;
                        return (
                          <div key={item.title} className={item.phoneHidden ? styles.hideOnPhone : undefined} style={base} {...hoverHandlers(base, scheduleItemHover)}>
                            <span
                              style={{
                                width: 30,
                                height: 30,
                                borderRadius: 8,
                                background: item.highlighted
                                  ? `linear-gradient(135deg, ${accentAlpha(0.28)}, ${accentAlpha(0.08)})`
                                  : "repeating-linear-gradient(135deg, #efe9e0 0 6px, #e7e0d5 6px 12px)",
                                flexShrink: 0,
                              }}
                            />
                            <span style={{ minWidth: 0 }}>
                              <span style={{ display: "block", fontSize: 13, fontWeight: 600, color: text.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                {item.title}
                              </span>
                              <span style={{ display: "block", marginTop: 2, fontFamily: mono, fontSize: 10, color: item.highlighted ? accentText : text.faint, letterSpacing: "0.06em" }}>
                                {item.meta}
                              </span>
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Drafted post */}
                  <div style={{ background: bg.card, border: `1px solid ${ink(0.07)}`, borderRadius: 13, padding: "clamp(13px, 1.6vw, 17px)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                      <span style={{ fontSize: 11, fontWeight: 600, padding: "3px 9px", borderRadius: 999, background: accentAlpha(0.11), color: accentText }}>
                        Fresh angle
                      </span>
                      <span style={{ fontFamily: mono, fontSize: 10.5, color: text.faint, letterSpacing: "0.06em" }}>{persona.post.format}</span>
                    </div>
                    <p style={{ margin: "0 0 3px", fontFamily: mono, fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: text.faint }}>
                      Hook
                    </p>
                    <p style={{ margin: "0 0 10px", fontFamily: fontHeading, fontWeight: 600, fontSize: "clamp(0.98rem, 1.3vw, 1.08rem)", lineHeight: 1.22, letterSpacing: "-0.018em", color: text.heading }}>
                      {persona.post.hook}
                    </p>
                    <p className={styles.hideOnPhone} style={{ margin: "0 0 12px", fontSize: 12.5, lineHeight: 1.5, color: text.secondary }}>
                      {persona.post.body}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, paddingTop: 10, borderTop: `1px solid ${ink(0.07)}` }}>
                      <span style={{ fontFamily: mono, fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: text.faint, marginRight: 2 }}>Drawn from</span>
                      {persona.post.provenance.map((item) => (
                        <span key={item.label} style={provenanceTag}>
                          <SourceIcon kind={item.kind} scale={0.7} />
                          {item.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Reading in progress */}
                  <div className={`${styles.shimmerTrack} ${styles.hideOnPhone}`} style={{ display: "flex", alignItems: "center", gap: 9, padding: "9px 12px", borderRadius: 10, background: accentAlpha(0.08), border: `1px solid ${accentAlpha(0.14)}` }}>
                    <span style={{ display: "inline-flex", gap: 3 }} aria-hidden="true">
                      <span className={styles.typingDot} style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
                      <span className={styles.typingDot} style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
                      <span className={styles.typingDot} style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
                    </span>
                    <span style={{ fontSize: 12, color: accentText, fontWeight: 500 }}>{persona.reading}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
