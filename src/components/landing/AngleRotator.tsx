"use client";

import { useEffect, useState } from "react";
import { accent, accentText, bg } from "@/components/landing/theme";
import { fontMono } from "@/lib/design/tokens";

/** Cycles every 2600ms: the anti-repetition rule forces a fresh angle on every generation. */
const angles = [
  "angle already used — switching",
  "new: the decision we regret",
  "new: the number that surprised us",
  "new: what we'd do differently",
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
