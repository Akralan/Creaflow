import { beforeEach, describe, expect, it, vi } from "vitest";

const { createMock } = vi.hoisted(() => ({ createMock: vi.fn() }));

vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(function AnthropicMock() {
    return { messages: { create: createMock } };
  }),
}));

import { callAnthropic } from "./anthropic";
import type { StructuredCallParams } from "../types";

const tool: StructuredCallParams["tool"] = {
  name: "test_tool",
  description: "desc",
  input_schema: { type: "object", properties: { foo: { type: "string" } }, required: ["foo"] },
};

const params: StructuredCallParams = {
  system: "system prompt",
  userMessage: "user message",
  tool,
  maxTokens: 512,
};

beforeEach(() => {
  createMock.mockReset();
  process.env.ANTHROPIC_API_KEY = "test-key";
});

describe("callAnthropic", () => {
  it("force l'outil via tool_choice et renvoie l'input du bloc tool_use", async () => {
    createMock.mockResolvedValue({
      content: [{ type: "tool_use", name: "test_tool", input: { foo: "bar" } }],
    });

    const result = await callAnthropic(params);

    expect(result).toEqual({ foo: "bar" });
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        system: "system prompt",
        tools: [tool],
        tool_choice: { type: "tool", name: "test_tool" },
      })
    );
  });

  it("lève une erreur générique si aucun bloc tool_use n'est renvoyé", async () => {
    createMock.mockResolvedValue({ content: [{ type: "text", text: "oups" }] });
    await expect(callAnthropic(params)).rejects.toThrow("n'a pas renvoyé de réponse structurée");
  });
});
