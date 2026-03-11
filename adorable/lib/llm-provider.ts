import { createAnthropic } from "@ai-sdk/anthropic";
import {
  createOpenAI,
  type OpenAIResponsesProviderOptions,
} from "@ai-sdk/openai";
import {
  stepCountIs,
  streamText,
  type UIMessage,
  type ToolSet,
  convertToModelMessages,
} from "ai";
import { getClaudeAccessToken } from "@/lib/claude-auth";

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

type StreamLlmResponseParams = {
  system: string;
  messages: UIMessage[];
  tools: ToolSet;
  apiKey?: string;
  providerOverride?: string;
  modelOverride?: string;
};

type StreamLlmResponseResult = {
  result: ReturnType<typeof streamText>;
  provider: LlmProviderName;
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
    hasApiKeyArg: !!apiKey,
    apiKeyArgPrefix: apiKey ? apiKey.slice(0, 15) + "..." : null,
  }));

  if (provider === "openai") {
    const openaiProvider = apiKey
      ? createOpenAI({ apiKey })
      : createOpenAI({});
    return openaiProvider.responses(modelId);
  }

  // When apiKey is passed (e.g. from route.ts with a pre-fetched token), use it directly.
  // Only re-read from disk as a fallback when no apiKey was provided.
  let effectiveKey = apiKey;
  if (!effectiveKey && provider === "claude-code") {
    const token = await getClaudeAccessToken();
    if (!token) {
      throw new Error(
        "Claude Code is not authenticated. Please run 'claude auth login' or sign in from the app.",
      );
    }
    effectiveKey = token;
  }

  console.log("[LLM Provider] Anthropic config:", JSON.stringify({
    provider,
    modelId,
    hasEffectiveKey: !!effectiveKey,
    keyPrefix: effectiveKey ? effectiveKey.slice(0, 20) + "..." : null,
    keyLength: effectiveKey?.length ?? 0,
    keySource: apiKey ? "passed-in" : "re-fetched",
  }));

  const anthropicProvider = effectiveKey
    ? createAnthropic({ apiKey: effectiveKey })
    : createAnthropic({});
  return anthropicProvider(modelId);
};

export const streamLlmResponse = async ({
  system,
  messages,
  tools,
  apiKey,
  providerOverride,
  modelOverride,
}: StreamLlmResponseParams): Promise<StreamLlmResponseResult> => {
  const provider = getProviderName(providerOverride);
  const modelId = resolveModel(provider, modelOverride);
  const modelMessages = await convertToModelMessages(messages);

  if (provider === "openai") {
    const openaiProvider = apiKey ? createOpenAI({ apiKey }) : createOpenAI({});
    const result = streamText({
      system,
      model: openaiProvider.responses(modelId),
      messages: modelMessages,
      tools,
      providerOptions: {
        openai: {
          reasoningEffort: "low",
        } satisfies OpenAIResponsesProviderOptions,
      },
      stopWhen: stepCountIs(100),
    });

    return {
      result,
      provider,
    };
  }

  // Claude Code OAuth tokens (sk-ant-oat01-*) work as x-api-key on Anthropic's API.
  // Use passed-in apiKey directly; only re-read from disk as fallback.
  let effectiveKey = apiKey;

  if (!effectiveKey && provider === "claude-code") {
    const token = await getClaudeAccessToken();
    if (!token) {
      throw new Error(
        "Claude Code is not authenticated. Please run 'claude auth login' or sign in from the app.",
      );
    }
    effectiveKey = token;
  }

  console.log("[LLM Provider] streamLlmResponse Anthropic config:", JSON.stringify({
    provider,
    modelId,
    hasEffectiveKey: !!effectiveKey,
    keyPrefix: effectiveKey ? effectiveKey.slice(0, 20) + "..." : null,
    keyLength: effectiveKey?.length ?? 0,
  }));

  const anthropicProvider = effectiveKey
    ? createAnthropic({ apiKey: effectiveKey })
    : createAnthropic({});
  const result = streamText({
    system,
    model: anthropicProvider(modelId),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(100),
  });

  return {
    result,
    provider,
  };
};
