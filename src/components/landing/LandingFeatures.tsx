"use client";

import type { CSSProperties } from "react";
import { fontHeading, fontMono } from "@/lib/design/tokens";
import { accent, bg, text, ink } from "@/components/landing/theme";
import { hoverHandlers } from "@/components/landing/hoverStyle";
import AngleRotator from "@/components/landing/AngleRotator";

const cardBase: CSSProperties = {
  background: bg.card,
  border: `1px solid ${ink(0.08)}`,
  borderRadius: 18,
  padding: "clamp(22px, 2.6vw, 30px)",
  transition: "transform .35s cubic-bezier(.2,.75,.2,1), box-shadow .35s ease",
};
const cardHover: CSSProperties = { transform: "translateY(-4px)", boxShadow: `0 20px 38px -30px ${ink(0.5)}` };

const eyebrow: CSSProperties = { fontFamily: fontMono, fontSize: 12, color: accent, letterSpacing: "0.08em" };
const cardTitle: CSSProperties = {
  margin: "10px 0 10px",
  fontFamily: fontHeading,
  fontWeight: 600,
  fontSize: "1.24rem",
  lineHeight: 1.18,
  letterSpacing: "-0.022em",
  color: text.heading,
};
const cardDescription: CSSProperties = { margin: 0, fontSize: "0.98rem", lineHeight: 1.6, color: text.secondary, textWrap: "pretty" };

const bubbleFromCreaflow: CSSProperties = {
  justifySelf: "start",
  maxWidth: "88%",
  background: bg.soft1,
  borderRadius: "14px 14px 14px 4px",
  padding: "12px 15px",
  fontSize: 13.5,
  lineHeight: 1.5,
  color: text.secondary,
};
const bubbleFromUser: CSSProperties = {
  justifySelf: "end",
  maxWidth: "88%",
  background: accent,
  color: "#fffdfa",
  borderRadius: "14px 14px 4px 14px",
  padding: "12px 15px",
  fontSize: 13.5,
  lineHeight: 1.5,
};

export default function LandingFeatures() {
  return (
    <section
      id="fonctionnalites"
      data-screen-label="Fonctionnalités"
      style={{ maxWidth: 1160, margin: "0 auto", padding: "clamp(64px, 9vw, 116px) clamp(18px, 5vw, 44px)" }}
    >
      <p
        data-reveal=""
        style={{
          margin: "0 0 12px",
          fontFamily: fontMono,
          fontSize: 12,
          letterSpacing: "0.14em",
          textTransform: "uppercase",
          color: text.faint,
        }}
      >
        Ce que fait CreaFlow
      </p>
      <h2
        data-reveal=""
        data-delay={60}
        style={{
          margin: "0 0 clamp(32px, 4.5vw, 54px)",
          fontFamily: fontHeading,
          fontWeight: 600,
          fontSize: "clamp(1.85rem, 3.8vw, 2.9rem)",
          lineHeight: 1.06,
          letterSpacing: "-0.034em",
          color: text.heading,
          maxWidth: "22ch",
          textWrap: "balance",
        }}
      >
        Cinq choses de moins à gérer chaque semaine
      </h2>

      <div style={{ display: "grid", gap: "clamp(14px, 1.8vw, 20px)", gridTemplateColumns: "repeat(auto-fit, minmax(258px, 1fr))" }}>
        <article
          data-reveal=""
          style={{
            gridColumn: "1 / -1",
            background: bg.card,
            border: `1px solid ${ink(0.08)}`,
            borderRadius: 22,
            padding: "clamp(24px, 3.4vw, 42px)",
            boxShadow: `0 1px 2px ${ink(0.035)}, 0 26px 50px -40px ${ink(0.4)}`,
            display: "grid",
            gap: "clamp(22px, 3vw, 46px)",
            gridTemplateColumns: "repeat(auto-fit, minmax(272px, 1fr))",
            alignItems: "center",
          }}
        >
          <div>
            <span style={eyebrow}>01</span>
            <h3
              style={{
                margin: "10px 0 12px",
                fontFamily: fontHeading,
                fontWeight: 600,
                fontSize: "clamp(1.35rem, 2.2vw, 1.8rem)",
                lineHeight: 1.12,
                letterSpacing: "-0.026em",
                color: text.heading,
              }}
            >
              Une conversation, pas un formulaire
            </h3>
            <p style={{ margin: 0, fontSize: "1rem", lineHeight: 1.62, color: text.secondary, maxWidth: "44ch", textWrap: "pretty" }}>
              Vous racontez ce que vous faites et ce qui vous ressemble. CreaFlow en déduit votre marque et propose
              une direction éditoriale sur mesure : catégories, angles récurrents, séries à décliner.
            </p>
          </div>
          <div style={{ display: "grid", gap: 10 }}>
            <div style={bubbleFromCreaflow}>Racontez-moi ce que vous fabriquez, et à qui ça fait plaisir.</div>
            <div style={bubbleFromUser}>
              Des bougies coulées à la main, surtout pour des cadeaux. Je n&apos;ai pas le temps de filmer.
            </div>
            <div style={{ ...bubbleFromCreaflow, maxWidth: "92%" }}>
              Alors partons sur trois piliers : les coulisses de l&apos;atelier, les idées cadeaux, et vos clients
              qui offrent. Je vous prépare la première série.
            </div>
          </div>
        </article>

        <article data-reveal="" data-delay={60} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>02</span>
          <h3 style={cardTitle}>Des scripts prêts à filmer</h3>
          <p style={cardDescription}>
            Accroche, déroulé plan par plan, légende et hashtags — au format et aux codes de chaque plateforme.
          </p>
        </article>

        <article data-reveal="" data-delay={120} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>03</span>
          <h3 style={cardTitle}>Jamais deux fois la même idée</h3>
          <p style={{ ...cardDescription, marginBottom: 14 }}>
            CreaFlow se souvient de tout ce que vous avez publié et s&apos;impose un angle neuf à chaque génération.
          </p>
          <AngleRotator />
        </article>

        <article data-reveal="" data-delay={180} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>04</span>
          <h3 style={cardTitle}>Un calendrier qui se remplit seul</h3>
          <p style={cardDescription}>
            Vous dites combien de fois par semaine, sur quelle plateforme. Le planning se construit autour de ce
            rythme.
          </p>
        </article>

        <article data-reveal="" data-delay={240} style={cardBase} {...hoverHandlers(cardBase, cardHover)}>
          <span style={eyebrow}>05</span>
          <h3 style={cardTitle}>Vos visuels au même endroit</h3>
          <p style={cardDescription}>
            Une bibliothèque où retrouver les visuels de votre marque — et en générer de nouveaux quand une image
            manque.
          </p>
        </article>
      </div>
    </section>
  );
}
