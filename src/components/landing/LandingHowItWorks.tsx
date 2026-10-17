import type { CSSProperties, ReactNode } from "react";
import { accent, accentAlpha, accentText, bg, text, ink } from "@/components/landing/theme";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import SourceIcon from "@/components/landing/SourceIcon";
import styles from "@/components/landing/landing.module.css";

const smallPill: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 10px 6px 8px",
  borderRadius: 999,
  background: bg.card,
  border: `1px solid ${ink(0.09)}`,
  fontSize: 12.5,
  fontWeight: 600,
  color: text.body,
  whiteSpace: "nowrap",
};

const questionChip: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "6px 11px",
  borderRadius: 999,
  background: accentAlpha(0.1),
  color: accentText,
  fontSize: 12.5,
  fontWeight: 600,
  whiteSpace: "nowrap",
};

const days = ["M", "T", "W", "T", "F", "S", "S"];
const plannedDays = new Set([0, 2, 4]);

const steps: Array<{ title: string; description: string; visual: ReactNode }> = [
  {
    title: "Connect what you already have",
    description:
      "GitHub, Notion or Linear in one click, or your pasted notes. Tellovo reads the files, the pages, the history, the closed issues. That's your material, nothing else.",
    visual: (
      <div className={styles.howVisual} aria-hidden="true">
        <span style={smallPill}><SourceIcon kind="github" style={{ color: text.secondary }} />GitHub</span>
        <span style={smallPill}><SourceIcon kind="notion" style={{ color: text.secondary }} />Notion</span>
        <span style={smallPill}><SourceIcon kind="linear" style={{ color: text.secondary }} />Linear</span>
        <span style={smallPill}><SourceIcon kind="file" style={{ color: text.secondary }} />.md</span>
      </div>
    ),
  },
  {
    title: "Tellovo finds your topics",
    description:
      "It reads your material, works out who you write for, and sets up recurring series. You choose your posting days and networks.",
    visual: (
      <div className={styles.howVisual} aria-hidden="true">
        <span style={questionChip}>Your topics</span>
        <span style={questionChip}>Your readers</span>
        <span style={questionChip}>Your days</span>
      </div>
    ),
  },
  {
    title: "You review, you publish",
    description:
      "Every week, your calendar fills up with posts written from what you actually did. Tweak a sentence if you need to, and you're live.",
    visual: (
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 5, width: "100%", maxWidth: 260 }} aria-hidden="true">
        {days.map((d, i) => {
          const planned = plannedDays.has(i);
          return (
            <div key={i} style={{ display: "grid", gap: 5, justifyItems: "center" }}>
              <span style={{ fontFamily: fontMono, fontSize: 10, color: text.faint }}>{d}</span>
              <span
                style={{
                  width: "100%",
                  height: 24,
                  borderRadius: 7,
                  background: planned ? accentAlpha(0.2) : bg.card,
                  border: `1px solid ${planned ? accentAlpha(0.4) : ink(0.08)}`,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                {planned && <span style={{ width: 6, height: 6, borderRadius: "50%", background: accent }} />}
              </span>
            </div>
          );
        })}
      </div>
    ),
  },
];

/**
 * Three-step journey: centered numbered bullet, centered content below, and on
 * desktop a dotted line from the first to the third bullet. No cards.
 */
export default function LandingHowItWorks() {
  return (
    <section
      id="comment-ca-marche"
      data-screen-label="How it works"
      style={{ scrollMarginTop: 64, borderTop: "1px solid rgba(34,29,25,0.07)", background: bg.soft2 }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(52px, 8vw, 100px) clamp(18px, 5vw, 44px)" }}>
        <div style={{ textAlign: "center", marginBottom: "clamp(36px, 5vw, 64px)" }}>
          <p
            data-reveal=""
            style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: text.faint }}
          >
            How it works
          </p>
          <h2
            data-reveal=""
            data-delay={60}
            style={{
              margin: "0 auto",
              fontFamily: fontHeading,
              fontWeight: 600,
              fontSize: "clamp(1.8rem, 3.6vw, 2.7rem)",
              lineHeight: 1.08,
              letterSpacing: "-0.032em",
              color: text.heading,
              maxWidth: "20ch",
              textWrap: "balance",
            }}
          >
            Ten minutes to set up, then it just runs.
          </h2>
          <p
            data-reveal=""
            data-delay={120}
            style={{ margin: "14px auto 0", fontSize: "1.02rem", lineHeight: 1.6, color: text.secondary, maxWidth: "46ch", textWrap: "pretty" }}
          >
            No brief to write, no prompt to master. You keep working, Tellovo follows what you
            document.
          </p>
        </div>

        <ol className={styles.howSteps}>
          {steps.map((step, i) => (
            <li key={step.title} data-reveal="" data-delay={i * 120} className={styles.howStep}>
              <span className={styles.howBullet} aria-hidden="true">
                {i + 1}
              </span>
              <h3
                style={{
                  margin: "18px 0 10px",
                  fontFamily: fontHeading,
                  fontWeight: 600,
                  fontSize: "clamp(1.15rem, 1.8vw, 1.4rem)",
                  lineHeight: 1.16,
                  letterSpacing: "-0.024em",
                  color: text.heading,
                }}
              >
                {step.title}
              </h3>
              <p style={{ margin: "0 0 16px", fontSize: "0.98rem", lineHeight: 1.6, color: text.secondary, textWrap: "pretty", maxWidth: "34ch" }}>
                {step.description}
              </p>
              {step.visual}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
