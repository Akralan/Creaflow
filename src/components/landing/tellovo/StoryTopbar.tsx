"use client";

import Link from "next/link";
import { useNavDark } from "@/components/landing/tellovo/useNavDark";

export default function StoryTopbar() {
  const dark = useNavDark();
  return (
    <div className={dark ? "topbar dk" : "topbar"}>
      <header className="wrap nav">
        <Link className="home" aria-label="Tellovo — home" href="/">
          <span className="wm">
            tellovo<i aria-hidden="true"></i>
          </span>
        </Link>
        <Link className="back" href="/">
          <span aria-hidden="true">←</span> Back to Tellovo
        </Link>
      </header>
    </div>
  );
}
