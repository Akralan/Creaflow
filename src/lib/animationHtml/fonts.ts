import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { PlayerFont } from "./player";

/**
 * The design fonts as files (src/assets/fonts/design, OFL license; downloaded by scripts/fetch-design-fonts.mjs),
 * embedded in each animation page: the iframe that plays it can load nothing from the network. Server only.
 */
const FILES: Array<{ family: string; file: string; weight: string }> = [
  { family: "Inter", file: "inter.woff2", weight: "100 900" },
  { family: "Space Grotesk", file: "space-grotesk.woff2", weight: "300 700" },
  { family: "Playfair Display", file: "playfair-display.woff2", weight: "400 900" },
  { family: "DM Serif Display", file: "dm-serif-display.woff2", weight: "400" },
  { family: "Caveat", file: "caveat.woff2", weight: "400 700" },
  { family: "JetBrains Mono", file: "jetbrains-mono.woff2", weight: "100 800" },
];

let cached: Promise<PlayerFont[]> | null = null;

export function loadPlayerFonts(): Promise<PlayerFont[]> {
  cached ??= Promise.all(
    FILES.map(async (f) => ({
      family: f.family,
      weight: f.weight,
      dataUri: `data:font/woff2;base64,${(await readFile(join(process.cwd(), "src/assets/fonts/design", f.file))).toString("base64")}`,
    }))
  ).catch((error) => {
    cached = null;
    throw error;
  });
  return cached;
}
