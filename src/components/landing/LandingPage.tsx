import type { ReactNode } from "react";
import { bg, text } from "@/components/landing/theme";
import LandingScrollEffects from "@/components/landing/LandingScrollEffects";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
import LandingSources from "@/components/landing/LandingSources";
import LandingSocialProofSlot from "@/components/landing/LandingSocialProofSlot";
import LandingOutcomes from "@/components/landing/LandingOutcomes";
import LandingHowItWorks from "@/components/landing/LandingHowItWorks";
import LandingFeatures from "@/components/landing/LandingFeatures";
import { FEATURES_ENABLED } from "@/components/landing/flags";
import LandingOffer from "@/components/landing/LandingOffer";
import LandingFooter from "@/components/landing/LandingFooter";
import styles from "@/components/landing/landing.module.css";

type Variant = "rise" | "scale" | "slide" | "blur";
const variantClass: Record<Variant, string> = {
  rise: styles.variantRise,
  scale: styles.variantScale,
  slide: styles.variantSlide,
  blur: styles.variantBlur,
};

/**
 * Un panneau de la pile : collant en haut de la fenêtre. Quand le suivant arrive, celui-ci
 * s'estompe et se floute pendant que le suivant apparaît en fondu avec le mouvement de sa
 * `variant` (cf. .stackPanel dans landing.module.css et le bloc « transition » de
 * useScrollTick). `background` doit être opaque.
 */
function Panel({
  index,
  variant,
  background = bg.page,
  children,
}: {
  index: number;
  variant?: Variant;
  background?: string;
  children: ReactNode;
}) {
  return (
    <div data-stack-panel="" className={`${styles.stackPanel} ${variant ? variantClass[variant] : ""}`} style={{ zIndex: index + 1, background }}>
      <div className={styles.stackInner}>{children}</div>
    </div>
  );
}

/**
 * Landing recentrée sur la cible prioritaire de docs/PRODUCT.md §2.1 : indépendants,
 * fondateurs et développeurs qui ont déjà de la matière écrite. Une promesse, un CTA répété.
 *
 * Ordre des panneaux : le hero promet et montre, « Ce que ça change » pose le problème et sa
 * réponse en un seul écran (tu crées tes produits, on crée ton audience), « Comment ça marche »
 * explique, le CTA conclut. La grille de fonctionnalités est masquée (FEATURES_ENABLED).
 */
export default function LandingPage() {
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: bg.page, color: text.body }}>
      <LandingScrollEffects />
      <LandingHeader />
      <div className={styles.stack}>
        <Panel index={0}>
          <LandingHero />
          <LandingSources />
          {/* Témoignages / logos : masqué tant qu'il n'y a rien de réel à montrer. */}
          <LandingSocialProofSlot />
        </Panel>
        <Panel index={1} variant="slide">
          <LandingOutcomes />
        </Panel>
        <Panel index={2} variant="scale" background={bg.soft2}>
          <LandingHowItWorks />
        </Panel>
        {FEATURES_ENABLED && (
          /* Même mouvement d'arrivée que « Ce que ça change » : acceptable tant que ce panneau
             n'est affiché que pour comparaison. */
          <Panel index={3} variant="slide">
            <LandingFeatures />
          </Panel>
        )}
        <Panel index={4} variant="blur">
          {/* CTA final + tarifs (masqués pour l'instant, cf. PRICING_ENABLED). */}
          <LandingOffer />
          <LandingFooter />
        </Panel>
      </div>
    </div>
  );
}
