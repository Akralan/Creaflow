/** Où se situent, dans la ligne de temps, les pointeurs que le rédacteur a choisis. */
import fs from "node:fs";
import path from "node:path";

const CHOSEN = {
  mykine: [
    ["post 1", ["e1", "e2", "e3", "e72"]],
    ["post 2", ["e33", "e78"]],
  ],
  mytwin: [
    ["post 1", ["e143","e146","e147","e148","e149","e150","e151","e152","e153","e154","e155","e156","e157","e158","e159","e160","e161","e162","e163","e164","e165"]],
    ["post 2", ["e116","e117","e118","e119","e120","e121","e122","e123","e124","e125","e126","e127","e128","e129","e130","e131","e132","e133","e134"]],
    ["post 3", ["e199","e200","e201","e202","e203","e204","e205","e206","e207","e208","e209","e210","e211"]],
  ],
  creaflow: [
    ["post 1", ["e341", "e342"]],
    ["post 2", ["e344", "e350"]],
    ["post 3", ["e341", "e342"]],
  ],
};

for (const [key, posts] of Object.entries(CHOSEN)) {
  const file = path.join("docs", "tests", "pointeurs", key, "timeline.json");
  const ptrs = JSON.parse(fs.readFileSync(file, "utf8"));
  const timeline = ptrs.map((p, i) => ({ id: `e${i + 1}`, ...p }));
  const dated = timeline.filter((e) => e.date);
  const byMonth = {};
  for (const e of dated) {
    const m = e.date.slice(0, 7);
    byMonth[m] = (byMonth[m] ?? 0) + 1;
  }
  console.log(`\n######## ${key.toUpperCase()} — ${timeline.length} pointeurs, ${dated.length} datés`);
  console.log(`span : ${dated[0]?.date ?? "-"} → ${dated[dated.length - 1]?.date ?? "-"}`);
  console.log(`répartition par mois : ${Object.entries(byMonth).map(([m, n]) => `${m}:${n}`).join("  ")}`);
  const files = {};
  for (const e of timeline) files[e.file] = (files[e.file] ?? 0) + 1;
  console.log(
    `documents les plus pourvus : ${Object.entries(files).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([f, n]) => `${f}(${n})`).join("  ")}`
  );

  for (const [label, ids] of posts) {
    const chosen = ids.map((id) => timeline.find((e) => e.id === id)).filter(Boolean);
    const d = chosen.filter((e) => e.date).map((e) => e.date).sort();
    const spanDays =
      d.length > 1 ? Math.round((new Date(d[d.length - 1]) - new Date(d[0])) / 86400000) : null;
    // Position du pointeur dans la ligne de temps triée, en centile : 100 = le plus récent.
    const pct = chosen.map((e) => Math.round((timeline.indexOf(e) / (timeline.length - 1)) * 100));
    const filesUsed = [...new Set(chosen.map((e) => e.file))];
    console.log(
      `  ${label} : ${chosen.length} pointeurs · ${d.length} datés` +
        (d.length > 0 ? ` (${d[0]} → ${d[d.length - 1]})` : "") +
        (spanDays !== null ? ` · écart ${spanDays} j` : "") +
        ` · centile ${Math.min(...pct)}-${Math.max(...pct)} · ${filesUsed.join(", ")}`
    );
  }
}
