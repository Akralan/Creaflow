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
 * - `data-stack-panel` : variables CSS de l'empilement des sections (voir plus bas).
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

      // Transition entre sections (cf. .stackPanel) : pour chaque panneau, `--cover` dit à
      // quel point le suivant le recouvre (0 → 1) et `--enter` la progression de sa propre
      // arrivée (0 : son haut touche le bas de la fenêtre, 1 : il est en place).
      // Un panneau plus court que la fenêtre (le dernier, typiquement) n'atteint jamais le
      // haut de l'écran : on mesure sa progression par rapport au point le plus haut qu'il
      // peut réellement atteindre en fin de page, pour qu'il arrive bien à 1.
      const vh = window.innerHeight;
      const remaining = Math.max(0, max - y);
      const panels = document.querySelectorAll<HTMLElement>("[data-stack-panel]");
      const enters: number[] = [];
      panels.forEach((el, i) => {
        // Un panneau plus haut que la fenêtre se colle par son bas, pas par son haut : on le
        // lit en entier en défilant, et le suivant ne le recouvre qu'une fois son bas atteint.
        const stickTop = Math.min(0, vh - el.offsetHeight);
        const stickTopPx = `${stickTop}px`;
        if (el.style.top !== stickTopPx) el.style.top = stickTopPx;

        if (i === 0) {
          enters.push(1);
          return;
        }
        const top = el.getBoundingClientRect().top;
        const finalTop = Math.max(0, top - remaining);
        const travel = Math.max(1, vh - finalTop);
        enters.push(Math.min(1, Math.max(0, (vh - top) / travel)));
      });
      panels.forEach((el, i) => {
        const enter = enters[i];
        // Le précédent reste net pendant toute la première moitié de l'arrivée du suivant,
        // puis s'estompe sur la seconde : un gros coup de molette ne tombe plus entre deux
        // pages floues.
        const next = i + 1 < enters.length ? enters[i + 1] : 0;
        const cover = Math.min(1, Math.max(0, (next - 0.5) / 0.5));
        el.style.setProperty("--enter", enter.toFixed(3));
        el.style.setProperty("--cover", cover.toFixed(3));
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
