"use client";

import GenerationAnimation, { type GenerationOutput } from "@/components/GenerationAnimation";
import { color, fontHeading } from "@/lib/design/tokens";

/**
 * A wait that takes the view: title, then the generation scene. `fill` centers it in the window
 * (a page that is only waiting); without it, it sits in the flow of the screen that hosts it.
 */
export default function GenerationPanel({
  title,
  subtitle,
  output,
  providers,
  fill = false,
}: {
  title: string;
  subtitle?: string;
  output: GenerationOutput;
  /** Sources feeding the scene; defaults to the connected accounts of the profile. */
  providers?: string[];
  fill?: boolean;
}) {
  return (
    <div
      role="status"
      style={{ display: "grid", placeItems: "center", minHeight: fill ? "calc(100vh - 120px)" : undefined, padding: fill ? "32px 24px" : "8px 0" }}
    >
      <div style={{ width: "100%", maxWidth: 640 }}>
        <h2 style={{ fontFamily: fontHeading, fontWeight: 700, fontSize: 22, textAlign: "center", margin: "0 0 6px" }}>{title}</h2>
        {subtitle && <p style={{ textAlign: "center", margin: "0 0 18px", fontSize: 14, color: color.textMuted }}>{subtitle}</p>}
        <GenerationAnimation output={output} providers={providers} />
      </div>
    </div>
  );
}
