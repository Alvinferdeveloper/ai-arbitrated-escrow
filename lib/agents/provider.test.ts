import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { isModelConfigured, readModelProviderConfig, resolveModel } = await import(
  "./provider"
);

describe("model provider config", () => {
  it("defaults to the OpenAI-compatible provider with structured outputs", () => {
    const config = readModelProviderConfig({
      AI_MODEL: "vision-model",
      AI_BASE_URL: "https://llm.example.com/v1",
      AI_API_KEY: "key",
    });

    expect(config).toEqual({
      provider: "openai-compatible",
      modelId: "vision-model",
      baseURL: "https://llm.example.com/v1",
      apiKey: "key",
      structuredOutputs: true,
    });
  });

  it("turns structured outputs off only when asked", () => {
    const config = readModelProviderConfig({
      AI_MODEL: "vision-model",
      AI_STRUCTURED_OUTPUTS: "false",
    });

    expect(config.structuredOutputs).toBe(false);
  });

  it("requires a model id", () => {
    expect(() => readModelProviderConfig({})).toThrow("AI_MODEL is not set");
  });

  it("is configured only with a model and a base URL", () => {
    expect(isModelConfigured({ AI_MODEL: "m" })).toBe(false);
    expect(isModelConfigured({ AI_MODEL: "m", AI_BASE_URL: "https://x" })).toBe(true);
  });

  it("rejects an unknown provider", () => {
    expect(() =>
      resolveModel(
        readModelProviderConfig({ AI_MODEL: "m", AI_PROVIDER: "nobody" }),
      ),
    ).toThrow('Unknown AI_PROVIDER "nobody"');
  });

  it("builds a model without a network call", () => {
    const resolved = resolveModel(
      readModelProviderConfig({
        AI_MODEL: "vision-model",
        AI_BASE_URL: "https://llm.example.com/v1",
      }),
    );

    expect(resolved.modelId).toBe("vision-model");
    expect(resolved.structuredOutputs).toBe(true);
  });
});
