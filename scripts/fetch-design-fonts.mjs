/**
 * Downloads the closed list of design fonts (src/lib/visualDesign/fonts.ts) as latin woff2 files into
 * src/assets/fonts/design/, once. The animations run in a sealed iframe that can load nothing from the network, so
 * the server embeds these files in each animation page (src/lib/animationHtml/fonts.ts).
 *
 *   node scripts/fetch-design-fonts.mjs
 */
import fs from "node:fs";
import path from "node:path";

const OUT = path.join(process.cwd(), "src", "assets", "fonts", "design");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36";

const FONTS = [
  { file: "inter.woff2", query: "Inter:wght@100..900" },
  { file: "space-grotesk.woff2", query: "Space+Grotesk:wght@300..700" },
  { file: "playfair-display.woff2", query: "Playfair+Display:wght@400..900" },
  { file: "dm-serif-display.woff2", query: "DM+Serif+Display" },
  { file: "caveat.woff2", query: "Caveat:wght@400..700" },
  { file: "jetbrains-mono.woff2", query: "JetBrains+Mono:wght@100..800" },
];

fs.mkdirSync(OUT, { recursive: true });
for (const font of FONTS) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${font.query}&display=swap`, { headers: { "User-Agent": UA } })).text();
  const latin = css.split("/* latin */")[1]?.split("}")[0] ?? "";
  const url = latin.match(/url\((https:[^)]+\.woff2)\)/)?.[1];
  if (!url) throw new Error(`No latin woff2 found for ${font.file}`);
  const bytes = Buffer.from(await (await fetch(url)).arrayBuffer());
  fs.writeFileSync(path.join(OUT, font.file), bytes);
  console.log(`${font.file}: ${Math.round(bytes.length / 1000)} KB`);
}
