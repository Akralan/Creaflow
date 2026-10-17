import { beforeEach, describe, expect, it, vi } from "vitest";

const { callAgenticMock } = vi.hoisted(() => ({ callAgenticMock: vi.fn() }));

vi.mock("./provider", () => ({
  callAgentic: callAgenticMock,
}));

import { runAssistantChatTurn, type AssistantChatContext } from "./assistantChat";

// docs/SPEC_ASSISTANT_AGENTIQUE.md §3 — l'assistant lit via des outils, propose via propose_changes,
// et répond en texte. §6 : il ne doit jamais pouvoir proposer un `update` sur un champ qu'on ne lui a
// pas montré, ce serait un écrasement à l'aveugle.

const readTools = [
  {
    name: "list_materials",
    description: "Lists the material.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

function buildContext(overrides: Partial<AssistantChatContext> = {}): AssistantChatContext {
  return {
    history: [{ role: "user", content: "Salut." }],
    products: [
      {
        id: "p1",
        name: "Ceramics workshop",
        description: "One-of-a-kind pieces.",
        valueProposition: "Handmade, limited edition.",
        targetAudience: "Collectors of handcrafted decor.",
      },
    ],
    series: [
      {
        id: "s1",
        label: "Workshop journal",
        description: "This week's progress.",
        rhythm: { days: [3], every: 1, anchor: null },
        category: { label: "Behind the scenes" },
        platforms: [],
        product: { id: "p1", name: "Ceramics workshop" },
      },
    ],
    categories: [
      { id: "c1", label: "Behind the scenes", description: "Show the other side of the scenes.", weight: 40, platforms: [], materialHungry: true },
      { id: "c2", label: "Expertise", description: "Transmettre un savoir-faire.", weight: 60, platforms: [], materialHungry: false },
    ],
    angles: [],
    postingGoals: [],
    publishingDays: [3, 6],
    expectations: null,
    currentTargetAudience: null,
    readTools,
    onReadTool: vi.fn().mockResolvedValue({ count: 0, materials: [] }),
    ...overrides,
  };
}

/** Répond en texte sans appeler d'outil. */
function replyOnly(reply: string) {
  return async () => ({ reply, toolCalls: [], turns: 1, stoppedAtMaxTurns: false });
}

beforeEach(() => {
  callAgenticMock.mockReset();
});

describe("runAssistantChatTurn", () => {
  it("montre au modèle tous les champs qu'il peut proposer de modifier", async () => {
    callAgenticMock.mockImplementation(replyOnly("Ok."));

    await runAssistantChatTurn(buildContext());

    const { system } = callAgenticMock.mock.calls[0][0];
    // Produit : proposition de valeur et audience du sujet (proposables, donc écrasables).
    expect(system).toContain("Handmade, limited edition.");
    expect(system).toContain("Collectors of handcrafted decor.");
    // Série : mode et sujet dont elle tire sa matière.
    expect(system).toContain("Ceramics workshop (id:p1)");
    // Rôle : la consigne éditoriale et l'aiguillage matière.
    expect(system).toContain("Show the other side of the scenes.");
    expect(system).toContain("[requires documented material]");
  });

  it("expose les outils de lecture ET l'outil de proposition, sans en imposer aucun", async () => {
    callAgenticMock.mockImplementation(replyOnly("Ok."));

    await runAssistantChatTurn(buildContext());

    const { tools, messages } = callAgenticMock.mock.calls[0][0];
    expect(tools.map((t: { name: string }) => t.name)).toEqual([
      "list_materials",
      "propose_changes",
      "propose_material",
      "propose_archive",
      "propose_publishing_days",
    ]);
    // L'historique part en vrai multi-tours, plus aplati en une seule chaîne.
    expect(messages).toEqual([{ role: "user", content: "Salut." }]);

    const proposalTool = tools.find((t: { name: string }) => t.name === "propose_changes");
    const product = proposalTool.input_schema.properties.productProposals.items.properties;
    const series = proposalTool.input_schema.properties.seriesProposals.items.properties;
    const category = proposalTool.input_schema.properties.categoryProposals.items.properties;
    expect(product.targetAudience).toBeDefined();
    expect(series.productId.enum).toEqual(["p1"]);
    expect(category.materialHungry.type).toBe("boolean");
    // La réponse à l'utilisateur est du texte libre, plus un champ de l'outil.
    expect(proposalTool.input_schema.properties.assistantReply).toBeUndefined();
  });

  it("route un appel d'outil de lecture vers l'exécuteur fourni", async () => {
    const onReadTool = vi.fn().mockResolvedValue({ count: 2 });
    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: unknown) => Promise<unknown> }) => {
      const output = await onToolCall({ name: "list_materials", input: { productId: "p1" } });
      return { reply: "Tu as 2 documents.", toolCalls: [{ name: "list_materials", input: {}, output }], turns: 2, stoppedAtMaxTurns: false };
    });

    const result = await runAssistantChatTurn(buildContext({ onReadTool }));

    expect(onReadTool).toHaveBeenCalledWith("list_materials", { productId: "p1" });
    expect(result.reply).toBe("Tu as 2 documents.");
    expect(result.proposals.seriesProposals).toEqual([]);
  });

  it("accumule les propositions de plusieurs appels à propose_changes dans le même tour", async () => {
    const empty = {
      productProposals: [],
      seriesProposals: [],
      categoryProposals: [],
      angleProposals: [],
      postingGoalProposals: [],
      profileProposals: [],
    };
    const series = (label: string) => ({
      action: "create",
      label,
      description: "A debunked misconception.",
      rhythmDays: [2],
      everyOtherWeek: false,
      categoryLabel: "Expertise",
      platforms: [],
    });

    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: unknown) => Promise<unknown> }) => {
      const first = await onToolCall({ name: "propose_changes", input: { ...empty, seriesProposals: [series("Le mythe du mercredi")] } });
      await onToolCall({ name: "propose_changes", input: { ...empty, seriesProposals: [series("Le chiffre du lundi")] } });
      return { reply: "Deux pistes.", toolCalls: [], turns: 3, stoppedAtMaxTurns: false, first };
    });

    const result = await runAssistantChatTurn(buildContext());

    expect(result.proposals.seriesProposals.map((s) => s.label)).toEqual(["Le mythe du mercredi", "Le chiffre du lundi"]);
  });

  it("collecte les propositions de matière et d'archivage", async () => {
    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: unknown) => Promise<unknown> }) => {
      await onToolCall({
        name: "propose_material",
        input: { action: "create", productId: "p1", title: "Tuesday order", text: "The kiln fired 40 pieces." },
      });
      await onToolCall({ name: "propose_archive", input: { kind: "series", targetId: "s1", reason: "Plus le temps." } });
      return { reply: "Noted.", toolCalls: [], turns: 3, stoppedAtMaxTurns: false };
    });

    const result = await runAssistantChatTurn(buildContext());

    expect(result.materialProposals).toEqual([
      { action: "create", productId: "p1", title: "Tuesday order", text: "The kiln fired 40 pieces." },
    ]);
    expect(result.archiveProposals).toEqual([{ kind: "series", targetId: "s1", reason: "Plus le temps." }]);
  });

  it("montre les jours de publication en clair, les plateformes actives ou coupées, et les attentes", async () => {
    callAgenticMock.mockImplementation(replyOnly("Ok."));

    await runAssistantChatTurn(
      buildContext({
        publishingDays: [6, 3],
        expectations: "Publish without spending my evenings on it.",
        postingGoals: [
          { platform: "linkedin", targetCountPerWeek: 2 },
          { platform: "instagram", targetCountPerWeek: 0 },
        ],
      })
    );

    const { system, tools } = callAgenticMock.mock.calls[0][0];
    expect(system).toContain("Days the author can publish: Wednesday, Saturday");
    expect(system).toContain("[id:s1] Workshop journal (Wed, days 3)");
    expect(system).toContain("LinkedIn: active");
    expect(system).toContain("Instagram: switched off");
    expect(system).not.toContain("/week");
    expect(system).toContain("Publish without spending my evenings on it.");
    const proposalTool = tools.find((t: { name: string }) => t.name === "propose_changes");
    const goal = proposalTool.input_schema.properties.postingGoalProposals.items;
    expect(goal.required).toEqual(["platform", "active"]);
    expect(goal.properties.targetCountPerWeek).toBeUndefined();
  });

  it("collecte une proposition de jours de publication, normalisée", async () => {
    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: unknown) => Promise<unknown> }) => {
      await onToolCall({ name: "propose_publishing_days", input: { publishingDays: [5, 1, 5] } });
      return { reply: "Proposed.", toolCalls: [], turns: 2, stoppedAtMaxTurns: false };
    });

    const result = await runAssistantChatTurn(buildContext());

    expect(result.publishingDaysProposals).toEqual([{ publishingDays: [1, 5] }]);
  });

  it("refuse une proposition de jours de publication vide", async () => {
    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: unknown) => Promise<unknown> }) => {
      await onToolCall({ name: "propose_publishing_days", input: { publishingDays: [] } });
      return { reply: "…", toolCalls: [], turns: 2, stoppedAtMaxTurns: false };
    });

    await expect(runAssistantChatTurn(buildContext())).rejects.toThrow();
  });

  it("refuse une création de matière sans contenu ni fichier", async () => {
    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: unknown) => Promise<unknown> }) => {
      await onToolCall({ name: "propose_material", input: { action: "create", title: "Vide" } });
      return { reply: "…", toolCalls: [], turns: 2, stoppedAtMaxTurns: false };
    });

    // L'erreur remonte à la boucle, qui la renvoie au modèle comme échec d'outil (openai.test.ts).
    await expect(runAssistantChatTurn(buildContext())).rejects.toThrow();
  });

  it("expose les fichiers déposés par leur nom, jamais leur contenu", async () => {
    callAgenticMock.mockImplementation(replyOnly("Ok."));

    await runAssistantChatTurn(buildContext({ attachments: [{ id: "a1", filename: "journal-mars.md" }] }));

    const { system, tools } = callAgenticMock.mock.calls[0][0];
    expect(system).toContain("[id:a1] journal-mars.md");
    const materialTool = tools.find((t: { name: string }) => t.name === "propose_material");
    expect(materialTool.input_schema.properties.attachmentId.enum).toEqual(["a1"]);
  });

});
