"use client";

import { useEffect, useState } from "react";

/** True while the sticky bar (72 px tall) sits over a [data-nav-dark] section. */
export function useNavDark(): boolean {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      let over = false;
      for (const el of document.querySelectorAll("[data-nav-dark]")) {
        const r = el.getBoundingClientRect();
        if (r.top <= 73 && r.bottom >= 73) {
          over = true;
          break;
        }
      }
      setDark(over);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);
  return dark;
}
