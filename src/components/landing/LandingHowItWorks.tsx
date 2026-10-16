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

const days = ["L", "M", "M", "J", "V", "S", "D"];
const plannedDays = new Set([0, 2, 4]);

const steps: Array<{ title: string; description: string; visual: ReactNode }> = [
  {
    title: "Tu branches ce que tu as déjà",
    description:
      "GitHub, Notion ou Linear en un clic, ou tes notes collées. CreaFlow lit les fichiers, les pages, l'historique, les issues terminées. C'est ta matière, rien d'autre.",
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
    title: "Ta ligne éditoriale se dessine",
    description:
      "Deux ou trois questions : le ton, pour qui tu publies, le temps dont tu disposes. Le reste est déduit de ton profil et de tes sujets : séries récurrentes, rôles, rythme.",
    visual: (
      <div className={styles.howVisual} aria-hidden="true">
        <span style={questionChip}>Quel ton ?</span>
        <span style={questionChip}>Pour qui ?</span>
        <span style={questionChip}>Combien de temps ?</span>
      </div>
    ),
  },
  {
    title: "Tu relis, tu publies",
    description:
      "Chaque semaine, le calendrier se remplit de posts rédigés à partir de ce que tu as vraiment fait. Tu retouches une phrase si besoin, et c'est parti.",
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
 * Parcours en trois étapes : pastille numérotée centrée, contenu centré dessous, et sur
 * bureau une ligne pointillée de la première à la troisième pastille. Pas de cartes.
 */
export default function LandingHowItWorks() {
  return (
    <section
      id="comment-ca-marche"
      data-screen-label="Comment ça marche"
      style={{ scrollMarginTop: 64, borderTop: "1px solid rgba(34,29,25,0.07)", background: bg.soft2 }}
    >
      <div style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(52px, 8vw, 100px) clamp(18px, 5vw, 44px)" }}>
        <div style={{ textAlign: "center", marginBottom: "clamp(36px, 5vw, 64px)" }}>
          <p
            data-reveal=""
            style={{ margin: "0 0 12px", fontFamily: fontMono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: text.faint }}
          >
            Comment ça marche
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
            Dix minutes au départ, puis ça roule.
          </h2>
          <p
            data-reveal=""
            data-delay={120}
            style={{ margin: "14px auto 0", fontSize: "1.02rem", lineHeight: 1.6, color: text.secondary, maxWidth: "46ch", textWrap: "pretty" }}
          >
            Pas de brief à rédiger, pas de prompt à maîtriser. Tu continues à travailler, CreaFlow suit ce que tu
            documentes.
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
