"use client";

import { useEffect } from "react";

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Hook partagé pour `data-reveal`/`data-delay` (apparition opacity 0→1 / translateY 28px→0 au
 * scroll) et `data-bar`/`data-w` (barres de la section Performance, même mécanisme de scan
 * IntersectionObserver que `data-reveal` dans le script source — `scan()`).
 *
 * Si l'utilisateur a demandé "prefers-reduced-motion: reduce", les animations sont désactivées :
 * le contenu et les barres s'affichent directement dans leur état final, sans transition.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (prefersReducedMotion()) {
      document.querySelectorAll<HTMLElement>("[data-reveal],[data-bar]").forEach((el) => {
        if (el.hasAttribute("data-bar")) {
          el.style.width = `${el.getAttribute("data-w") || "0"}%`;
        } else {
          el.style.opacity = "1";
          el.style.transform = "none";
        }
      });
      return;
    }

    let observer: IntersectionObserver | null = null;

    const scan = () => {
      if (!observer) {
        observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (!entry.isIntersecting) return;
              const el = entry.target as HTMLElement;
              const delay = parseInt(el.getAttribute("data-delay") || "0", 10);
              if (el.hasAttribute("data-bar")) {
                setTimeout(() => {
                  el.style.width = `${el.getAttribute("data-w") || "0"}%`;
                }, 180);
              } else {
                setTimeout(() => {
                  el.style.opacity = "1";
                  el.style.transform = "none";
                }, delay);
              }
              observer?.unobserve(el);
            });
          },
          { rootMargin: "0px 0px -12% 0px", threshold: 0.12 }
        );
      }

      document
        .querySelectorAll<HTMLElement>("[data-reveal]:not([data-armed]),[data-bar]:not([data-armed])")
        .forEach((el) => {
          el.setAttribute("data-armed", "");
          if (!el.hasAttribute("data-bar")) {
            const rect = el.getBoundingClientRect();
            const visible = rect.top < window.innerHeight * 0.9;
            el.style.transition = "opacity .8s cubic-bezier(.2,.75,.2,1), transform .8s cubic-bezier(.2,.75,.2,1)";
            if (!visible) {
              el.style.opacity = "0";
              el.style.transform = "translate3d(0,28px,0)";
            }
          }
          observer?.observe(el);
        });
    };

    scan();
    // Repasse le scan à quelques intervalles, comme le script source, pour armer les
    // éléments qui n'étaient pas encore montés lors du premier passage.
    const retries = [120, 500, 1400, 3000].map((ms) => setTimeout(scan, ms));

    return () => {
      retries.forEach(clearTimeout);
      observer?.disconnect();
      // Sans ça, React Strict Mode (dev only : monte -> nettoie -> remonte l'effet une fois,
      // sur le même DOM déjà présent) laisse `data-armed` posé par le 1er passage, donc le
      // scan() du 2e passage ne trouve plus aucun élément à observer (le sélecteur exclut
      // `[data-armed]`) — le nouvel observer reste vide pendant que l'ancien vient d'être
      // déconnecté : plus aucun élément ne se révèle jamais. On efface le marqueur au nettoyage
      // pour que le prochain scan() reparte sur une base propre, quelle que soit la cause du
      // démontage (Strict Mode ou navigation réelle).
      document.querySelectorAll<HTMLElement>("[data-armed]").forEach((el) => el.removeAttribute("data-armed"));
    };
  }, []);
}
