"use client";

import { useEffect, useState, useSyncExternalStore, type CSSProperties } from "react";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, bg, text, ink } from "@/components/landing/theme";
import { pausePersonaRotation, usePersona } from "@/components/landing/usePersona";
import styles from "@/components/landing/landing.module.css";

/** Un bénéfice reste en avant CYCLE_MS, puis le suivant prend le relais (sauf survol). */
const CYCLE_MS = 4200;

/**
 * Les trois bénéfices, génériques comme les titres des autres sections : seuls les exemples
 * des cartes tournent avec le profil. Chaque carte du collage est rattachée à un bénéfice
 * (son index) et s'allume quand il est en avant.
 */
const outcomes: Array<{ title: string; description: string }> = [
  {
    title: "Vous publiez chaque semaine sans y penser",
    description:
      "Le calendrier se remplit à partir de ce que vous avez vraiment fait. Votre seule tâche : relire, et retoucher une phrase si besoin.",
  },
  {
    title: "Des posts qu'on reconnaît comme les vôtres",
    description:
      "Vos faits, vos mots, vos tournures. Chaque correction devient une règle que CreaFlow respecte ensuite partout où il écrit. Rien d'inventé, rien de générique.",
  },
  {
    title: "Le bon format, et ce qui marche oriente la suite",
    description:
      "La même décision devient un post LinkedIn, un script TikTok, un carrousel. Les réactions remontent, CreaFlow propose d'ajuster votre ligne, vous validez.",
  },
];

const dayIndex: Record<string, number> = { LUN: 0, MAR: 1, MER: 2, JEU: 3, VEN: 4, SAM: 5, DIM: 6 };
const days = ["L", "M", "M", "J", "V", "S", "D"];
const barColors = [accent, "oklch(0.62 0.16 292)", "oklch(0.72 0.11 292)"];

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

const formatTag = (strong: boolean): CSSProperties => ({
  display: "inline-flex",
  alignItems: "center",
  padding: "4px 8px",
  borderRadius: 7,
  background: strong ? accentAlpha(0.12) : bg.soft1,
  border: `1px solid ${strong ? accentAlpha(0.3) : ink(0.07)}`,
  fontSize: 11,
  fontWeight: 600,
  color: strong ? accentText : text.secondary,
  whiteSpace: "nowrap",
  flexShrink: 0,
});

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

/**
 * « Ce que ça change pour vous » : la réponse au Problème, juste après lui. À gauche les trois
 * bénéfices (le plus en avant se relaie tout seul, ou au survol) ; à droite un collage de
 * cartes flottantes tirées de l'app, dont les exemples tournent avec le profil, comme le hero.
 * Volontairement la section la plus visuelle de la page, en contraste avec le Problème.
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
  const { style, formats, series, proposal } = persona.outcomes;

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
        {/* Colonne texte : titre, accroche, puis les trois bénéfices */}
        <div style={{ minWidth: 0 }}>
          <p
            data-reveal=""
            style={{ margin: "0 0 14px", fontFamily: fontMono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: text.faint }}
          >
            Ce que ça change
          </p>
          <h2
            data-reveal=""
            data-delay={60}
            style={{
              margin: 0,
              fontFamily: fontHeading,
              fontWeight: 600,
              fontSize: "clamp(2rem, 4.2vw, 3.3rem)",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              color: text.heading,
              maxWidth: "15ch",
              textWrap: "balance",
            }}
          >
            Vous travaillez comme avant. <span style={{ color: accent }}>Vos posts sortent quand même.</span>
          </h2>
          <p
            data-reveal=""
            data-delay={120}
            style={{ margin: "18px 0 0", fontSize: "1.06rem", lineHeight: 1.6, color: text.secondary, maxWidth: "42ch", textWrap: "pretty" }}
          >
            Pas de rituel d&apos;écriture à tenir, pas de prompt à peaufiner. Ce qui change, c&apos;est ce qui arrive à
            votre audience : des posts réguliers, qui vous ressemblent, dans le format de chaque plateforme. C&apos;est
            comme ça qu&apos;une audience se construit.
          </p>

          <ol className={styles.outcomeList} style={cssVar("--cycle", `${CYCLE_MS}ms`)}>
            {outcomes.map((item, i) => {
              const isActive = i === active;
              return (
                <li key={item.title} data-reveal="" data-delay={180 + i * 90}>
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
                      {/* La clé relance le remplissage à chaque changement de bénéfice. */}
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

        {/* Collage de cartes flottantes, tirées de l'app */}
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
            Tiré de vos notes, rien d&apos;inventé
          </span>
          <span className={styles.outcomeChip} style={{ bottom: -8, right: -14 }} aria-hidden="true">
            <span style={chipIcon("oklch(0.9 0.08 62)", "oklch(0.45 0.12 62)")}>0</span>
            angle répété cette semaine
          </span>

          <div className={`${styles.outcomeCollage} ${fadeClass}`} aria-hidden="true">
            {/* 01 : la semaine remplie */}
            <div className={styles.outcomeBob} style={{ animationDuration: "6.2s" }}>
              <div className={styles.outcomeCard} data-active={active === 0} data-dim={active !== 0 && !reducedMotion} style={cssVar("--tilt", "-1.2deg")}>
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

            {/* 02 : votre style, appris de vos corrections */}
            <div className={`${styles.outcomeBob} ${styles.outcomeCol2}`} style={{ animationDuration: "7.1s", animationDelay: "-2.4s" }}>
              <div className={styles.outcomeCard} data-active={active === 1} data-dim={active !== 1 && !reducedMotion} style={cssVar("--tilt", "1.3deg")}>
                <p style={{ ...eyebrow, marginBottom: 10 }}>Votre style, appris de vos corrections</p>
                <p style={{ margin: "0 0 6px", fontSize: 12, lineHeight: 1.45, color: text.fainter, textDecoration: "line-through", textDecorationColor: ink(0.3) }}>
                  {style.before}
                </p>
                <p style={{ margin: "0 0 12px", fontFamily: fontHeading, fontWeight: 600, fontSize: 14, lineHeight: 1.28, letterSpacing: "-0.015em", color: text.heading }}>
                  {style.after}
                </p>
                <div style={{ padding: "9px 11px", borderRadius: 10, background: accentAlpha(0.07), border: `1px solid ${accentAlpha(0.18)}`, display: "grid", gap: 5 }}>
                  <span style={{ fontFamily: fontMono, fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: accentText }}>Règle apprise</span>
                  <span style={{ fontSize: 12, lineHeight: 1.45, color: text.body }}>{style.rule}</span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontFamily: fontMono, fontSize: 10, color: accentText }}>
                    <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent }} />
                    appliquée à {style.applied} posts
                  </span>
                </div>
              </div>
            </div>

            {/* 03 : ce qui marche guide la suite (bureau seulement) */}
            <div className={`${styles.outcomeBob} ${styles.hideOnPhone}`} style={{ animationDuration: "6.7s", animationDelay: "-1.1s" }}>
              <div className={styles.outcomeCard} data-active={active === 2} data-dim={active !== 2 && !reducedMotion} style={cssVar("--tilt", "0.9deg")}>
                <div style={cardHead}>
                  <span style={cardTitle}>Ce qui marche</span>
                  <span style={metaMono}>30 JOURS</span>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 8 }}>
                  {series.map((bar, i) => (
                    <div key={bar.label} style={{ display: "grid", gridTemplateColumns: "60px minmax(0, 1fr)", alignItems: "center", gap: 9 }}>
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: text.body, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bar.label}</span>
                      <span style={{ height: 7, borderRadius: 999, background: bg.track, overflow: "hidden" }}>
                        <span
                          style={{
                            display: "block",
                            height: "100%",
                            width: `${bar.width}%`,
                            borderRadius: 999,
                            background: barColors[i % barColors.length],
                            transition: "width .6s cubic-bezier(.2,.75,.2,1)",
                          }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${ink(0.07)}` }}>
                  <span style={{ fontSize: 11.5, color: text.secondary, minWidth: 0 }}>Proposition : {proposal}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "5px 10px", borderRadius: 8, background: accent, color: "#fffdfa", whiteSpace: "nowrap", flexShrink: 0 }}>
                    Valider
                  </span>
                </div>
              </div>
            </div>

            {/* 03 : une décision, trois formats */}
            <div className={`${styles.outcomeBob} ${styles.outcomeCol2}`} style={{ animationDuration: "7.6s", animationDelay: "-3.6s" }}>
              <div className={styles.outcomeCard} data-active={active === 2} data-dim={active !== 2 && !reducedMotion} style={cssVar("--tilt", "-0.8deg")}>
                <p style={{ ...eyebrow, marginBottom: 10 }}>Une décision, trois formats</p>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 6 }}>
                  {formats.map((f, i) => (
                    <div
                      key={f.platform}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "auto minmax(0, 1fr)",
                        alignItems: "center",
                        gap: 9,
                        padding: "7px 9px",
                        borderRadius: 9,
                        background: i === 0 ? bg.card : bg.soft1,
                        border: `1px solid ${i === 0 ? accentAlpha(0.22) : ink(0.06)}`,
                      }}
                    >
                      <span style={formatTag(i === 0)}>
                        {f.platform} · {f.kind}
                      </span>
                      <span
                        style={{
                          minWidth: 0,
                          fontSize: 11.5,
                          lineHeight: 1.35,
                          color: i === 0 ? text.body : text.secondary,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {f.excerpt}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
