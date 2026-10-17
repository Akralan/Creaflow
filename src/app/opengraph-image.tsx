import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAME } from "@/lib/seo";

// Preview image when a link to the site is shared (docs/SPEC_SEO.md §2): Next serves it on
// /opengraph-image and wires it into og:image and twitter:image on every page. Generated once
// at build (no request API here), from the same drawing as the favicon (icon0.svg)
// and the landing's two fonts. The .ttf files live in src/assets/fonts (OFL license) because
// Satori reads neither next/font's woff2 files nor system fonts.
export const alt = "Buildloud — Your work notes become your posts for the week";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const [heading, body, icon] = await Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/BricolageGrotesque-Bold.ttf")),
    readFile(join(process.cwd(), "src/assets/fonts/InstrumentSans-Regular.ttf")),
    readFile(join(process.cwd(), "src/app/icon0.svg")),
  ]);
  const iconSrc = `data:image/svg+xml;base64,${icon.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "radial-gradient(120% 90% at 12% 8%, #ebe5fb 0%, #f7f4ef 55%)",
          color: "#1b1713",
          fontFamily: "Instrument Sans",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori doesn't know next/image */}
          <img src={iconSrc} width={64} height={64} alt="" />
          <div style={{ fontFamily: "Bricolage Grotesque", fontWeight: 700, fontSize: 40, letterSpacing: "-0.02em" }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1000 }}>
          <div style={{ fontFamily: "Bricolage Grotesque", fontWeight: 700, fontSize: 70, lineHeight: 1.06, letterSpacing: "-0.03em" }}>
            Your work notes become your posts for the week.
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.35, color: "#574d45" }}>
            An AI editor-in-chief for freelancers, founders and developers who already document what they do.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#8a7f74" }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#6431c3" }} />
          You already write. We do the rest.
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Bricolage Grotesque", data: heading, weight: 700, style: "normal" },
        { name: "Instrument Sans", data: body, weight: 400, style: "normal" },
      ],
    },
  );
}
