"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { prefersReducedMotion } from "@/components/landing/tellovo/util";

type HeroFocus = {
  fieldRef: RefObject<HTMLDivElement | null>;
  inputRef: RefObject<HTMLInputElement | null>;
  nudge: number;
  focusHero: () => void;
};

const HeroFocusContext = createContext<HeroFocus | null>(null);

export function useHeroFocus(): HeroFocus {
  const ctx = useContext(HeroFocusContext);
  if (!ctx) throw new Error("useHeroFocus must be used inside <HeroFocusProvider>");
  return ctx;
}

/** Every call to action brings the visitor back to the repository field: scroll, focus, nudge. */
export function FocusHeroButton({ className, children }: { className?: string; children: ReactNode }) {
  const { focusHero } = useHeroFocus();
  return (
    <button className={className} type="button" onClick={focusHero}>
      {children}
    </button>
  );
}

export function HeroFocusProvider({ children }: { children: ReactNode }) {
  const fieldRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const frame = useRef(0);
  const [nudge, setNudge] = useState(0);

  useEffect(() => () => cancelAnimationFrame(frame.current), []);

  const focusHero = useCallback(() => {
    const field = fieldRef.current;
    const done = () => {
      setNudge((n) => n + 1);
      inputRef.current?.focus({ preventScroll: true });
    };
    if (!field) return done();
    cancelAnimationFrame(frame.current);

    const viewport = window.innerHeight || document.documentElement.clientHeight;
    const rect = field.getBoundingClientRect();
    if (rect.top >= 72 && rect.bottom <= viewport) return done();

    field.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "center" });

    // Wait for the smooth scroll to settle before nudging the field.
    let last: number | null = null;
    let still = 0;
    let moved = false;
    const start = Date.now();
    const tick = () => {
      const top = field.getBoundingClientRect().top;
      if (last !== null) {
        if (Math.abs(top - last) < 0.5) still++;
        else {
          still = 0;
          moved = true;
        }
      }
      last = top;
      const elapsed = Date.now() - start;
      if ((still >= 4 && (moved || elapsed > 400)) || elapsed > 3000) done();
      else frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
  }, []);

  const value = useMemo(() => ({ fieldRef, inputRef, nudge, focusHero }), [nudge, focusHero]);
  return <HeroFocusContext value={value}>{children}</HeroFocusContext>;
}
