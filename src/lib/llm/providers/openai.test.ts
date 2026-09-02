import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(function OpenAIMock() {
    return { responses: { create: createMock } };
  }),
}));

import { callOpenAIAgentic } from "./openai";
import type { AgenticCallParams } from "../types";

// docs/SPEC_ASSISTANT_AGENTIQUE.md §2.2/§2.3 — la boucle agentique : outils NON imposés, historique
// qui s'accumule, échecs d'outils renvoyés au modèle, plafond de tours qui rend toujours une réponse.

const tools: AgenticCallParams["tools"] = [
  {
    name: "read_thing",
    description: "Lit une chose.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

function baseParams(onToolCall: AgenticCallParams["onToolCall"]): AgenticCallParams {
  return {
    system: "system prompt",
    messages: [{ role: "user", content: "Salut." }],
    tools,
    maxTokens: 512,
    onToolCall,
  };
}

function textResponse(text: string) {
  return { output: [{ type: "message", content: [] }], output_text: text };
}

function callResponse(callId: string, name: string, args: string) {
  return { output: [{ type: "function_call", call_id: callId, name, arguments: args }], output_text: "" };
}

beforeEach(() => {
  createMock.mockReset();
  process.env.OPENAI_API_KEY = "test-key";
});

describe("callOpenAIAgentic", () => {
  it("n'impose aucun outil et rend la main dès que le modèle répond en texte", async () => {
    createMock.mockResolvedValueOnce(textResponse("Bonjour !"));
    const onToolCall = vi.fn();

    const result = await callOpenAIAgentic(baseParams(onToolCall));

    expect(result).toMatchObject({ reply: "Bonjour !", turns: 1, stoppedAtMaxTurns: false, toolCalls: [] });
    expect(onToolCall).not.toHaveBeenCalled();
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({ tool_choice: "auto" }));
  });

  it("exécute l'outil, renvoie son résultat au modèle et accumule l'historique", async () => {
    createMock
      .mockResolvedValueOnce(callResponse("c1", "read_thing", '{"id":"x"}'))
      .mockResolvedValueOnce(textResponse("C'est un chat."));
    const onToolCall = vi.fn().mockResolvedValue({ kind: "chat" });

    const result = await callOpenAIAgentic(baseParams(onToolCall));

    expect(onToolCall).toHaveBeenCalledWith({ name: "read_thing", input: { id: "x" } });
    expect(result.reply).toBe("C'est un chat.");
    expect(result.turns).toBe(2);
    expect(result.toolCalls).toEqual([{ name: "read_thing", input: { id: "x" }, output: { kind: "chat" } }]);

    // Le 2e appel repart de l'historique enrichi : message initial + items du modèle + sortie d'outil.
    const secondInput = createMock.mock.calls[1][0].input;
    expect(secondInput).toHaveLength(3);
    expect(secondInput[2]).toEqual({ type: "function_call_output", call_id: "c1", output: '{"kind":"chat"}' });
  });

  it("renvoie l'échec d'un outil au modèle au lieu d'interrompre la boucle", async () => {
    createMock
      .mockResolvedValueOnce(callResponse("c1", "read_thing", '{"id":"absent"}'))
      .mockResolvedValueOnce(textResponse("Je n'ai pas trouvé."));
    const onToolCall = vi.fn().mockRejectedValue(new Error("Sujet introuvable."));

    const result = await callOpenAIAgentic(baseParams(onToolCall));

    expect(result.reply).toBe("Je n'ai pas trouvé.");
    expect(result.toolCalls[0]).toMatchObject({ failed: true, output: { error: "Sujet introuvable." } });
    expect(createMock.mock.calls[1][0].input[2].output).toBe('{"error":"Sujet introuvable."}');
  });

  it("signale des arguments illisibles au modèle sans appeler l'outil", async () => {
    createMock
      .mockResolvedValueOnce(callResponse("c1", "read_thing", "{pas du json"))
      .mockResolvedValueOnce(textResponse("Je réessaie."));
    const onToolCall = vi.fn();

    const result = await callOpenAIAgentic(baseParams(onToolCall));

    expect(onToolCall).not.toHaveBeenCalled();
    expect(result.toolCalls[0]).toMatchObject({ failed: true, output: { error: "Arguments JSON invalides." } });
  });

  it("tronque un retour d'outil trop volumineux plutôt que de gonfler le contexte", async () => {
    createMock
      .mockResolvedValueOnce(callResponse("c1", "read_thing", '{"id":"x"}'))
      .mockResolvedValueOnce(textResponse("Résumé."));
    const onToolCall = vi.fn().mockResolvedValue({ text: "a".repeat(50_000) });

    await callOpenAIAgentic(baseParams(onToolCall));

    const sent = createMock.mock.calls[1][0].input[2].output as string;
    expect(sent.length).toBeLessThan(21_000);
    expect(sent).toContain("tronqué");
  });

  it("au plafond de tours, conclut par un appel sans outils plutôt que de rendre la main sans réponse", async () => {
    createMock.mockImplementation(async (params: { tool_choice?: string }) =>
      params.tool_choice === "none" ? textResponse("Je m'arrête là.") : callResponse("c1", "read_thing", '{"id":"x"}')
    );
    const onToolCall = vi.fn().mockResolvedValue({ ok: true });

    const result = await callOpenAIAgentic({ ...baseParams(onToolCall), maxTurns: 3 });

    expect(result).toMatchObject({ reply: "Je m'arrête là.", turns: 3, stoppedAtMaxTurns: true });
    expect(onToolCall).toHaveBeenCalledTimes(3);
    expect(createMock).toHaveBeenCalledTimes(4); // 3 tours + l'appel de clôture
  });
});
