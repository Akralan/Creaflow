"use client";

import { useEffect, useState } from "react";
import { accent, accentText, bg } from "@/components/landing/theme";
import { fontMono } from "@/lib/design/tokens";

/** Reproduit `this.angles` du script source, cycle toutes les 2600ms via setInterval. */
const angles = [
  "angle déjà utilisé — on change",
  "nouveau : le geste qui rate souvent",
  "nouveau : ce que personne ne voit",
  "nouveau : la question qu'on vous pose",
];

export default function AngleRotator() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % angles.length);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        background: bg.soft1,
        borderRadius: 10,
        padding: "9px 12px",
        minHeight: 40,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: accent, flexShrink: 0 }} />
      <span style={{ fontFamily: fontMono, fontSize: 11.5, color: accentText, letterSpacing: "0.02em" }}>
        {angles[index]}
      </span>
    </div>
  );
}
