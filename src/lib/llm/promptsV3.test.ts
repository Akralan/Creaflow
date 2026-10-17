import { describe, expect, it } from "vitest";
import { buildReadersBlock, buildScriptUserMessage, SCRIPT_CORE_PROMPT, SCRIPT_SYSTEM_PROMPT, type ScriptGenerationContext } from "./prompts";
import { generateTextPostTool, generateVisualPostTool } from "./scriptSchema";
import type { LlmToolDefinition } from "./types";

const players = { label: "Players", who: "2D platformer fans", knows: "The classics", wants: "See the game", stopsFor: "A GIF", turnsOff: "Jargon", words: ["wishlist", "feeling"] };
const devs = { label: "Indie devs", who: "Game developers", knows: "Godot", wants: "The settings", stopsFor: "A number", turnsOff: "Hype", words: ["coyote time"] };

const base: ScriptGenerationContext = {
  creatorProfile: { brandName: "Alix", activityType: "You build a platformer game", targetAudience: "Brand audience" },
  product: { name: "Mira", description: "Platformer game", targetAudience: "Platformer players" },
  platform: "linkedin",
  contentCategory: { id: "c1", label: "Behind the scenes", description: "Show the work in progress." },
  contentType: "text",
};

describe("system prompt V3", () => {
  it("is no longer a Marketing Director and adds the method to full generation only", () => {
    expect(SCRIPT_CORE_PROMPT).toContain("You are the ghostwriter");
    expect(SCRIPT_CORE_PROMPT).not.toContain("Directeur Marketing");
    expect(SCRIPT_CORE_PROMPT).not.toContain("<method>");
    expect(SCRIPT_SYSTEM_PROMPT).toContain("<method>");
    expect(SCRIPT_SYSTEM_PROMPT).not.toMatch(/values/);
  });
});

describe("buildReadersBlock", () => {
  it("describes each audience of the portrait, the main one first", () => {
    const block = buildReadersBlock({ ...base, readers: [players, devs] });
    expect(block).toContain("- Players: 2D platformer fans. Already knows: The classics. Comes looking for: See the game.");
    expect(block).toContain("Their words: wishlist, feeling.");
    expect(block.indexOf("Players")).toBeLessThan(block.indexOf("Indie devs"));
    expect(block).not.toContain("Target audience");
  });

  it("recalls the recent audiences only if there are several to alternate", () => {
    expect(buildReadersBlock({ ...base, readers: [players, devs], recentReaderLabels: ["Players", "Players"] })).toContain(
      "Audiences targeted by this subject's latest posts, newest first: Players, Players."
    );
    expect(buildReadersBlock({ ...base, readers: [players], recentReaderLabels: ["Players"] })).not.toContain("Audiences targeted");
  });

  it("falls back on the subject Who-for, then the brand audience, then a deduction", () => {
    expect(buildReadersBlock(base)).toContain("Target audience: Platformer players");
    expect(buildReadersBlock({ ...base, product: { name: "Mira" } })).toContain("Target audience: Brand audience");
    expect(buildReadersBlock({ ...base, product: null, creatorProfile: { brandName: "A", activityType: "B" } })).toContain(
      "No audience defined: infer the most likely reader"
    );
  });
});

describe("buildScriptUserMessage V3", () => {
  it("opens on <readers>, closes on <reminder>, and no longer talks about a category", () => {
    const message = buildScriptUserMessage({ ...base, readers: [players] });
    expect(message.startsWith("<readers>")).toBe(true);
    expect(message.trim().endsWith("</reminder>")).toBe(true);
    expect(message).toContain("Role of this post: Behind the scenes — Show the work in progress.");
    expect(message).not.toMatch(/category/i);
    expect(message).not.toContain("===");
  });

  it("puts the material in <material> and the numeric limits in <platform>", () => {
    const message = buildScriptUserMessage({ ...base, materialDocuments: [{ id: "d1", title: "Journal", annotatedText: "The jump was tuned." }] });
    expect(message).toContain("<material>\nMaterial for this subject. It is your only source of facts.");
    expect(message).toContain("[Journal]\nThe jump was tuned.");
    expect(message).toMatch(/<platform>\nLinkedIn\. .*200 characters.*600 to 1500 characters/);
  });

  it("garde les blocs dans l'ordre de l'annexe A.3", () => {
    const message = buildScriptUserMessage({
      ...base,
      contentType: "visual",
      visual: { format: "single", slideCount: null, durationMs: null },
      styleProfile: { tone: "t", sentenceLength: "s", emojiUsage: "e", vocabulary: "v", summary: "Sober voice.", rules: [], avoid: [], prefer: [], evidence: { scriptCount: 0, learnedAt: null } },
      materialDocuments: [{ id: "d1", title: null, annotatedText: "Fait." }],
      recentTopics: ["Ancien post"],
    });
    const order = ["<readers>", "<brand>", "<style>", "<material>", "<brief>", "<platform>", "<format>", "<variety>", "<reminder>"].map((t) => message.indexOf(t));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});

/** Mode strict OpenAI : chaque objet déclare additionalProperties:false et rend requises toutes ses propriétés. */
function assertStrict(schema: Record<string, unknown>, path = "root") {
  if (schema.type === "object") {
    const props = Object.keys((schema.properties as Record<string, unknown>) ?? {});
    expect(schema.additionalProperties, path).toBe(false);
    expect([...((schema.required as string[]) ?? [])].sort(), path).toEqual([...props].sort());
    for (const [key, value] of Object.entries((schema.properties as Record<string, Record<string, unknown>>) ?? {})) assertStrict(value, `${path}.${key}`);
  }
  if (schema.type === "array" && schema.items) assertStrict(schema.items as Record<string, unknown>, `${path}[]`);
}

describe("V3 generation tools", () => {
  it.each<[string, LlmToolDefinition]>([
    ["visual", generateVisualPostTool],
    ["text", generateTextPostTool],
  ])("%s tool: strict-mode compliant, preparation before the post, review last", (_, tool) => {
    assertStrict(tool.input_schema as Record<string, unknown>);
    const keys = Object.keys((tool.input_schema as { properties: Record<string, unknown> }).properties);
    expect(keys.slice(0, 6)).toEqual(["reader", "candidateMoments", "chosenMoment", "concept", "hookOptions", "chosenHook"]);
    expect(keys[keys.length - 1]).toBe("selfCheck");
  });
});

describe("language block", () => {
  it("names the language in the user message when the context has one", () => {
    const message = buildScriptUserMessage({ ...base, language: "fr" });
    expect(message).toContain("<language>");
    expect(message).toContain("Write the whole post in French");
  });

  it("adds no block without a language", () => {
    expect(buildScriptUserMessage(base)).not.toContain("<language>");
  });

  it("no longer hardcodes English in the shared prompt", () => {
    expect(SCRIPT_CORE_PROMPT).not.toMatch(/written in English/);
    expect(SCRIPT_CORE_PROMPT).toContain("language given in <language>");
  });
});
