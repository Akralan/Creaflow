"use client";

import { useEffect } from "react";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hook partagé pour tout ce que le script source calcule dans `tick()` à chaque frame de
 * scroll (throttlé via requestAnimationFrame) :
 * - `data-progress` : largeur de la barre de progression de scroll, en position fixed.
 * - `data-header` : bascule fond/bordure du header après ~12px de scroll.
 * - `data-parallax`/`data-speed` : translation verticale liée au scroll (désactivée si
 *   prefers-reduced-motion), formule exacte du script source.
 * - `data-step` : dans "Comment ça marche", l'étape active est celle dont le centre est le
 *   plus proche du centre de la fenêtre (logique `bestDist` exacte, désactivée si
 *   prefers-reduced-motion).
 */
export function useScrollTick() {
  useEffect(() => {
    const motionEnabled = !prefersReducedMotion();

    const tick = () => {
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      const y = window.scrollY || 0;

      const bar = document.querySelector<HTMLElement>("[data-progress]");
      if (bar) bar.style.width = `${Math.min(100, (y / max) * 100)}%`;

      const header = document.querySelector<HTMLElement>("[data-header]");
      if (header) {
        const on = y > 12;
        header.style.borderBottomColor = on ? "rgba(34,29,25,0.09)" : "rgba(34,29,25,0)";
        header.style.background = on ? "rgba(247,244,239,0.9)" : "rgba(247,244,239,0.72)";
      }

      if (!motionEnabled) return;

      document.querySelectorAll<HTMLElement>("[data-parallax]").forEach((el) => {
        const speed = parseFloat(el.getAttribute("data-speed") || "0.1");
        const rect = el.getBoundingClientRect();
        const centered = el.style.transform.indexOf("translateX(-50%)") === 0;
        const shift = (rect.top + rect.height / 2 - window.innerHeight / 2) * -speed;
        el.style.transform = `${centered ? "translateX(-50%) " : ""}translate3d(0,${shift.toFixed(1)}px,0)`;
      });

      const mid = window.innerHeight * 0.52;
      const steps = document.querySelectorAll<HTMLElement>("[data-step]");
      let best = -1;
      let bestDist = Infinity;
      steps.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        const d = Math.abs(rect.top + rect.height / 2 - mid);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      });
      steps.forEach((el, i) => {
        const on = i === best;
        el.style.opacity = on ? "1" : "0.55";
        el.style.transform = on ? "translate3d(0,0,0) scale(1)" : "translate3d(0,0,0) scale(0.985)";
        el.style.borderColor = on ? "oklch(0.55 0.2 292 / 0.42)" : "rgba(34,29,25,0.08)";
        el.style.boxShadow = on ? "0 26px 48px -38px oklch(0.55 0.2 292 / 0.85)" : "none";
      });
    };

    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        tick();
      });
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    tick();

    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);
}
