/**
 * Mise en lumière passagère d'une entrée du menu, pour montrer où aller ensuite (ex. le calendrier
 * juste rempli après la validation des séries). Survit à un rechargement le temps de la session,
 * s'éteint dès que la page est ouverte. Côté client uniquement.
 */
const KEY = "creaflow.navHighlight";
export const NAV_HIGHLIGHT_EVENT = "creaflow:nav-highlight";

export function highlightNav(href: string) {
  try {
    sessionStorage.setItem(KEY, href);
  } catch {
    // Stockage indisponible : la mise en lumière vaudra pour cette page seulement.
  }
  window.dispatchEvent(new CustomEvent(NAV_HIGHLIGHT_EVENT, { detail: href }));
}

export function readNavHighlight(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function clearNavHighlight() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(NAV_HIGHLIGHT_EVENT, { detail: null }));
}
