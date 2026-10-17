import { describe, expect, it } from "vitest";
import { buildReadersBlock, buildScriptUserMessage, SCRIPT_CORE_PROMPT, SCRIPT_SYSTEM_PROMPT, type ScriptGenerationContext } from "./prompts";
import { generateTextPostTool, generateVisualPostTool } from "./scriptSchema";
import type { LlmToolDefinition } from "./types";

const players = { label: "Joueurs", who: "Fans de plateformes 2D", knows: "Les classiques", wants: "Voir le jeu", stopsFor: "Un GIF", turnsOff: "Le jargon", words: ["wishlist", "feeling"] };
const devs = { label: "Devs indés", who: "Développeurs de jeux", knows: "Godot", wants: "Les réglages", stopsFor: "Un chiffre", turnsOff: "Le hype", words: ["coyote time"] };

const base: ScriptGenerationContext = {
  creatorProfile: { brandName: "Alix", activityType: "Tu construis un jeu de plateforme", targetAudience: "Audience de marque" },
  product: { name: "Mira", description: "Jeu de plateforme", targetAudience: "Les joueurs de plateformes" },
  platform: "linkedin",
  contentCategory: { id: "c1", label: "Coulisses", description: "Montrer le travail en cours." },
  contentType: "text",
};

describe("system prompt V3", () => {
  it("n'est plus un « Directeur Marketing » et ajoute la méthode à la génération complète seulement", () => {
    expect(SCRIPT_CORE_PROMPT).toContain("Tu es le ghostwriter");
    expect(SCRIPT_CORE_PROMPT).not.toContain("Directeur Marketing");
    expect(SCRIPT_CORE_PROMPT).not.toContain("<methode>");
    expect(SCRIPT_SYSTEM_PROMPT).toContain("<methode>");
    expect(SCRIPT_SYSTEM_PROMPT).not.toMatch(/valeurs/);
  });
});

describe("buildReadersBlock", () => {
  it("décrit chaque public du portrait, le principal en premier", () => {
    const block = buildReadersBlock({ ...base, readers: [players, devs] });
    expect(block).toContain("- Joueurs : Fans de plateformes 2D. Sait déjà : Les classiques. Vient chercher : Voir le jeu.");
    expect(block).toContain("Ses mots : wishlist, feeling.");
    expect(block.indexOf("Joueurs")).toBeLessThan(block.indexOf("Devs indés"));
    expect(block).not.toContain("Audience visée");
  });

  it("rappelle les publics récents seulement s'il y en a plusieurs à alterner", () => {
    expect(buildReadersBlock({ ...base, readers: [players, devs], recentReaderLabels: ["Joueurs", "Joueurs"] })).toContain(
      "Publics visés par les derniers posts de ce sujet, du plus récent au plus ancien : Joueurs, Joueurs."
    );
    expect(buildReadersBlock({ ...base, readers: [players], recentReaderLabels: ["Joueurs"] })).not.toContain("Publics visés");
  });

  it("retombe sur le « Pour qui » du sujet, puis sur l'audience de marque, puis sur une déduction", () => {
    expect(buildReadersBlock(base)).toContain("Audience visée : Les joueurs de plateformes");
    expect(buildReadersBlock({ ...base, product: { name: "Mira" } })).toContain("Audience visée : Audience de marque");
    expect(buildReadersBlock({ ...base, product: null, creatorProfile: { brandName: "A", activityType: "B" } })).toContain(
      "Aucune audience définie : déduis le lecteur le plus probable"
    );
  });
});

describe("buildScriptUserMessage V3", () => {
  it("ouvre sur <lecteurs>, ferme sur <rappel>, et ne parle plus de « catégorie »", () => {
    const message = buildScriptUserMessage({ ...base, readers: [players] });
    expect(message.startsWith("<lecteurs>")).toBe(true);
    expect(message.trim().endsWith("</rappel>")).toBe(true);
    expect(message).toContain("Rôle de ce post : Coulisses — Montrer le travail en cours.");
    expect(message).not.toMatch(/catégorie/i);
    expect(message).not.toContain("===");
  });

  it("met la matière dans <matiere> et les limites chiffrées dans <plateforme>", () => {
    const message = buildScriptUserMessage({ ...base, materialDocuments: [{ id: "d1", title: "Journal", annotatedText: "Le saut a été réglé." }] });
    expect(message).toContain("<matiere>\nMatière de ce sujet. C'est ta seule source de faits.");
    expect(message).toContain("[Journal]\nLe saut a été réglé.");
    expect(message).toMatch(/<plateforme>\nLinkedIn\. .*200 caractères.*600 à 1500 caractères/);
  });

  it("garde les blocs dans l'ordre de l'annexe A.3", () => {
    const message = buildScriptUserMessage({
      ...base,
      contentType: "visual",
      visual: { format: "single", slideCount: null, durationMs: null },
      styleProfile: { tone: "t", sentenceLength: "s", emojiUsage: "e", vocabulary: "v", summary: "Voix sobre.", rules: [], avoid: [], prefer: [], evidence: { scriptCount: 0, learnedAt: null } },
      materialDocuments: [{ id: "d1", title: null, annotatedText: "Fait." }],
      recentTopics: ["Ancien post"],
    });
    const order = ["<lecteurs>", "<marque>", "<style>", "<matiere>", "<brief>", "<plateforme>", "<format>", "<variete>", "<rappel>"].map((t) => message.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

/** Mode strict OpenAI : chaque objet déclare additionalProperties:false et rend requises toutes ses propriétés. */
function assertStrict(schema: Record<string, unknown>, path = "racine") {
  if (schema.type === "object") {
    const props = Object.keys((schema.properties as Record<string, unknown>) ?? {});
    expect(schema.additionalProperties, path).toBe(false);
    expect([...((schema.required as string[]) ?? [])].sort(), path).toEqual([...props].sort());
    for (const [key, value] of Object.entries((schema.properties as Record<string, Record<string, unknown>>) ?? {})) assertStrict(value, `${path}.${key}`);
  }
  if (schema.type === "array" && schema.items) assertStrict(schema.items as Record<string, unknown>, `${path}[]`);
}

describe("outils de génération V3", () => {
  it.each<[string, LlmToolDefinition]>([
    ["visuel", generateVisualPostTool],
    ["texte", generateTextPostTool],
  ])("outil %s : conforme au mode strict, préparation avant le post, relecture en dernier", (_, tool) => {
    assertStrict(tool.input_schema as Record<string, unknown>);
    const keys = Object.keys((tool.input_schema as { properties: Record<string, unknown> }).properties);
    expect(keys.slice(0, 6)).toEqual(["reader", "candidateMoments", "chosenMoment", "concept", "hookOptions", "chosenHook"]);
    expect(keys[keys.length - 1]).toBe("selfCheck");
  });
});
