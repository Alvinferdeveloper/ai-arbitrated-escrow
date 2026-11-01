import "server-only";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";

// Switching vendors is an env change; a vendor with its own SDK is a new PROVIDERS entry.

export type ModelProviderConfig = {
  provider: string;
  modelId: string;
  baseURL: string | undefined;
  apiKey: string | undefined;
  /** True when the endpoint accepts `response_format: json_schema`. */
  structuredOutputs: boolean;
};

export type ResolvedModel = {
  model: LanguageModel;
  modelId: string;
  structuredOutputs: boolean;
};

type ProviderFactory = (config: ModelProviderConfig) => LanguageModel;

const PROVIDERS: Record<string, ProviderFactory> = {
  // Any OpenAI Chat Completions endpoint (OpenAI, OpenRouter, Groq, Ollama, vLLM, ...).
  "openai-compatible": (config) => {
    if (!config.baseURL) {
      throw new Error("AI_BASE_URL is not set");
    }

    return createOpenAICompatible({
      name: "openai-compatible",
      baseURL: config.baseURL,
      apiKey: config.apiKey,
      supportsStructuredOutputs: config.structuredOutputs,
    }).chatModel(config.modelId);
  },
};

export function readModelProviderConfig(
  env: Record<string, string | undefined> = process.env,
): ModelProviderConfig {
  const modelId = env.AI_MODEL?.trim();
  if (!modelId) {
    throw new Error("AI_MODEL is not set");
  }

  return {
    provider: env.AI_PROVIDER?.trim() || "openai-compatible",
    modelId,
    baseURL: env.AI_BASE_URL?.trim() || undefined,
    apiKey: env.AI_API_KEY?.trim() || undefined,
    structuredOutputs: env.AI_STRUCTURED_OUTPUTS?.trim() !== "false",
  };
}

export function isModelConfigured(
  env: Record<string, string | undefined> = process.env,
): boolean {
  return Boolean(env.AI_MODEL?.trim() && env.AI_BASE_URL?.trim());
}

export function resolveModel(
  config: ModelProviderConfig = readModelProviderConfig(),
): ResolvedModel {
  const factory = PROVIDERS[config.provider];
  if (!factory) {
    throw new Error(
      `Unknown AI_PROVIDER "${config.provider}". Known: ${Object.keys(PROVIDERS).join(", ")}`,
    );
  }

  return {
    model: factory(config),
    modelId: config.modelId,
    structuredOutputs: config.structuredOutputs,
  };
}
