import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAME } from "@/lib/seo";

// Preview image when a link to the site is shared (docs/SPEC_SEO.md §2): Next serves it on
// /opengraph-image and wires it into og:image and twitter:image on every page. Generated once
// at build (no request API here), in the look of the landing: cream background, Geist, the
// hero headline with its accent underline. The font files live in src/assets/fonts (OFL license)
// because Satori reads neither next/font's woff2 files nor system fonts.
export const alt = "Tellovo — Just build. We grow your audience.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const ACCENT = "#6431c3"; // oklch(0.55 0.2 292), Satori does not read oklch
const INK = "#191a1d";

export default async function OpenGraphImage() {
  const [semibold, regular] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/Geist-600.woff")),
    readFile(join(process.cwd(), "src/assets/fonts/Geist-400.woff")),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "60px 72px",
          background: "#faf9f6",
          color: INK,
          fontFamily: "Geist",
        }}
      >
        <div style={{ display: "flex", alignItems: "baseline", fontWeight: 600, fontSize: 44, letterSpacing: "-0.06em" }}>
          {SITE_NAME.toLowerCase()}
          <div style={{ width: 10, height: 10, borderRadius: 5, background: ACCENT, marginLeft: 3 }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", fontWeight: 600, fontSize: 92, lineHeight: 1.02, letterSpacing: "-0.058em" }}>
            <div style={{ display: "flex" }}>Just build.</div>
            <div style={{ display: "flex" }}>
              <span style={{ display: "flex", flexShrink: 0, whiteSpace: "nowrap", marginRight: 24 }}>We grow</span>
              <span style={{ display: "flex", flexShrink: 0, whiteSpace: "nowrap", borderBottom: `7px solid ${ACCENT}`, paddingBottom: 2 }}>your audience.</span>
            </div>
          </div>
          <div style={{ display: "flex", fontSize: 27, lineHeight: 1.45, color: "#666a70", maxWidth: 940 }}>
            Turn your GitHub activity into a weekly content plan for X and LinkedIn — built around your SaaS, your future customers, and your voice.
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 24, color: "#666a70" }}>Build your SaaS. Don&apos;t build in silence.</div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Geist", data: semibold, weight: 600, style: "normal" },
        { name: "Geist", data: regular, weight: 400, style: "normal" },
      ],
    },
  );
}
