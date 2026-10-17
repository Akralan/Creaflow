"use client";

import { useEffect, useState } from "react";
import { PROVIDER_ICONS } from "@/components/OAuthProviderButtons";
import { api } from "@/lib/apiClient";
import styles from "./generation.module.css";

export type GenerationOutput =
  | { kind: "text" }
  | { kind: "images"; count: number }
  | { kind: "animation" }
  /** Onboarding: the profile and subjects read from the material. */
  | { kind: "profile" }
  /** The suggested series, stacked. */
  | { kind: "series" }
  /** The calendar filling with the publishing days. */
  | { kind: "plan" };

const NOTES_ICON = (
  <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
    <path d="M4 1.5h5.5L13 5v9.5H4z" />
    <path d="M9.5 1.5V5H13M6 8h5M6 10.5h5" />
  </svg>
);

/** What spills out of each source: enough to recognise your own material. */
const CHIPS: Record<string, string[]> = {
  github: ["commit", "README.md", "+42 −7"],
  notion: ["page", "Decisions", "journal"],
  linear: ["issue", "done", "v2"],
  notes: ["notes", "idea", "draft"],
};

/** Tints of the fan cards: the ones from the landing page. */
const FAN_COLORS = [
  "linear-gradient(160deg, oklch(0.55 0.2 292), oklch(0.35 0.14 292))",
  "linear-gradient(160deg, oklch(0.72 0.13 62), oklch(0.5 0.13 40))",
  "linear-gradient(160deg, oklch(0.65 0.12 220), oklch(0.42 0.12 240))",
  "linear-gradient(160deg, oklch(0.68 0.14 350), oklch(0.45 0.15 330))",
  "linear-gradient(160deg, oklch(0.68 0.12 160), oklch(0.45 0.1 170))",
];

function captionsFor(output: GenerationOutput): string[] {
  if (output.kind === "profile") {
    return ["Reading your material…", "Grouping what belongs to the same project…", "Spotting who you write for…", "Drawing your profile…"];
  }
  if (output.kind === "series") {
    return ["Reading your material…", "Looking at what you're building…", "Finding the slots that come back…", "Naming your series…"];
  }
  if (output.kind === "plan") {
    return ["Spreading your publishing days…", "Matching posts to your series…", "Filling your calendar…"];
  }
  const last =
    output.kind === "text"
      ? "Writing your post…"
      : output.kind === "animation"
        ? "Splitting the text into moments…"
        : output.count > 1
          ? `Composing ${output.count} slides…`
          : "Composing your image…";
  return ["Reading your material…", "Looking for today's angle…", "Finding the hook…", last];
}

/**
 * The wait for writing, staged: the material from connected sources floats as bubbles into
 * the spinning "mixer", and comes out as the chosen post — a text being written,
 * images fanning out, or an animation. Purely decorative: no real data passes through.
 */
export default function GenerationAnimation({ output, providers: given }: { output: GenerationOutput; providers?: string[] }) {
  const [fetched, setFetched] = useState<string[]>(["github", "notion"]);
  // The caller knows better than the profile when there isn't one yet (onboarding).
  const providers = given && given.length > 0 ? given.filter((id) => id in CHIPS).slice(0, 3) : fetched;
  const [step, setStep] = useState(0);
  const captions = captionsFor(output);

  useEffect(() => {
    if (given && given.length > 0) return;
    api
      .getProfile()
      .then(({ connectedProviders }) => {
        const ids = connectedProviders.map((p) => p.id).filter((id) => id in CHIPS);
        setFetched(ids.length > 0 ? ids.slice(0, 3) : ["notes"]);
      })
      .catch(() => {});
  }, [given]);

  useEffect(() => {
    // The last phrase stays displayed: it's the longest step.
    const timer = setInterval(() => setStep((s) => Math.min(s + 1, captions.length - 1)), 2600);
    return () => clearInterval(timer);
  }, [captions.length]);

  const chips = providers.flatMap((p, row) => CHIPS[p].map((label, i) => ({ label, row, i })));
  const fanCount = output.kind === "images" ? Math.min(Math.max(output.count, 1), 5) : 0;

  return (
    <div aria-live="polite">
      <div className={styles.stage} aria-hidden>
        <div className={styles.sources}>
          {providers.map((p) => (
            <span key={p} className={styles.source}>
              {p === "notes" ? NOTES_ICON : PROVIDER_ICONS[p]}
            </span>
          ))}
        </div>

        <div className={styles.lane}>
          {chips.map(({ label, row, i }, k) => {
            const rows = providers.length;
            // Each source has its own starting height; all converge toward the center.
            const top = 50 + (row - (rows - 1) / 2) * 60;
            return (
              <span
                key={`${label}-${k}`}
                className={styles.chip}
                style={
                  {
                    top: `calc(${top}px - 9px)`,
                    animationDelay: `${(i * 0.8 + row * 0.27).toFixed(2)}s`,
                    "--converge": `${105 - top}px`,
                  } as React.CSSProperties
                }
              >
                {label}
              </span>
            );
          })}
        </div>

        <div className={styles.pot}>
          <span className={styles.ring} />
          <span className={styles.core} />
        </div>

        <div className={styles.lane}>
          {[0, 1, 2].map((i) => (
            <span key={i} className={styles.spark} style={{ animationDelay: `${i * 0.4}s` }} />
          ))}
        </div>

        <div className={styles.output}>
          {output.kind === "text" && (
            <div className={styles.textCard}>
              <div className={styles.avatarRow}>
                <span className={styles.avatar} />
                <span className={styles.line} style={{ "--w": "55%", animationDelay: "0s" } as React.CSSProperties} />
              </div>
              <span className={`${styles.line} ${styles.lineStrong}`} style={{ "--w": "95%", animationDelay: "0.3s" } as React.CSSProperties} />
              <span className={`${styles.line} ${styles.lineStrong}`} style={{ "--w": "70%", animationDelay: "0.55s" } as React.CSSProperties} />
              {[92, 86, 95, 60, 80].map((w, i) => (
                <span key={i} className={styles.line} style={{ "--w": `${w}%`, animationDelay: `${0.85 + i * 0.22}s` } as React.CSSProperties} />
              ))}
            </div>
          )}

          {output.kind === "images" &&
            Array.from({ length: fanCount }, (_, i) => {
              const mid = (fanCount - 1) / 2;
              return (
                <span
                  key={i}
                  className={styles.fanCard}
                  style={
                    {
                      background: FAN_COLORS[i % FAN_COLORS.length],
                      animationDelay: `${i * 0.18}s`,
                      zIndex: fanCount - Math.abs(i - mid),
                      "--dx": `${(i - mid) * (fanCount > 3 ? 16 : 24)}px`,
                      "--rot": `${(i - mid) * (fanCount > 3 ? 7 : 10)}deg`,
                    } as React.CSSProperties
                  }
                />
              );
            })}

          {output.kind === "profile" && (
            <div className={styles.textCard}>
              <div className={styles.avatarRow}>
                <span className={styles.avatar} />
                <span className={styles.line} style={{ "--w": "55%", animationDelay: "0s" } as React.CSSProperties} />
              </div>
              <span className={`${styles.line} ${styles.lineStrong}`} style={{ "--w": "90%", animationDelay: "0.3s" } as React.CSSProperties} />
              <span className={styles.line} style={{ "--w": "80%", animationDelay: "0.55s" } as React.CSSProperties} />
              <span className={styles.line} style={{ "--w": "62%", animationDelay: "0.8s" } as React.CSSProperties} />
              <div className={styles.subjectChips}>
                {["subject", "audience", "voice"].map((label, i) => (
                  <span key={label} className={styles.subjectChip} style={{ animationDelay: `${0.6 + i * 0.35}s` }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {output.kind === "series" &&
            [0, 1, 2].map((i) => (
              <span
                key={i}
                className={styles.seriesCard}
                style={{ top: i * 58, animationDelay: `${i * 0.35}s`, "--tint": FAN_COLORS[i % FAN_COLORS.length].match(/oklch\([^)]*\)/)?.[0] } as React.CSSProperties}
              >
                <span className={`${styles.seriesBar} ${styles.seriesBarStrong}`} style={{ "--w": `${78 - i * 12}%` } as React.CSSProperties} />
                <span className={styles.seriesBar} style={{ "--w": `${92 - i * 14}%` } as React.CSSProperties} />
              </span>
            ))}

          {output.kind === "plan" && (
            <div className={styles.textCard}>
              <div className={styles.avatarRow}>
                <span className={styles.avatar} />
                <span className={styles.line} style={{ "--w": "45%", animationDelay: "0s" } as React.CSSProperties} />
              </div>
              <div className={styles.planGrid}>
                {Array.from({ length: 28 }, (_, i) => {
                  const col = i % 7;
                  const row = Math.floor(i / 7);
                  const on = col === 0 || col === 2 || col === 4;
                  return (
                    <span
                      key={i}
                      className={`${styles.planCell} ${on ? styles.planCellOn : ""}`}
                      style={on ? { animationDelay: `${(row * 0.55 + col * 0.12).toFixed(2)}s` } : undefined}
                    />
                  );
                })}
              </div>
            </div>
          )}

          {output.kind === "animation" && (
            <div className={styles.motionCard}>
              <span className={styles.motionBlob} />
              <div className={styles.motionLines}>
                <span className={styles.motionLine} />
                <span className={styles.motionLine} />
                <span className={styles.motionLine} />
              </div>
              <span className={styles.motionProgress} />
            </div>
          )}
        </div>
      </div>
      <p key={step} className={styles.caption}>
        {captions[step]}
      </p>
    </div>
  );
}

/** The spinning core on its own, for small waits (a panel computing something). */
export function GenerationOrb({ size = 28 }: { size?: number }) {
  return (
    <span className={styles.orb} style={{ width: size, height: size, "--s": size / 112 } as React.CSSProperties} aria-hidden>
      <span className={styles.pot}>
        <span className={styles.ring} />
        <span className={styles.core} />
      </span>
    </span>
  );
}
