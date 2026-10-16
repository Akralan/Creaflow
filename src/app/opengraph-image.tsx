import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { SITE_NAME } from "@/lib/seo";

// Image d'aperçu quand on partage un lien du site (docs/SPEC_SEO.md §2) : Next la sert sur
// /opengraph-image et la relie dans og:image et twitter:image de toutes les pages. Générée une
// fois au build (aucune API de requête ici), à partir du même dessin que le favicon (icon0.svg)
// et des deux polices de la landing. Les .ttf vivent dans src/assets/fonts (licence OFL) parce que
// Satori ne lit ni les woff2 de next/font ni les polices du système.
export const alt = "CreaFlow — Vos notes de travail deviennent vos posts de la semaine";
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
          {/* eslint-disable-next-line @next/next/no-img-element -- Satori ne connaît pas next/image */}
          <img src={iconSrc} width={64} height={64} alt="" />
          <div style={{ fontFamily: "Bricolage Grotesque", fontWeight: 700, fontSize: 40, letterSpacing: "-0.02em" }}>{SITE_NAME}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 1000 }}>
          <div style={{ fontFamily: "Bricolage Grotesque", fontWeight: 700, fontSize: 70, lineHeight: 1.06, letterSpacing: "-0.03em" }}>
            Vos notes de travail deviennent vos posts de la semaine.
          </div>
          <div style={{ fontSize: 30, lineHeight: 1.35, color: "#574d45" }}>
            Rédacteur en chef IA pour indépendants, fondateurs et développeurs qui documentent déjà ce qu&apos;ils font.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 24, color: "#8a7f74" }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: "#6431c3" }} />
          Vous écrivez déjà. On fait le reste.
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
