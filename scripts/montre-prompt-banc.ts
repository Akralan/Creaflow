/** Imprime, sans aucun appel au modèle, ce que le rédacteur du banc reçoit exactement. */
import { buildWriterSystemPrompt, buildWriterUserMessage, buildWriterTools, type WriterContext } from "@/lib/llm/pointerPostWriter";

const c: WriterContext = {
  brandName: "tellovo",
  projectName: "CreaFlow",
  projectContext: `CreaFlow turns the material a founder already produces — project notes, specs, a devlog, decisions, numbers — into social posts, instead of asking them to come up with ideas. It only writes from what it was actually given, and never invents a fact it was not handed.
The problem it solves: founders and independents accumulate lived material and never publish it, and a generator fed only a product description has two options, stay generic or invent plausible details.`,
  readerLabel: "Indie developers building in public",
  readerWho: "developers and solo founders who ship a product publicly and want to post about it without spending their evening writing",
  timeline: [
    { id: "e340", file: "docs/DEVLOG.md", line: 84, date: "2026-10-20", used: false, genre: "échec", disponible: false, tient: null },
    { id: "e341", file: "docs/DEVLOG.md", line: 97, date: "2026-10-21", used: true, genre: "livraison", disponible: true, tient: null },
    { id: "e342", file: "docs/DEVLOG.md", line: 118, date: "2026-10-21", used: true, genre: "décision", disponible: false, tient: null },
    { id: "e512", file: "commit-log.txt", line: 12, date: null, used: false, genre: "livraison", disponible: false, tient: "e342" },
  ],
  posts: [
    { id: "p1", date: "2026-10-22", text: "(texte du post 1)" },
    { id: "p2", date: "2026-10-23", text: "(texte du post 2)" },
  ],
  files: new Map(),
  platform: "linkedin",
  language: "fr",
};

console.log("################ SYSTEM ################\n");
console.log(buildWriterSystemPrompt(c));
console.log("\n\n################ MESSAGE UTILISATEUR ################\n");
console.log(buildWriterUserMessage(c));
console.log("\n\n################ OUTILS ################\n");
for (const t of buildWriterTools()) console.log(`- ${t.name}(${Object.keys(t.input_schema.properties).join(", ")}) : ${t.description}`);
