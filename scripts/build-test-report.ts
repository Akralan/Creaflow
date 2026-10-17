/**
 * Page HTML de comparaison des essais de génération (outil de dev) : une ligne par script, une
 * colonne par essai (fichiers JSON de scripts/run-generation-test.ts). Les maquettes sont rendues
 * avec leurs vraies photos ; une animation se rejoue avec le même moteur que l'éditeur
 * (src/components/DesignEditor/slideAnimations.ts, recopié ici en JavaScript).
 *
 * Usage : node_modules/.bin/tsx scripts/build-test-report.ts <page.html> "<titre colonne 1>=<essai1.json>" "<titre 2>=<essai2.json>" …
 */
import fs from "node:fs";

interface Entry {
  scriptId: string;
  platform: string;
  contentType: string;
  visualFormat: string | null;
  durationMs: number | null;
  context: Record<string, unknown>;
  post: Record<string, unknown>;
  design: null | {
    width: number;
    height: number;
    durationMs: number | null;
    slides: { planNumber: number; html: string }[];
    timeline: unknown;
    imageUrls: Record<string, string>;
    logoUrl: string | null;
    rationale?: string;
  };
  trace: null | Record<string, unknown>;
  error?: string;
  designError?: string;
  ms?: number;
}

const [out, ...runArgs] = process.argv.slice(2);
const runs = runArgs.map((arg) => {
  const [title, file] = arg.split("=");
  return { title, data: JSON.parse(fs.readFileSync(file, "utf-8")) as { createdAt: string; entries: Entry[] } };
});

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

const PREVIEW_WIDTH = 340;

function renderSlideHtml(html: string, design: NonNullable<Entry["design"]>): string {
  return html
    .replace(/\{\{IMG:([a-z0-9]+)\}\}/gi, (_, ref: string) => design.imageUrls[ref] ?? "")
    .replace(/\{\{LOGO\}\}/g, design.logoUrl ?? "");
}

function designBlock(design: NonNullable<Entry["design"]>, id: string): string {
  const scale = PREVIEW_WIDTH / design.width;
  const isAnimation = Boolean(design.durationMs);
  const slides = design.slides
    .map(
      (s, i) => `<div class="slide" style="width:${PREVIEW_WIDTH}px;height:${Math.round(design.height * scale)}px">
  <div class="slide-inner" id="${id}-${i}" style="width:${design.width}px;height:${design.height}px;transform:scale(${scale})">${renderSlideHtml(s.html, design)}</div>
</div>`
    )
    .join("\n");
  const player = isAnimation
    ? `<div class="player"><button onclick="playAnim('${id}-0', ${design.durationMs})">▶ Rejouer l'animation (${Math.round((design.durationMs ?? 0) / 1000)} s)</button></div>
<script>window.TIMELINES = window.TIMELINES || {}; window.TIMELINES["${id}-0"] = ${JSON.stringify(design.timeline ?? [])};</script>`
    : "";
  return `<div class="design">${slides}${player}${design.rationale ? `<p class="muted">Parti pris : ${esc(design.rationale)}</p>` : ""}</div>`;
}

function traceBlock(trace: Entry["trace"]): string {
  if (!trace) return "";
  const t = trace as {
    reader?: { label: string; knows: string; wants: string };
    candidateMoments?: { moment: string }[];
    chosenMoment?: { index: number; why: string };
    hookOptions?: { kind: string; text: string }[];
    chosenHook?: { index: number; why: string };
    selfCheck?: { readerTest: string; authorTest: boolean; factsFromMaterial: boolean };
    checks?: { failures: string[]; retried: boolean };
    inspirationsUsed?: string[];
  };
  const lines: string[] = [];
  if (t.reader) lines.push(`<li><b>Lecteur</b> : ${esc(t.reader.label)} — veut : ${esc(t.reader.wants)}</li>`);
  if (t.candidateMoments?.length) {
    lines.push(
      `<li><b>Moments</b> :<ul>${t.candidateMoments.map((m, i) => `<li>${i === t.chosenMoment?.index ? "→ " : ""}${esc(m.moment)}</li>`).join("")}</ul><i>${esc(t.chosenMoment?.why)}</i></li>`
    );
  }
  if (t.hookOptions?.length) {
    lines.push(
      `<li><b>Accroches</b> :<ul>${t.hookOptions.map((h, i) => `<li>${i === t.chosenHook?.index ? "→ " : ""}[${esc(h.kind)}] ${esc(h.text)}</li>`).join("")}</ul></li>`
    );
  }
  if (t.inspirationsUsed?.length) lines.push(`<li><b>Inspirations utilisées</b> : ${esc(t.inspirationsUsed.join(", "))}</li>`);
  if (t.selfCheck) lines.push(`<li><b>Relecture</b> : ${esc(t.selfCheck.readerTest)}</li>`);
  if (t.checks) lines.push(`<li><b>Contrôles</b> : ${t.checks.failures.length ? esc(t.checks.failures.join(" / ")) : "aucun échec"}${t.checks.retried ? " · seconde tentative" : ""}</li>`);
  return `<details><summary>Préparation du modèle</summary><ul class="trace">${lines.join("")}</ul></details>`;
}

function cell(entry: Entry | undefined, id: string): string {
  if (!entry) return `<td class="empty">—</td>`;
  if (entry.error) return `<td><p class="error">Échec : ${esc(entry.error)}</p></td>`;
  const p = entry.post as {
    title?: string;
    concept?: string;
    hookText?: string;
    hookVisual?: string;
    storyboard?: { planNumber: number; description: string }[];
    caption?: string;
    hashtags?: string[];
  };
  const ctx = Object.entries(entry.context)
    .filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && v.length === 0) && v !== 0)
    .map(([k, v]) => `<span class="tag">${esc(k)} : ${esc(Array.isArray(v) ? v.join(", ") : v)}</span>`)
    .join(" ");
  return `<td>
<div class="ctx">${ctx}${entry.ms ? ` <span class="tag">${Math.round(entry.ms / 1000)} s</span>` : ""}</div>
<h3>${esc(p.title)}</h3>
${p.concept ? `<p class="muted"><b>Concept</b> : ${esc(p.concept)}</p>` : ""}
${p.hookText ? `<p class="hook">${esc(p.hookText)}</p>` : ""}
${p.hookVisual ? `<p class="muted"><b>Accroche visuelle</b> : ${esc(p.hookVisual)}</p>` : ""}
${p.storyboard?.length ? `<ol class="storyboard">${p.storyboard.map((s) => `<li>${esc(s.description)}</li>`).join("")}</ol>` : ""}
<div class="caption">${esc(p.caption)}</div>
<p class="muted">${esc((p.hashtags ?? []).join(" ")) || "(pas de hashtag)"} · ${(p.caption ?? "").length} caractères</p>
${entry.design ? designBlock(entry.design, id) : ""}
${entry.designError ? `<p class="error">Maquette refusée : ${esc(entry.designError)}</p>` : ""}
${traceBlock(entry.trace)}
</td>`;
}

const ids = [...new Set(runs.flatMap((r) => r.data.entries.map((e) => e.scriptId)))];
const rows = ids
  .map((id, rowIndex) => {
    const first = runs.map((r) => r.data.entries.find((e) => e.scriptId === id)).find(Boolean);
    const format = first ? `${first.platform} · ${first.contentType}${first.visualFormat ? ` · ${first.visualFormat}` : ""}${first.durationMs ? ` ${first.durationMs / 1000} s` : ""}` : "";
    return `<tr><th colspan="${runs.length}">Script ${rowIndex + 1} — ${esc(format)} <span class="muted">(${id})</span></th></tr>
<tr>${runs.map((r, col) => cell(r.data.entries.find((e) => e.scriptId === id), `s${rowIndex}c${col}`)).join("")}</tr>`;
  })
  .join("\n");

const page = `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Essais de génération</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&family=Space+Grotesk:wght@400;600;700&family=Playfair+Display:wght@400;700&family=DM+Serif+Display&family=Caveat:wght@400;700&family=JetBrains+Mono:wght@400;700&display=swap" rel="stylesheet">
<style>
:root { --bg:#f7f6f3; --card:#fff; --text:#1d1d1f; --muted:#6b6b6b; --border:#e3e1dc; --accent:#3a5bd9; }
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) { --bg:#151515; --card:#1f1f1f; --text:#ececec; --muted:#a0a0a0; --border:#333; --accent:#8aa2ff; } }
body { margin:0; padding:24px 16px; background:var(--bg); color:var(--text); font:15px/1.5 system-ui, sans-serif; }
h1 { margin:0 0 4px; font-size:22px; } .intro { color:var(--muted); margin:0 0 20px; }
.table-wrap { overflow-x:auto; }
table { border-collapse:separate; border-spacing:12px; min-width:${runs.length * 400}px; }
th { text-align:left; font-size:16px; padding:16px 0 0; }
td { vertical-align:top; background:var(--card); border:1px solid var(--border); border-radius:14px; padding:16px; width:${Math.floor(100 / runs.length)}%; max-width:520px; }
thead td { background:none; border:none; font-weight:700; font-size:17px; padding:0 4px; }
h3 { margin:8px 0; font-size:17px; } .hook { font-weight:600; font-size:16px; }
.caption { white-space:pre-wrap; margin:10px 0; }
.muted { color:var(--muted); font-size:13px; } .error { color:#c0392b; }
.tag { display:inline-block; font-size:11px; background:var(--bg); border:1px solid var(--border); border-radius:999px; padding:1px 8px; margin:0 4px 4px 0; color:var(--muted); }
.storyboard { padding-left:20px; color:var(--muted); font-size:13px; }
.design { margin:12px 0; display:grid; gap:10px; }
.slide { overflow:hidden; border-radius:10px; box-shadow:0 2px 12px rgba(0,0,0,.12); background:#ddd; }
.slide-inner { transform-origin:0 0; }
.player button { font:inherit; padding:6px 12px; border-radius:8px; border:1px solid var(--border); background:var(--card); color:var(--text); cursor:pointer; }
details { margin-top:10px; font-size:13px; } summary { cursor:pointer; color:var(--accent); }
.trace { padding-left:18px; } .trace ul { padding-left:18px; margin:2px 0; }
</style></head>
<body>
<h1>Essais de génération</h1>
<p class="intro">${runs.map((r) => `<b>${esc(r.title)}</b> : ${esc(new Date(r.data.createdAt).toLocaleString("fr-FR"))}`).join(" · ")}</p>
<div class="table-wrap"><table>
<thead><tr>${runs.map((r) => `<td>${esc(r.title)}</td>`).join("")}</tr></thead>
<tbody>${rows}</tbody>
</table></div>
<script>
// Moteur d'aperçu de l'éditeur (slideAnimations.ts), recopié pour rejouer la même animation.
const EXIT_MS = 400;
const HIDDEN = { fade:{opacity:0,transform:"none"}, "slide-up":{opacity:0,transform:"translateY(40px)"}, "slide-left":{opacity:0,transform:"translateX(40px)"}, "zoom-in":{opacity:0,transform:"scale(0.85)"}, typewriter:{opacity:1,clipPath:"inset(0 100% 0 0)"} };
const VISIBLE = { opacity:1, transform:"none", clipPath:"inset(0 0 0 0)" };
const GONE = { fade:{opacity:0,transform:"none"}, "slide-down":{opacity:0,transform:"translateY(40px)"}, "slide-right":{opacity:0,transform:"translateX(40px)"}, none:{opacity:1,transform:"none"} };
const frame = (base, offset, easing) => ({ ...base, offset: Math.min(1, Math.max(0, offset)), ...(easing ? { easing } : {}) });
function keyframesFor(e, d, len) {
  const h = HIDDEN[e.enter] || HIDDEN.fade;
  const s = e.startMs / d, en = Math.min(1, (e.startMs + e.enterMs) / d);
  const ease = e.enter === "typewriter" ? "steps(" + Math.min(40, Math.max(4, len)) + ", end)" : "cubic-bezier(0.2, 0.8, 0.2, 1)";
  const f = [frame(h, 0), frame(h, s, ease), frame(VISIBLE, en)];
  if (e.exit && e.exit !== "none" && e.exitAtMs !== null) f.push(frame(VISIBLE, e.exitAtMs / d, "ease-in"), frame(GONE[e.exit], Math.min(1, (e.exitAtMs + EXIT_MS) / d)), frame(GONE[e.exit], 1));
  else f.push(frame(VISIBLE, 1));
  return f;
}
const running = {};
function playAnim(id, d) {
  (running[id] || []).forEach((a) => a.cancel());
  const root = document.getElementById(id).firstElementChild;
  const layers = new Map(Array.from(root.children).filter((c) => c.hasAttribute("data-layer")).map((l) => [l.getAttribute("data-layer"), l]));
  running[id] = (window.TIMELINES[id] || []).map((e) => { const el = layers.get(e.layerId); return el ? el.animate(keyframesFor(e, d, (el.textContent || "").trim().length), { duration: d, fill: "both" }) : null; }).filter(Boolean);
}
// État initial : chaque animation est montrée à sa dernière image, cliquer la rejoue.
for (const id of Object.keys(window.TIMELINES || {})) { const d = Number((document.querySelector('[onclick*="' + id + '"]')?.getAttribute("onclick") || "").split(",")[1]); if (d) playAnim(id, d); }
</script>
</body></html>`;

fs.writeFileSync(out, page, "utf-8");
console.log(`écrit ${out}`);
