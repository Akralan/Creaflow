/**
 * Temporary highlight of a menu entry, to show where to go next (e.g. the calendar
 * just filled after validating the series). Survives a reload for the length of the session,
 * goes out as soon as the page is opened. Client side only.
 */
const KEY = "creaflow.navHighlight";
export const NAV_HIGHLIGHT_EVENT = "creaflow:nav-highlight";

export function highlightNav(href: string) {
  try {
    sessionStorage.setItem(KEY, href);
  } catch {
    // Storage unavailable: the highlight will only apply to this page.
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
