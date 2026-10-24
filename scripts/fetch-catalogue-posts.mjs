/**
 * Récupère le texte complet des posts LinkedIn listés dans docs/CATALOGUE_POSTS_LINKEDIN.md.
 *
 * Les pages de post se lisent en invité : le texte est dans <p class="attributed-text-segment-list__content">
 * (et dans og:description). On lit le catalogue (auteur, médiane, type, réactions, lien), on télécharge
 * chaque post, on écrit docs/tests/posts-modeles/catalogue-textes.json. Reprenable : un lien déjà
 * récupéré n'est pas retéléchargé.
 *
 *   node scripts/fetch-catalogue-posts.mjs
 */
import fs from "node:fs";
import path from "node:path";

const CATALOGUE = path.join("docs", "CATALOGUE_POSTS_LINKEDIN.md");
const OUT_DIR = path.join("docs", "tests", "posts-modeles");
const OUT = path.join(OUT_DIR, "catalogue-textes.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

function decode(s) {
  return s
    .replace(/<br\s*\/?>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .trim();
}

function parseCatalogue(md) {
  const rows = [];
  let author = null;
  let median = null;
  for (const line of md.split("\n")) {
    const h = line.match(/^## (.+?) — /);
    if (h) {
      author = h[1].trim();
      median = null;
      continue;
    }
    const m = line.match(/médiane (\d+)/);
    if (m && line.startsWith("Profil")) median = Number(m[1]);
    if (!author || !line.startsWith("| ")) continue;
    const cells = line.split("|").map((c) => c.trim());
    // | Quand | Type | Réact. | Comm. | Média | Résumé | Lien |
    if (cells.length < 8 || cells[1] === "Quand" || cells[1].startsWith("---")) continue;
    const link = cells[7].match(/\((https?:[^)]+)\)/)?.[1];
    if (!link || !/feed\/update\/urn:li:(share|activity):\d+/.test(link)) continue;
    rows.push({
      author,
      median,
      when: cells[1],
      type: cells[2],
      reactions: cells[3] ? Number(cells[3]) : null,
      comments: cells[4] ? Number(cells[4]) : null,
      media: cells[5],
      summary: cells[6],
      url: link,
    });
  }
  return rows;
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "en-US,en;q=0.9" }, redirect: "follow" });
  const html = await res.text();
  if (res.status !== 200) return { status: res.status, text: null };
  const p = html.match(/<p[^>]*attributed-text-segment-list__content[^>]*>([\s\S]*?)<\/p>/);
  if (p) return { status: 200, text: decode(p[1]) };
  const og = html.match(/<meta property="og:description" content="([\s\S]*?)"\s*\/?>/);
  return { status: 200, text: og ? decode(og[1]) : null, partial: Boolean(og) };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const rows = parseCatalogue(fs.readFileSync(CATALOGUE, "utf8"));
  const done = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];
  const byUrl = new Map(done.map((d) => [d.url, d]));
  let fetched = 0;
  let failed = 0;
  for (const row of rows) {
    const prev = byUrl.get(row.url);
    if (prev && prev.text) continue;
    try {
      const { status, text, partial } = await fetchText(row.url);
      byUrl.set(row.url, { ...row, status, text, partial: partial ?? false });
      if (text) fetched += 1;
      else failed += 1;
      console.log(`${text ? "ok " : "-- "} ${row.author.split(" ")[0].padEnd(12)} ${row.type.padEnd(15)} ${String(row.reactions ?? "").padStart(4)}  ${row.summary.slice(0, 60)}`);
    } catch (err) {
      failed += 1;
      byUrl.set(row.url, { ...row, status: 0, text: null, error: String(err) });
      console.log(`!! ${row.url} ${String(err)}`);
    }
    fs.writeFileSync(OUT, JSON.stringify([...byUrl.values()], null, 2));
    await sleep(700);
  }
  const all = [...byUrl.values()];
  console.log(`\n${rows.length} liens dans le catalogue, ${all.filter((a) => a.text).length} textes récupérés (${fetched} nouveaux, ${failed} échecs ce run) → ${OUT}`);
}

await main();
