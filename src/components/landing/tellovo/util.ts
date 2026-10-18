/** Mobile and tablet width: below it the walkthrough no longer advances by itself, scroll drives it. */
export function isMobile(): boolean {
  return 900 >= (window.innerWidth || 1024);
}

export function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}
