/**
 * Choisit, par forme, les posts du relevé LinkedIn qui servent de modèles d'écriture au rédacteur
 * (docs/FORMES_ET_GENRES.md), et écrit src/lib/llm/postExamples.generated.ts.
 *
 * Source : docs/tests/posts-modeles/catalogue-textes.json (scripts/fetch-catalogue-posts.mjs).
 * Règle de choix : le type du catalogue donne la forme ; on garde les posts entiers (pas de doublon,
 * texte d'au moins 200 caractères, réactions connues), classés par engagement relatif à la médiane
 * de leur auteur, au plus MAX_PER_FORM par forme. Les coups de gueule et l'humour sont écartés de la
 * forme « failure » (la spec les exclut : ils visent quelqu'un, pas le projet).
 *
 *   node scripts/build-post-examples.mjs
 */
import fs from "node:fs";
import path from "node:path";

const SRC = path.join("docs", "tests", "posts-modeles", "catalogue-textes.json");
const OUT = path.join("src", "lib", "llm", "postExamples.generated.ts");
const MAX_PER_FORM = 6;
const MIN_CHARS = 200;
const MAX_PER_AUTHOR = 3;

/** Type du catalogue → forme de la spec. Vision n'a pas de forme (hors périmètre). */
const TYPE_TO_FORM = {
  "Épisode": "episode",
  "Lancement": "launch",
  "Teaser": "teaser",
  "Chiffres": "number",
  "Échec": "failure",
  "Méthode": "lesson",
  "Preuve": "proof",
  "Promesse": "promise",
  "Promesse tenue": "promise_kept",
  "CTA": "offer",
  "Question": "question",
  "Coulisses": "backstage",
  "Curation": "curation",
  "Origine": "origin",
};

const rows = JSON.parse(fs.readFileSync(SRC, "utf8"));
const byForm = {};
for (const r of rows) {
  const form = TYPE_TO_FORM[r.type];
  if (!form || !r.text || r.partial) continue;
  if (r.text.length < MIN_CHARS) continue;
  if (/doublon|variante du post/i.test(r.summary)) continue;
  if (r.reactions === null || !r.median) continue;
  if (form === "failure" && /coup de gueule|humour/i.test(r.summary)) continue;
  const ratio = r.reactions / r.median;
  (byForm[form] ??= []).push({ author: r.author, reactions: r.reactions, median: r.median, ratio: Number(ratio.toFixed(2)), summary: r.summary, text: r.text });
}
for (const form of Object.keys(byForm)) {
  byForm[form].sort((a, b) => b.ratio - a.ratio);
  // Au plus MAX_PER_AUTHOR par auteur et par forme : six épisodes du même devlog apprendraient une seule voix.
  const perAuthor = {};
  byForm[form] = byForm[form].filter((e) => (perAuthor[e.author] = (perAuthor[e.author] ?? 0) + 1) <= MAX_PER_AUTHOR).slice(0, MAX_PER_FORM);
}
// La forme « looking back » partage ses modèles avec la promesse tenue : même texte de forme.
byForm.looking_back = byForm.promise_kept ?? [];

const header = `/**
 * GÉNÉRÉ par scripts/build-post-examples.mjs — ne pas éditer à la main.
 *
 * Les modèles d'écriture de chaque forme (docs/FORMES_ET_GENRES.md) : de vrais posts LinkedIn du relevé
 * d'octobre 2026 (docs/CATALOGUE_POSTS_LINKEDIN.md), choisis par engagement relatif à la médiane de leur
 * auteur. Rendus par read_form, jamais dans le prompt système. Textes d'auteurs tiers, cités comme
 * exemples de forme : le rédacteur lit leur construction, il ne recopie jamais une ligne.
 */
import type { Form } from "./postForms";

export interface PostExample {
  author: string;
  reactions: number;
  /** Médiane de réactions de l'auteur sur le relevé : le ratio dit si le post a dépassé son habitude. */
  median: number;
  ratio: number;
  text: string;
}

export const POST_EXAMPLES: Partial<Record<Form, PostExample[]>> = `;

const body = JSON.stringify(
  Object.fromEntries(Object.entries(byForm).map(([f, list]) => [f, list.map(({ author, reactions, median, ratio, text }) => ({ author, reactions, median, ratio, text }))])),
  null,
  2
);
fs.writeFileSync(OUT, `${header}${body};\n`);

for (const [form, list] of Object.entries(byForm).sort()) {
  console.log(`${form.padEnd(13)} ${String(list.length).padStart(2)}  ${list.map((e) => `${e.author.split(" ")[0]} x${e.ratio}`).join(" · ")}`);
}
console.log(`→ ${OUT}`);
