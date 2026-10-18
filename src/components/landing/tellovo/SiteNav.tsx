"use client";

import Link from "next/link";
import { useNavDark } from "@/components/landing/tellovo/useNavDark";
import { FocusHeroButton } from "@/components/landing/tellovo/HeroFocus";

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
          <FocusHeroButton className="btn btn-ink btn-sm">
            Generate my week
          </FocusHeroButton>
        </nav>
      </div>
    </header>
  );
}
