"use client";

import type { CSSProperties } from "react";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, bg, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import SourceIcon from "@/components/landing/SourceIcon";
import { usePersona } from "@/components/landing/usePersona";
import AngleRotator from "@/components/landing/AngleRotator";
import styles from "@/components/landing/landing.module.css";

const cardBase: CSSProperties = {
  background: bg.card,
  border: `1px solid ${ink(0.08)}`,
  borderRadius: 20,
  padding: "clamp(20px, 2.6vw, 30px)",
  display: "flex",
  flexDirection: "column",
  gap: 0,
  transition: "transform .35s cubic-bezier(.2,.75,.2,1), box-shadow .35s ease",
};
const cardHover: CSSProperties = { transform: "translateY(-4px)", boxShadow: `0 20px 38px -30px ${ink(0.5)}` };

const eyebrow: CSSProperties = { fontFamily: fontMono, fontSize: 12, color: accent, letterSpacing: "0.08em" };
const cardTitle: CSSProperties = {
  margin: "10px 0 10px",
  fontFamily: fontHeading,
  fontWeight: 600,
  fontSize: "1.22rem",
  lineHeight: 1.18,
  letterSpacing: "-0.022em",
  color: text.heading,
};
const cardDescription: CSSProperties = { margin: 0, fontSize: "0.98rem", lineHeight: 1.6, color: text.secondary, textWrap: "pretty" };
const cardVisual: CSSProperties = { marginTop: "auto", paddingTop: 18 };
const visualBox: CSSProperties = { padding: "12px 14px", borderRadius: 12, background: bg.soft1 };

const sourceLine: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 9,
  padding: "10px 12px",
  borderRadius: 10,
  background: bg.card,
  border: `1px solid ${ink(0.07)}`,
  fontSize: 12.5,
  lineHeight: 1.45,
  color: text.secondary,
  minWidth: 0,
};

const formatTag = (strong = false): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px",
  borderRadius: 8,
  background: strong ? accentAlpha(0.12) : bg.card,
  border: `1px solid ${strong ? accentAlpha(0.3) : ink(0.07)}`,
  fontSize: 12,
  fontWeight: 600,
  color: strong ? accentText : text.secondary,
});

const bars: Array<{ label: string; width: number; color: string }> = [
  { label: "Behind the scenes", width: 84, color: accent },
  { label: "Decisions", width: 58, color: "oklch(0.62 0.16 292)" },
  { label: "How-tos", width: 26, color: "oklch(0.72 0.11 292)" },
];

export default function LandingFeatures() {
  const { persona, fadeClass } = usePersona();
  return (
    <section
      id="fonctionnalites"
      data-screen-label="Features"
      style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(56px, 9vw, 116px) clamp(18px, 5vw, 44px)" }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: "14px 32px", marginBottom: "clamp(28px, 4.5vw, 54px)" }}>
        <div>
          <p
            data-reveal=""
            style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: text.faint }}
          >
            What Buildloud does
          </p>
          <h2
            data-reveal=""
            data-delay={60}
            style={{
              margin: 0,
              fontFamily: fontHeading,
              fontWeight: 600,
              fontSize: "clamp(1.8rem, 3.8vw, 2.9rem)",
              lineHeight: 1.06,
              letterSpacing: "-0.034em",
              color: text.heading,
              maxWidth: "22ch",
              textWrap: "balance",
            }}
          >
            An editor-in-chief that only talks about what you actually did
          </h2>
        </div>
        <p data-reveal="" data-delay={120} className={styles.hideOnPhone} style={{ margin: 0, fontSize: "1.02rem", lineHeight: 1.55, color: text.secondary, maxWidth: "38ch", textWrap: "pretty" }}>
          It all starts from your material. Nothing is made up, nothing is repeated, and you have the final say
          on every post.
        </p>
      </div>

      <div className={styles.featGrid}>
        <article
          data-reveal=""
          className={styles.featWide}
          style={{
            background: bg.card,
            border: `1px solid ${ink(0.08)}`,
            borderRadius: 22,
            padding: "clamp(22px, 3.4vw, 42px)",
            boxShadow: `0 1px 2px ${ink(0.035)}, 0 26px 50px -40px ${ink(0.4)}`,
          }}
        >
          <div className={styles.featWideInner}>
            <div>
              <span style={eyebrow}>01</span>
              <h3
                style={{
                  margin: "10px 0 12px",
                  fontFamily: fontHeading,
                  fontWeight: 600,
                  fontSize: "clamp(1.3rem, 2.2vw, 1.8rem)",
                  lineHeight: 1.12,
                  letterSpacing: "-0.026em",
                  color: text.heading,
                }}
              >
                It only writes from your material
              </h3>
              <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.62, color: text.secondary, maxWidth: "44ch", textWrap: "pretty" }}>
                A commit, a page of notes, a closed issue: every post is drawn from a fact you
                recorded, and you can see where it comes from. No material, no post. Never an invented detail.
              </p>
            </div>
            <div className={fadeClass} style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8, padding: "clamp(12px, 2vw, 20px)", borderRadius: 16, background: "#faf7f2", border: `1px solid ${ink(0.06)}` }} aria-hidden="true">
              {persona.proof.sources.map((source) => (
                <div key={source.meta} style={sourceLine}>
                  <SourceIcon kind={source.kind} style={{ color: text.faint, marginTop: 1 }} />
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontFamily: fontMono, fontSize: 10.5, color: text.faint, marginBottom: 2 }}>{source.meta}</span>
                    {source.text}
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", justifyContent: "center", color: accent, fontFamily: fontMono, fontSize: 16, lineHeight: 1 }}>↓</div>
              <div style={{ ...sourceLine, background: accentAlpha(0.07), border: `1px solid ${accentAlpha(0.22)}`, color: text.body, flexDirection: "column", gap: 4 }}>
                <span style={{ fontFamily: fontMono, fontSize: 10.5, color: accentText, letterSpacing: "0.06em" }}>{persona.proof.postLabel}</span>
                <span style={{ fontFamily: fontHeading, fontWeight: 600, fontSize: 14, lineHeight: 1.3, letterSpacing: "-0.015em", color: text.heading }}>
                  {persona.proof.postHook}
                </span>
              </div>
            </div>
          </div>
        </article>

        <article data-reveal="" data-delay={60} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>02</span>
          <h3 style={cardTitle}>Never the same angle twice</h3>
          <p style={cardDescription}>
            Buildloud remembers everything you&apos;ve published and forces a fresh angle on every generation.
          </p>
          <div style={cardVisual}>
            <AngleRotator />
          </div>
        </article>

        <article data-reveal="" data-delay={120} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>03</span>
          <h3 style={cardTitle}>The right format for every platform</h3>
          <p style={cardDescription}>
            Text post for LinkedIn, shot-by-shot script for TikTok, carousel for Instagram. Same material, right
            format.
          </p>
          <div style={cardVisual} aria-hidden="true">
            <div style={{ ...visualBox, display: "flex", flexWrap: "wrap", gap: 7 }}>
              <span style={formatTag(true)}>LinkedIn · text</span>
              <span style={formatTag()}>TikTok · script</span>
              <span style={formatTag()}>Instagram · carousel</span>
              <span style={formatTag()}>YouTube · shot by shot</span>
            </div>
          </div>
        </article>

        {/* On phones, we stop at the first three: material, angles, formats. */}
        <article data-reveal="" data-delay={180} className={styles.hideOnPhone} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>04</span>
          <h3 style={cardTitle}>What works guides what&apos;s next</h3>
          <p style={cardDescription}>
            Views and reactions come back automatically. Buildloud suggests rebalancing your line, and you approve or
            not.
          </p>
          <div style={cardVisual} aria-hidden="true">
            <div style={{ ...visualBox, display: "grid", gap: 9 }}>
              {bars.map((bar) => (
                <div key={bar.label} style={{ display: "grid", gridTemplateColumns: "104px minmax(0, 1fr)", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: text.body }}>{bar.label}</span>
                  <span style={{ height: 8, borderRadius: 999, background: bg.track, overflow: "hidden" }}>
                    <span style={{ display: "block", height: "100%", width: `${bar.width}%`, borderRadius: 999, background: bar.color }} />
                  </span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4, paddingTop: 9, borderTop: `1px solid ${ink(0.07)}` }}>
                <span style={{ fontSize: 12, color: text.secondary }}>Suggestion: 2 behind-the-scenes posts a week</span>
                <span style={{ fontSize: 11.5, fontWeight: 600, padding: "5px 10px", borderRadius: 8, background: accent, color: "#fffdfa", whiteSpace: "nowrap" }}>Approve</span>
              </div>
            </div>
          </div>
        </article>

        <article data-reveal="" data-delay={240} className={styles.hideOnPhone} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>05</span>
          <h3 style={cardTitle}>Your style, learned from your edits</h3>
          <p style={cardDescription}>
            Every sentence you tweak becomes a rule, offered for your approval, that Buildloud then follows
            everywhere it writes.
          </p>
          <div style={cardVisual} aria-hidden="true">
            <div style={{ ...visualBox, display: "grid", gap: 7 }}>
              <span style={{ fontFamily: fontMono, fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: text.faint }}>Learned rule</span>
              <span style={{ fontSize: 12.5, lineHeight: 1.45, color: text.body }}>
                Never &ldquo;I&apos;m thrilled to announce&rdquo;. Lead with the fact, not the emotion.
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: fontMono, fontSize: 10.5, color: accentText }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
                applied to 12 posts
              </span>
            </div>
          </div>
        </article>
      </div>
    </section>
  );
}
