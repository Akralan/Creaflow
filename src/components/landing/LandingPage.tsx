import type { ReactNode } from "react";
import { bg, text } from "@/components/landing/theme";
import LandingScrollEffects from "@/components/landing/LandingScrollEffects";
import LandingHeader from "@/components/landing/LandingHeader";
import LandingHero from "@/components/landing/LandingHero";
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
 * A panel of the stack: sticky at the top of the window. When the next one arrives, this one
 * fades and blurs while the next fades in with the motion of its
 * `variant` (see .stackPanel in landing.module.css and the "transition" block of
 * useScrollTick). `background` must be opaque.
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
 * Landing refocused on the priority target of docs/PRODUCT.md §2.1: freelancers,
 * founders and developers who already have written material. One promise, one repeated CTA.
 *
 * Panel order: the hero promises and shows, "What changes" lays out the problem and its
 * answer on a single screen (you build your products, we build your audience), "How it works"
 * explains, the CTA concludes. The feature grid is hidden (FEATURES_ENABLED).
 */
export default function LandingPage() {
  return (
    <div style={{ position: "relative", minHeight: "100vh", background: bg.page, color: text.body }}>
      <LandingScrollEffects />
      <LandingHeader />
      <div className={styles.stack}>
        <Panel index={0}>
          <LandingHero />
          {/* Testimonials / logos: hidden until there is something real to show. */}
          <LandingSocialProofSlot />
        </Panel>
        <Panel index={1} variant="slide">
          <LandingOutcomes />
        </Panel>
        <Panel index={2} variant="scale" background={bg.soft2}>
          <LandingHowItWorks />
        </Panel>
        {FEATURES_ENABLED && (
          /* Same entrance motion as "What changes": acceptable as long as this panel
             is only shown for comparison. */
          <Panel index={3} variant="slide">
            <LandingFeatures />
          </Panel>
        )}
        <Panel index={4} variant="blur">
          {/* Final CTA + pricing (hidden for now, see PRICING_ENABLED). */}
          <LandingOffer />
          <LandingFooter />
        </Panel>
      </div>
    </div>
  );
}
