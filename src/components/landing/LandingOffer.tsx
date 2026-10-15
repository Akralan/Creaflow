"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import LandingCtaFinal from "@/components/landing/LandingCtaFinal";
import LandingPricing from "@/components/landing/LandingPricing";
import styles from "@/components/landing/landing.module.css";

/** Événement global émis par le lien « Tarifs » du header pour afficher la grille. */
export const OPEN_PRICING_EVENT = "cf-open-pricing";

/**
 * Tarifs masqués sur la landing pour l'instant (décision du 2026-10-15) : ils seront
 * présentés dans l'app. Passer à `true` réactive le bouton « Voir les tarifs », le lien
 * « Tarifs » du header, l'ancre #tarifs et le fondu vers la grille — rien d'autre à changer.
 */
export const PRICING_ENABLED = false;

type View = "cta" | "pricing";
const FADE_OUT_MS = 240;

/**
 * Section finale à deux faces : le CTA « Vos cinq premiers scripts vous attendent » par
 * défaut, remplacé en fondu par la grille de tarifs à la demande (bouton « Voir les tarifs »,
 * lien « Tarifs » du header, ou arrivée directe sur #tarifs). Un bouton « Retour » ramène au
 * CTA. Les deux ne sont jamais affichés ensemble : la landing reste courte.
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
      data-screen-label="Offre"
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
