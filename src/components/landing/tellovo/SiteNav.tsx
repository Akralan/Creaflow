"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FocusHeroButton } from "@/components/landing/tellovo/HeroFocus";

/** The nav turns dark while it sits over a [data-nav-dark] section. */
function useNavDark(): boolean {
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

export default function SiteNav() {
  const dark = useNavDark();
  return (
    <header className={dark ? "nav dk" : "nav"}>
      <div className="wrap nav-in">
        <a className="home" href="#top" aria-label="Tellovo — home">
          <span className="wm">
            tellovo<i className="wm-dot"></i>
          </span>
        </a>
        <nav className="nav-r" aria-label="Primary">
          <Link className="signin" href="/login">
            Sign in
          </Link>
          <FocusHeroButton className="btn btn-ink btn-sm">Generate my week</FocusHeroButton>
        </nav>
      </div>
    </header>
  );
}
