"use client";

import { accent } from "@/components/landing/theme";
import { useScrollReveal } from "@/components/landing/useScrollReveal";
import { useScrollTick } from "@/components/landing/useScrollTick";

/**
 * Monte une seule fois les hooks d'animation au scroll (data-reveal/data-bar via
 * useScrollReveal, data-progress/data-header/data-parallax/data-step via useScrollTick) et
 * rend la barre de progression de scroll (`data-progress`) en position fixed, tout en haut de
 * la page — cf. script source (`tick()`).
 */
export default function LandingScrollEffects() {
  useScrollReveal();
  useScrollTick();

  return (
    <div
      data-progress=""
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        height: 2,
        width: "0%",
        background: accent,
        zIndex: 60,
      }}
    />
  );
}
