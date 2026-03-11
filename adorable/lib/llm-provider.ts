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

const getProviderName = (override?: string): LlmProviderName => {
  const value = (override ?? process.env["LLM_PROVIDER"])?.toLowerCase().trim();
  if (value === "claude-code") return "claude-code";
  if (value === "anthropic" || value === "claude") return "anthropic";
  return "openai";
};

type StreamLlmResponseParams = {
  system: string;
  messages: UIMessage[];
  tools: ToolSet;
  apiKey?: string;
  providerOverride?: string;
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
) => {
  const provider = getProviderName(providerOverride);

  if (provider === "openai") {
    const openaiProvider = apiKey
      ? createOpenAI({ apiKey })
      : createOpenAI({});
    return openaiProvider.responses("gpt-5.2-codex");
  }

  let effectiveKey = apiKey;
  if (provider === "claude-code") {
    const token = await getClaudeAccessToken();
    if (!token) {
      throw new Error(
        "Claude Code is not authenticated. Please run 'claude auth login' or sign in from the app.",
      );
    }
    effectiveKey = token;
  }

  const anthropicProvider = effectiveKey
    ? createAnthropic({ apiKey: effectiveKey })
    : createAnthropic({});
  return anthropicProvider("claude-sonnet-4-20250514");
};

export const streamLlmResponse = async ({
  system,
  messages,
  tools,
  apiKey,
  providerOverride,
}: StreamLlmResponseParams): Promise<StreamLlmResponseResult> => {
  const provider = getProviderName(providerOverride);
  const modelMessages = await convertToModelMessages(messages);

  if (provider === "openai") {
    const openaiProvider = apiKey ? createOpenAI({ apiKey }) : createOpenAI({});
    const result = streamText({
      system,
      model: openaiProvider.responses("gpt-5.2-codex"),
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
  let effectiveKey = apiKey;

  if (provider === "claude-code") {
    const token = await getClaudeAccessToken();
    if (!token) {
      throw new Error(
        "Claude Code is not authenticated. Please run 'claude auth login' or sign in from the app.",
      );
    }
    effectiveKey = token;
  }

  const anthropicProvider = effectiveKey
    ? createAnthropic({ apiKey: effectiveKey })
    : createAnthropic({});
  const result = streamText({
    system,
    model: anthropicProvider("claude-sonnet-4-20250514"),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(100),
  });

  return {
    result,
    provider,
  };
};
