"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LandingCtaFinal from "@/components/landing/LandingCtaFinal";
import LandingPricing from "@/components/landing/LandingPricing";
import styles from "@/components/landing/landing.module.css";

/** Global event fired by the header's "Pricing" link to show the pricing grid. */
export const OPEN_PRICING_EVENT = "cf-open-pricing";

/**
 * Pricing hidden on the landing for now (decision of 2026-10-15): it will be
 * presented in the app. Switching to `true` re-enables the "See pricing" button, the header's
 * "Pricing" link, the #tarifs anchor and the fade to the grid — nothing else to change.
 */
export const PRICING_ENABLED = false;

type View = "cta" | "pricing";
const FADE_OUT_MS = 240;

/**
 * Two-sided final section: the "Go back to building." CTA by
 * default, replaced with a fade by the pricing grid on demand ("See pricing" button,
 * the header's "Pricing" link, or landing directly on #tarifs). A "Back" button returns to the
 * CTA. The two are never shown together: the landing stays short.
 */
export default function LandingOffer() {
  const [view, setView] = useState<View>("cta");
  const [leaving, setLeaving] = useState(false);
  const viewRef = useRef<View>("cta");
  const timer = useRef<number | undefined>(undefined);
  const sectionRef = useRef<HTMLElement>(null);

  const show = useCallback((next: View) => {
    if (!PRICING_ENABLED || viewRef.current === next) return;
    viewRef.current = next;
    window.clearTimeout(timer.current);
    setLeaving(true);
    timer.current = window.setTimeout(() => {
      setView(next);
      setLeaving(false);
      if (next === "pricing") {
        sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, FADE_OUT_MS);
  }, []);

  useEffect(() => {
    if (!PRICING_ENABLED) return;
    const openFromHash = () => {
      if (window.location.hash === "#tarifs") show("pricing");
    };
    const openFromEvent = () => show("pricing");
    openFromHash();
    window.addEventListener("hashchange", openFromHash);
    window.addEventListener(OPEN_PRICING_EVENT, openFromEvent);
    return () => {
      window.removeEventListener("hashchange", openFromHash);
      window.removeEventListener(OPEN_PRICING_EVENT, openFromEvent);
      window.clearTimeout(timer.current);
    };
  }, [show]);

  return (
    <section
      id="tarifs"
      ref={sectionRef}
      data-screen-label="Offer"
      style={{ borderTop: "1px solid rgba(34,29,25,0.07)", scrollMarginTop: 64, overflow: "hidden" }}
    >
      <div key={view} className={leaving ? styles.fadeOut : styles.fadeIn}>
        {view === "cta" ? (
          <LandingCtaFinal onShowPricing={PRICING_ENABLED ? () => show("pricing") : undefined} />
        ) : (
          <LandingPricing onBack={() => show("cta")} />
        )}
      </div>
    </section>
  );
}
