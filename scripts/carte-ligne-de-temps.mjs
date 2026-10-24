/**
 * Place les posts d'un run sur la ligne de temps du projet.
 * Usage : node scripts/carte-ligne-de-temps.mjs <projet> [modele]
 */
import fs from "node:fs";
import path from "node:path";

const key = process.argv[2] ?? "creaflow";
const model = process.argv[3] ?? "gpt-6-luna";
const run = JSON.parse(fs.readFileSync(path.join("docs", "tests", "pointeurs", key, `run-${model}.json`), "utf8"));
const { timeline, posts } = run;
const byId = new Map(timeline.map((e) => [e.id, e]));

/** Quel(s) post(s) ont utilisé chaque pointeur. */
const usedBy = new Map();
for (const p of posts) for (const id of p.eventIds) usedBy.set(id, [...(usedBy.get(id) ?? []), p.n]);

// ---------- 1. La ligne de temps par mois, et où les posts tapent ----------
const buckets = new Map();
for (const e of timeline) {
  const k = e.date ? e.date.slice(0, 7) : "sans date";
  if (!buckets.has(k)) buckets.set(k, { total: 0, hits: [] });
  const b = buckets.get(k);
  b.total += 1;
  for (const n of usedBy.get(e.id) ?? []) b.hits.push(n);
}
const months = [...buckets.keys()].sort((a, b) => (a === "sans date" ? 1 : b === "sans date" ? -1 : a.localeCompare(b)));
const max = Math.max(...[...buckets.values()].map((b) => b.total));

console.log(`\n=== ${key.toUpperCase()} — ${timeline.length} pointeurs, ${posts.length} posts (${model}) ===\n`);
console.log("mois        pointeurs  posts qui y puisent");
for (const m of months) {
  const b = buckets.get(m);
  const bar = "█".repeat(Math.max(1, Math.round((b.total / max) * 28)));
  const hits = [...new Set(b.hits)].sort((x, y) => x - y);
  console.log(`${m.padEnd(11)} ${String(b.total).padStart(4)} ${bar.padEnd(29)} ${hits.length ? hits.map((n) => `p${n}`).join(" ") : "—"}`);
}

// ---------- 2. Post par post ----------
console.log("\npost  s   tours  read_file  read_post  pointeurs choisis");
for (const p of posts) {
  const refs = p.eventIds.map((id) => {
    const e = byId.get(id);
    return e ? `${e.date ?? "no date"} ${e.file}:${e.line}` : `${id}?`;
  });
  console.log(
    `p${String(p.n).padEnd(3)} ${String(p.seconds).padStart(3)} ${String(p.turns).padStart(5)} ${String(p.reads).padStart(9)} ${String(p.postsRead).padStart(10)}  ${refs.length === 0 ? "AUCUN" : refs[0]}`
  );
  for (const r of refs.slice(1)) console.log(`${" ".repeat(37)}${r}`);
}

// ---------- 3. Répétitions et épuisement ----------
const repeats = [...usedBy.entries()].filter(([, ns]) => ns.length > 1);
console.log(`\npointeurs utilisés : ${usedBy.size} sur ${timeline.length}`);
console.log(`pointeurs repris par plusieurs posts : ${repeats.length}`);
for (const [id, ns] of repeats) {
  const e = byId.get(id);
  console.log(`  ${e.date ?? "no date"} ${e.file}:${e.line} → posts ${ns.map((n) => `p${n}`).join(", ")}`);
}
const files = new Map();
for (const id of usedBy.keys()) {
  const f = byId.get(id).file;
  files.set(f, (files.get(f) ?? 0) + 1);
}
console.log("\ndocuments où les posts ont puisé :");
for (const [f, n] of [...files.entries()].sort((a, b) => b[1] - a[1])) {
  const inTimeline = timeline.filter((e) => e.file === f).length;
  console.log(`  ${f} — ${n} pointeurs utilisés sur ${inTimeline} disponibles`);
}
const neverTouched = [...new Set(timeline.map((e) => e.file))].filter((f) => !files.has(f));
console.log(`\ndocuments jamais touchés : ${neverTouched.length} sur ${new Set(timeline.map((e) => e.file)).size}`);
