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
    description: "Liste la matière.",
    input_schema: { type: "object" as const, properties: {}, required: [] },
  },
];

function buildContext(overrides: Partial<AssistantChatContext> = {}): AssistantChatContext {
  return {
    history: [{ role: "user", content: "Salut." }],
    products: [
      {
        id: "p1",
        name: "Atelier céramique",
        description: "Pièces uniques.",
        valueProposition: "Fait main, série limitée.",
        targetAudience: "Collectionneurs de déco artisanale.",
      },
    ],
    series: [
      {
        id: "s1",
        label: "Journal d'atelier",
        description: "L'avancement de la semaine.",
        weight: 20,
        category: { label: "Coulisses" },
        platforms: [],
        mode: "feuilleton",
        product: { id: "p1", name: "Atelier céramique" },
      },
    ],
    categories: [
      { id: "c1", label: "Coulisses", description: "Montrer l'envers du décor.", weight: 40, platforms: [], materialHungry: true },
      { id: "c2", label: "Expertise", description: "Transmettre un savoir-faire.", weight: 60, platforms: [], materialHungry: false },
    ],
    angles: [],
    postingGoals: [],
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
    expect(system).toContain("Fait main, série limitée.");
    expect(system).toContain("Collectionneurs de déco artisanale.");
    // Série : mode et sujet dont elle tire sa matière.
    expect(system).toContain("[mode : feuilleton]");
    expect(system).toContain("Atelier céramique (id:p1)");
    // Rôle : la consigne éditoriale et l'aiguillage matière.
    expect(system).toContain("Montrer l'envers du décor.");
    expect(system).toContain("[exige de la matière documentée]");
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
    ]);
    // L'historique part en vrai multi-tours, plus aplati en une seule chaîne.
    expect(messages).toEqual([{ role: "user", content: "Salut." }]);

    const proposalTool = tools.find((t: { name: string }) => t.name === "propose_changes");
    const product = proposalTool.input_schema.properties.productProposals.items.properties;
    const series = proposalTool.input_schema.properties.seriesProposals.items.properties;
    const category = proposalTool.input_schema.properties.categoryProposals.items.properties;
    expect(product.targetAudience).toBeDefined();
    expect(series.mode.enum).toEqual(["feuilleton", "rendez_vous"]);
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
      description: "Une idée reçue démontée.",
      weight: 15,
      categoryLabel: "Expertise",
      platforms: [],
      mode: "rendez_vous",
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
        input: { action: "create", productId: "p1", title: "Commande du mardi", text: "Le four a cuit 40 pièces." },
      });
      await onToolCall({ name: "propose_archive", input: { kind: "series", targetId: "s1", reason: "Plus le temps." } });
      return { reply: "C'est noté.", toolCalls: [], turns: 3, stoppedAtMaxTurns: false };
    });

    const result = await runAssistantChatTurn(buildContext());

    expect(result.materialProposals).toEqual([
      { action: "create", productId: "p1", title: "Commande du mardi", text: "Le four a cuit 40 pièces." },
    ]);
    expect(result.archiveProposals).toEqual([{ kind: "series", targetId: "s1", reason: "Plus le temps." }]);
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

  it("ne fait pas échouer le tour quand le modèle omet le mode d'une série", async () => {
    callAgenticMock.mockImplementation(async ({ onToolCall }: { onToolCall: (c: unknown) => Promise<unknown> }) => {
      await onToolCall({
        name: "propose_changes",
        input: {
          productProposals: [],
          seriesProposals: [
            { action: "create", label: "Sans mode", description: "X", weight: 15, categoryLabel: "Expertise", platforms: [] },
          ],
          categoryProposals: [],
          angleProposals: [],
          postingGoalProposals: [],
          profileProposals: [],
        },
      });
      return { reply: "Ok.", toolCalls: [], turns: 2, stoppedAtMaxTurns: false };
    });

    const result = await runAssistantChatTurn(buildContext());

    expect(result.proposals.seriesProposals[0].mode).toBeUndefined();
  });
});
