"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, bg, text, ink } from "@/components/landing/theme";
import { pausePersonaRotation, usePersona } from "@/components/landing/usePersona";
import SourceIcon from "@/components/landing/SourceIcon";
import styles from "@/components/landing/landing.module.css";

/** Un bénéfice reste en avant CYCLE_MS, puis le suivant prend le relais (sauf survol). */
const CYCLE_MS = 4200;

/**
 * Les trois points, génériques : comment (rien à écrire), pourquoi (la régularité fait
 * l'audience), ce qu'on y gagne (des clients au lancement). Seuls les exemples des cartes
 * tournent avec le profil. Chaque carte du collage est rattachée à un point (son index).
 */
const outcomes: Array<{ title: string; description: string }> = [
  {
    title: "Rien à écrire",
    description: "CreaFlow lit ce que tu construis déjà (commits, notes, Notion) et rédige les posts à ta place.",
  },
  {
    title: "Tu publies chaque semaine",
    description: "C'est la régularité qui fait grandir une audience, pas un post viral. Toi, tu relis et tu valides.",
  },
  {
    title: "Le jour du lancement, des gens t'attendent",
    description: "Ceux qui t'ont suivi pendant que tu construisais deviennent tes premiers clients.",
  },
];

const dayIndex: Record<string, number> = { LUN: 0, MAR: 1, MER: 2, JEU: 3, VEN: 4, SAM: 5, DIM: 6 };
const days = ["L", "M", "M", "J", "V", "S", "D"];

const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";
function subscribeReducedMotion(onChange: () => void) {
  const mq = window.matchMedia(REDUCED_MOTION);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

const eyebrow: CSSProperties = {
  margin: 0,
  fontFamily: fontMono,
  fontSize: 10.5,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: text.faint,
};
const cardHead: CSSProperties = { display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10, marginBottom: 12 };
const cardTitle: CSSProperties = { fontFamily: fontHeading, fontWeight: 600, fontSize: 14.5, color: text.heading, letterSpacing: "-0.015em" };
const metaMono: CSSProperties = { fontFamily: fontMono, fontSize: 10.5, color: text.faint, letterSpacing: "0.06em", whiteSpace: "nowrap" };

const sourceLine: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "7px 9px",
  borderRadius: 9,
  background: bg.soft1,
  border: `1px solid ${ink(0.06)}`,
  fontSize: 11.5,
  lineHeight: 1.4,
  color: text.secondary,
};

const chipIcon = (background: string, color: string): CSSProperties => ({
  width: 20,
  height: 20,
  borderRadius: 7,
  background,
  color,
  display: "grid",
  placeItems: "center",
  fontFamily: fontMono,
  fontSize: 11,
  flexShrink: 0,
});

/** Variable CSS posée en inline (TypeScript ne connaît pas les propriétés custom). */
function cssVar(name: string, value: string): CSSProperties {
  return { [name]: value } as CSSProperties;
}

/** Courbe d'abonnés : points normalisés (0-100) tracés dans un viewBox 100 × 36. */
function Sparkline({ points }: { points: number[] }) {
  const step = 100 / (points.length - 1);
  const coords = points.map((p, i) => `${(i * step).toFixed(1)},${(34 - p * 0.32).toFixed(1)}`);
  return (
    <svg viewBox="0 0 100 36" preserveAspectRatio="none" style={{ display: "block", width: "100%", height: 52 }} aria-hidden="true">
      <polygon points={`0,36 ${coords.join(" ")} 100,36`} fill={accentAlpha(0.12)} />
      <polyline points={coords.join(" ")} fill="none" stroke={accent} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * « Ce que ça change » : le problème et sa réponse en un seul écran, juste après le hero.
 * Tu crées tes produits, CreaFlow crée ton audience. À gauche trois points courts (le plus en
 * avant se relaie tout seul, ou au survol) ; à droite un collage de cartes flottantes dont les
 * exemples tournent avec le profil, comme le hero.
 */
export default function LandingOutcomes() {
  const { persona, fadeClass } = usePersona();
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    () => window.matchMedia(REDUCED_MOTION).matches,
    () => false
  );
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reducedMotion) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % outcomes.length), CYCLE_MS);
    return () => window.clearInterval(timer);
    // `active` relance l'intervalle après un clic, pour que la barre de temps reparte de zéro
    // en même temps que le compte à rebours.
  }, [paused, reducedMotion, active]);

  const pause = (value: boolean) => {
    setPaused(value);
    pausePersonaRotation(value);
  };

  const plannedDays = new Set(persona.schedule.map((item) => dayIndex[item.meta.slice(0, 3)]).filter((d) => d !== undefined));
  const { proof, audience } = persona;

  return (
    <section
      id="ce-que-ca-change"
      data-screen-label="Bénéfices"
      style={{ position: "relative", scrollMarginTop: 64, overflow: "hidden" }}
      onMouseEnter={() => pause(true)}
      onMouseLeave={() => pause(false)}
    >
      <div
        data-parallax=""
        data-speed="0.16"
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "4vw",
          right: "-12vw",
          width: "44vw",
          height: "44vw",
          borderRadius: "50%",
          background: "radial-gradient(circle at 50% 50%, oklch(0.62 0.19 292 / 0.2), transparent 68%)",
          filter: "blur(32px)",
          pointerEvents: "none",
        }}
      />

      <div
        className={styles.outcomesGrid}
        style={{ position: "relative", maxWidth: 1160, margin: "0 auto", padding: "clamp(56px, 9vw, 120px) clamp(18px, 5vw, 44px)" }}
      >
        {/* Colonne texte : titre, une phrase, puis les trois points */}
        <div style={{ minWidth: 0 }}>
          <h2
            data-reveal=""
            style={{
              margin: 0,
              fontFamily: fontHeading,
              fontWeight: 700,
              fontSize: "clamp(2.2rem, 4.8vw, 3.8rem)",
              lineHeight: 1.0,
              letterSpacing: "-0.042em",
              color: text.heading,
              maxWidth: "14ch",
              textWrap: "balance",
            }}
          >
            Tu crées tes produits. <span style={{ color: accent }}>On crée ton audience.</span>
          </h2>
          <p
            data-reveal=""
            data-delay={80}
            style={{ margin: "20px 0 0", fontSize: "1.1rem", lineHeight: 1.55, color: text.secondary, maxWidth: "40ch", textWrap: "pretty" }}
          >
            Un bon produit sans audience ne se vend pas. CreaFlow transforme ce que tu construis déjà en posts, chaque
            semaine.
          </p>

          <ol className={styles.outcomeList} style={cssVar("--cycle", `${CYCLE_MS}ms`)}>
            {outcomes.map((item, i) => {
              const isActive = i === active;
              return (
                <li key={item.title} data-reveal="" data-delay={160 + i * 90}>
                  <button
                    type="button"
                    className={styles.outcomeItem}
                    data-active={isActive ? "true" : "false"}
                    data-paused={paused ? "true" : "false"}
                    aria-pressed={isActive}
                    onClick={() => setActive(i)}
                    onMouseEnter={() => setActive(i)}
                    onFocus={() => setActive(i)}
                  >
                    <span className={styles.outcomeBar} aria-hidden="true">
                      {/* La clé relance le remplissage à chaque changement de point. */}
                      {isActive && !reducedMotion && <span key={active} className={styles.outcomeFill} />}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: fontMono,
                        fontSize: 11,
                        color: isActive ? accentText : text.fainter,
                        letterSpacing: "0.12em",
                        marginBottom: 6,
                        transition: "color .4s ease",
                      }}
                    >
                      0{i + 1}
                    </span>
                    <span
                      style={{
                        display: "block",
                        fontFamily: fontHeading,
                        fontWeight: 600,
                        fontSize: "clamp(1.12rem, 1.6vw, 1.32rem)",
                        color: isActive ? text.heading : text.muted,
                        letterSpacing: "-0.024em",
                        lineHeight: 1.15,
                        textWrap: "balance",
                        transition: "color .4s ease",
                      }}
                    >
                      {item.title}
                    </span>
                    <span className={styles.outcomeDescription} data-active={isActive ? "true" : "false"}>
                      <span className={styles.outcomeDescriptionInner}>{item.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Collage de cartes flottantes, une par point */}
        <div data-reveal="" data-delay={120} className={styles.outcomeCollageOuter}>
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: "6% -4% -4% -4%",
              borderRadius: 48,
              background: `radial-gradient(ellipse at 50% 45%, ${accentAlpha(0.18)}, transparent 70%)`,
              filter: "blur(34px)",
              pointerEvents: "none",
            }}
          />
          <span className={styles.outcomeChip} style={{ top: -10, left: -22 }} aria-hidden="true">
            <span style={chipIcon(accentAlpha(0.14), accentText)}>✓</span>
            Tiré de ton travail, rien d&apos;inventé
          </span>
          <span className={styles.outcomeChip} style={{ bottom: -8, right: -14 }} aria-hidden="true">
            <span style={chipIcon("oklch(0.9 0.08 62)", "oklch(0.45 0.12 62)")}>0</span>
            ligne écrite par toi
          </span>

          <div className={`${styles.outcomeCollage} ${fadeClass}`} aria-hidden="true">
            {/* 01 : ton travail devient un post */}
            <div className={styles.outcomeBob} style={{ animationDuration: "6.2s" }}>
              <div className={styles.outcomeCard} data-active={active === 0} data-dim={active !== 0 && !reducedMotion} style={cssVar("--tilt", "-1.2deg")}>
                <p style={{ ...eyebrow, marginBottom: 10 }}>Ton travail</p>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}>
                  {proof.sources.map((source) => (
                    <div key={source.meta} style={sourceLine}>
                      <SourceIcon kind={source.kind} scale={0.8} style={{ color: text.faint, marginTop: 1 }} />
                      <span style={{ minWidth: 0 }}>{source.text}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "center", color: accent, fontFamily: fontMono, fontSize: 15, lineHeight: 1, margin: "8px 0" }}>↓</div>
                <div style={{ padding: "9px 11px", borderRadius: 10, background: accentAlpha(0.07), border: `1px solid ${accentAlpha(0.2)}`, display: "grid", gap: 4 }}>
                  <span style={{ fontFamily: fontMono, fontSize: 9.5, letterSpacing: "0.1em", color: accentText }}>{proof.postLabel}</span>
                  <span style={{ fontFamily: fontHeading, fontWeight: 600, fontSize: 13.5, lineHeight: 1.3, letterSpacing: "-0.015em", color: text.heading }}>
                    {proof.postHook}
                  </span>
                </div>
              </div>
            </div>

            {/* 02 : la semaine remplie */}
            <div className={`${styles.outcomeBob} ${styles.outcomeCol2}`} style={{ animationDuration: "7.1s", animationDelay: "-2.4s" }}>
              <div className={styles.outcomeCard} data-active={active === 1} data-dim={active !== 1 && !reducedMotion} style={cssVar("--tilt", "1.3deg")}>
                <div style={cardHead}>
                  <span style={cardTitle}>Cette semaine</span>
                  <span style={metaMono}>{persona.schedule.length} PRÊTS</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, marginBottom: 12 }}>
                  {days.map((d, i) => {
                    const planned = plannedDays.has(i);
                    return (
                      <div key={i} style={{ display: "grid", gap: 4, justifyItems: "center" }}>
                        <span style={{ fontFamily: fontMono, fontSize: 9.5, color: text.faint }}>{d}</span>
                        <span
                          style={{
                            width: "100%",
                            height: 20,
                            borderRadius: 6,
                            background: planned ? accentAlpha(0.2) : bg.soft1,
                            border: `1px solid ${planned ? accentAlpha(0.4) : ink(0.07)}`,
                            display: "grid",
                            placeItems: "center",
                          }}
                        >
                          {planned && <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />}
                        </span>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 5 }}>
                  {persona.schedule.map((item) => (
                    <div
                      key={item.title}
                      className={item.phoneHidden ? styles.hideOnPhone : undefined}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 9px",
                        borderRadius: 9,
                        background: bg.soft1,
                        border: `1px solid ${item.highlighted ? accentAlpha(0.3) : ink(0.06)}`,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: item.highlighted ? accent : text.fainter, flexShrink: 0 }} />
                      <span style={{ minWidth: 0, fontSize: 12, fontWeight: 600, color: text.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {item.title}
                      </span>
                      <span style={{ ...metaMono, marginLeft: "auto", fontSize: 9.5 }}>{item.meta.slice(0, 3)}</span>
                    </div>
                  ))}
                </div>
                <p style={{ margin: "12px 0 0", fontSize: 11.5, color: text.secondary, display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent, flexShrink: 0 }} />
                  Rien à écrire. Juste à relire.
                </p>
              </div>
            </div>

            {/* 03 : l'audience qui grandit, et ce qu'elle rapporte */}
            <div className={styles.outcomeBob} style={{ animationDuration: "6.7s", animationDelay: "-1.1s" }}>
              <div className={styles.outcomeCard} data-active={active === 2} data-dim={active !== 2 && !reducedMotion} style={cssVar("--tilt", "0.9deg")}>
                <div style={cardHead}>
                  <span style={cardTitle}>Ton audience</span>
                  <span style={{ ...metaMono, color: accentText }}>{audience.delta}</span>
                </div>
                <p style={{ margin: "0 0 4px", fontFamily: fontHeading, fontWeight: 700, fontSize: 24, letterSpacing: "-0.03em", lineHeight: 1, color: text.heading }}>
                  {audience.followers}
                  <span style={{ marginLeft: 6, fontFamily: fontMono, fontWeight: 400, fontSize: 10.5, letterSpacing: "0.06em", color: text.faint }}>ABONNÉS</span>
                </p>
                <Sparkline points={audience.curve} />
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginTop: 10,
                    padding: "8px 10px",
                    borderRadius: 10,
                    background: accentAlpha(0.08),
                    border: `1px solid ${accentAlpha(0.22)}`,
                  }}
                >
                  <span style={chipIcon(accent, "#fffdfa")}>€</span>
                  <span style={{ minWidth: 0, fontSize: 12, fontWeight: 600, color: text.body }}>{audience.signal}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
