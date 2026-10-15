"use client";

import type { CSSProperties } from "react";
import Link from "next/link";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, accentAlpha, accentText, text } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import styles from "@/components/landing/landing.module.css";

const problems: Array<{ glyph: string; title: string; description: string; delay: number }> = [
  {
    glyph: "∅",
    title: "Le post du dimanche soir",
    description: "Vous savez qu'il faut publier. Devant l'écran, rien de ce que vous avez fait ne vous semble digne d'un post.",
    delay: 0,
  },
  {
    glyph: "1/10",
    title: "Un sprint, zéro post",
    description: "Une refonte, une décision difficile, un chiffre qui surprend : il y avait dix contenus dedans. Aucun n'est sorti.",
    delay: 90,
  },
  {
    glyph: "≈",
    title: "L'IA qui invente",
    description: "ChatGPT nourri d'une ligne de description n'a que deux options : rester générique, ou inventer des détails plausibles.",
    delay: 180,
  },
  {
    glyph: "↻",
    title: "Toujours les trois mêmes angles",
    description: "Sans mémoire de ce qui est déjà publié, on retombe sur les mêmes sujets, dans les mêmes formats.",
    delay: 270,
  },
];

const linkStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 15,
  fontWeight: 600,
  color: accentText,
  transition: "gap .25s ease",
};
const linkHover: CSSProperties = { gap: 12, color: accentText };

/**
 * Composition typographique, sans cartes : un grand titre, l'accroche en regard, puis les
 * quatre blocages posés comme un sommaire à filets. Volontairement différent des deux
 * sections suivantes (parcours en ligne, puis grille de fonctionnalités).
 */
export default function LandingProblem() {
  return (
    <section
      data-screen-label="Problème"
      style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(56px, 9vw, 120px) clamp(18px, 5vw, 44px)" }}
    >
      <div className={styles.problemHead}>
        <div>
          <p
            data-reveal=""
            style={{ margin: "0 0 14px", fontFamily: fontMono, fontSize: 12, letterSpacing: "0.14em", textTransform: "uppercase", color: text.faint }}
          >
            Le problème
          </p>
          <h2
            data-reveal=""
            data-delay={60}
            style={{
              margin: 0,
              fontFamily: fontHeading,
              fontWeight: 600,
              fontSize: "clamp(2rem, 4.6vw, 3.6rem)",
              lineHeight: 1.0,
              letterSpacing: "-0.04em",
              color: text.heading,
              maxWidth: "16ch",
              textWrap: "balance",
            }}
          >
            Vous documentez déjà tout. <span style={{ color: text.fainter }}>Rien n&apos;est jamais publié.</span>
          </h2>
        </div>
        <div className={styles.problemLead}>
          <p
            data-reveal=""
            data-delay={120}
            style={{ margin: 0, fontSize: "1.08rem", lineHeight: 1.6, color: text.secondary, maxWidth: "38ch", textWrap: "pretty" }}
          >
            Notes de projet, comptes rendus, décisions, chiffres : la matière est là, sur votre disque. Ce qui manque,
            c&apos;est le temps de la transformer en posts, et le réflexe.
          </p>
          <div data-reveal="" data-delay={180} style={{ marginTop: 18 }}>
            <Link href="#ce-que-ca-change" style={linkStyle} {...hoverHandlers(linkStyle, linkHover)}>
              Voir ce que ça change
              <span style={{ fontFamily: fontMono, fontSize: 14 }}>→</span>
            </Link>
          </div>
        </div>
      </div>

      <ol className={styles.problemList}>
        {problems.map((p, i) => (
          <li
            key={p.title}
            data-reveal=""
            data-delay={p.delay}
            // Sur téléphone, deux blocages suffisent à poser le problème.
            className={`${styles.problemItem} ${i >= 2 ? styles.hideOnPhone : ""}`}
          >
            <span
              style={{
                display: "inline-grid",
                placeItems: "center",
                minWidth: 44,
                height: 44,
                padding: "0 10px",
                borderRadius: 13,
                background: accentAlpha(0.1),
                color: accent,
                fontFamily: fontMono,
                fontSize: 15,
                fontWeight: 500,
                letterSpacing: "-0.02em",
                flexShrink: 0,
              }}
              aria-hidden="true"
            >
              {p.glyph}
            </span>
            <div style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontFamily: fontMono, fontSize: 11, color: text.fainter, letterSpacing: "0.12em", marginBottom: 6 }}>
                0{i + 1}
              </span>
              <p style={{ margin: "0 0 8px", fontFamily: fontHeading, fontWeight: 600, fontSize: "clamp(1.15rem, 1.7vw, 1.4rem)", color: text.heading, letterSpacing: "-0.024em", lineHeight: 1.15 }}>
                {p.title}
              </p>
              <p style={{ margin: 0, fontSize: "0.98rem", lineHeight: 1.6, color: text.secondary, textWrap: "pretty", maxWidth: "40ch" }}>{p.description}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
