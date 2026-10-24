/**
 * Écrit un markdown lisible des posts d'un ou plusieurs runs du banc.
 * Usage : node scripts/export-posts.mjs <projet> <sortie.md> <label:fichier.json> [label:fichier.json …]
 * Exemple :
 *   node scripts/export-posts.mjs creaflow docs/tests/pointeurs/creaflow/comparaison.md \
 *     "A — aucune règle de forme:run-A-sans-phrase-forme.json" \
 *     "B — variation de forme:run-B-phrase-forme.json"
 */
import fs from "node:fs";
import path from "node:path";

const [projet, sortie, ...specs] = process.argv.slice(2);
if (!projet || !sortie || specs.length === 0) {
  console.error("Usage : node scripts/export-posts.mjs <projet> <sortie.md> <label:fichier.json> …");
  process.exit(1);
}
const dir = path.join("docs", "tests", "pointeurs", projet);
const out = [];

for (const [i, spec] of specs.entries()) {
  const sep = spec.lastIndexOf(":");
  const label = spec.slice(0, sep);
  const file = spec.slice(sep + 1);
  const run = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
  const byId = new Map(run.timeline.map((e) => [e.id, e]));
  const paras = run.posts.map((p) => p.text.split(/\n\s*\n/).filter(Boolean).length);
  const lens = run.posts.map((p) => p.text.length);
  const usedBy = new Map();
  for (const p of run.posts) for (const id of p.eventIds) usedBy.set(id, [...(usedBy.get(id) ?? []), p.n]);
  const repeats = [...usedBy.values()].filter((ns) => ns.length > 1).length;

  if (i === 0) {
    out.push(
      `# ${projet} — posts du banc pointeurs`,
      "",
      `Modèle : gpt-6-luna. Ligne de temps : ${run.timeline.length} pointeurs, ${run.timeline.filter((e) => e.date).length} datés.`,
      "Le rédacteur choisit lui-même ses pointeurs ; il reçoit la liste des posts précédents et peut les relire.",
      ""
    );
  }
  out.push(
    "---",
    "",
    `# ${label}`,
    "",
    `${run.posts.length} posts · paragraphes : ${paras.join(", ")} · longueur moyenne ${Math.round(lens.reduce((a, b) => a + b, 0) / lens.length)} caractères (${Math.min(...lens)}–${Math.max(...lens)}) · ${usedBy.size} pointeurs utilisés, ${repeats} repris par deux posts`,
    ""
  );
  for (const p of run.posts) {
    const refs = p.eventIds.map((id) => {
      const e = byId.get(id);
      return e ? `${e.date ?? "non daté"} · ${e.file}:${e.line}` : id;
    });
    out.push(
      `## Post ${p.n}`,
      "",
      `*${p.seconds} s · ${p.turns} tours · ${p.reads} read_file · ${p.postsRead} read_post · ${p.text.length} caractères*`,
      "",
      `Pointeurs : ${refs.length ? refs.join(" — ") : "aucun"}`,
      "",
      p.text.trim(),
      ""
    );
  }
}

fs.mkdirSync(path.dirname(sortie), { recursive: true });
fs.writeFileSync(sortie, out.join("\n"));
console.log(`${sortie} — ${out.join("\n").length} caractères`);
