import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { createClaudeCodeFetch } from "@/lib/claude-fetch";

type LlmProviderName = "openai" | "anthropic" | "claude-code";

/* ------------------------------------------------------------------ */
/*  Model catalogues                                                    */
/* ------------------------------------------------------------------ */

export const OPENAI_MODELS = [
  { id: "gpt-5.2-codex", label: "GPT-5.2 Codex" },
  { id: "o4-mini", label: "o4-mini" },
  { id: "gpt-4.1", label: "GPT-4.1" },
  { id: "gpt-4.1-mini", label: "GPT-4.1 Mini" },
] as const;

export const ANTHROPIC_MODELS = [
  { id: "claude-sonnet-4-20250514", label: "Claude Sonnet 4" },
  { id: "claude-opus-4-20250514", label: "Claude Opus 4" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
] as const;

export const DEFAULT_OPENAI_MODEL = "gpt-5.2-codex";
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

const getProviderName = (override?: string): LlmProviderName => {
  const value = (override ?? process.env["LLM_PROVIDER"])?.toLowerCase().trim();
  if (value === "claude-code") return "claude-code";
  if (value === "anthropic" || value === "claude") return "anthropic";
  return "openai";
};

/** Resolve the model ID to use, falling back to the provider default. */
const resolveModel = (
  provider: LlmProviderName,
  modelOverride?: string,
): string => {
  if (modelOverride) return modelOverride;
  return provider === "openai" ? DEFAULT_OPENAI_MODEL : DEFAULT_ANTHROPIC_MODEL;
};

/**
 * Create an Anthropic provider instance.
 * For claude-code: uses a custom fetch that injects a fresh OAuth token per request.
 * For direct anthropic: uses the provided static API key.
 */
const createAnthropicProvider = (provider: LlmProviderName, apiKey?: string) => {
  if (provider === "claude-code") {
    // Custom fetch reads fresh OAuth token from ~/.claude/.credentials.json
    // on every HTTP call, auto-refreshes if expired, and adds oauth-2025-04-20 beta.
    return createAnthropic({
      apiKey: "placeholder-replaced-by-fetch", // custom fetch overrides x-api-key
      fetch: createClaudeCodeFetch(),
    });
  }

  return apiKey ? createAnthropic({ apiKey }) : createAnthropic({});
};

/**
 * Returns a model instance for the given provider.
 * Used by the CodeMine agentic loop to get the model without calling streamText directly.
 */
export const getModelForProvider = async (
  providerOverride?: string,
  apiKey?: string,
  modelOverride?: string,
) => {
  const provider = getProviderName(providerOverride);
  const modelId = resolveModel(provider, modelOverride);

  console.log("[LLM Provider] getModelForProvider:", JSON.stringify({
    provider,
    modelId,
    tokenSource: provider === "claude-code" ? "per-request-fetch" : (apiKey ? "passed-in" : "env"),
  }));

  if (provider === "openai") {
    const openaiProvider = apiKey
      ? createOpenAI({ apiKey })
      : createOpenAI({});
    return openaiProvider.responses(modelId);
  }

  const anthropicProvider = createAnthropicProvider(provider, apiKey);
  return anthropicProvider(modelId);
};
