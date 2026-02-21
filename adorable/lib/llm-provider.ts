import { anthropic } from "@ai-sdk/anthropic";
import { openai, type OpenAIResponsesProviderOptions } from "@ai-sdk/openai";
import {
  stepCountIs,
  streamText,
  type UIMessage,
  type ToolSet,
  convertToModelMessages,
} from "ai";

type LlmProviderName = "openai" | "claude";

const getProviderName = (): LlmProviderName => {
  const value = process.env["LLM_PROVIDER"]?.toLowerCase().trim();
  if (value === "claude") return "claude";
  return "openai";
};

type StreamLlmResponseParams = {
  system: string;
  messages: UIMessage[];
  tools: ToolSet;
};

type StreamLlmResponseResult = {
  result: ReturnType<typeof streamText>;
  provider: LlmProviderName;
};

export const streamLlmResponse = async ({
  system,
  messages,
  tools,
}: StreamLlmResponseParams): Promise<StreamLlmResponseResult> => {
  const provider = getProviderName();
  const modelMessages = await convertToModelMessages(messages);

  if (provider === "openai") {
    const result = streamText({
      system,
      model: openai.responses("gpt-5.2-codex"),
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

  const result = streamText({
    system,
    model: anthropic("claude-sonnet-4-20250514"),
    messages: modelMessages,
    tools,
    stopWhen: stepCountIs(100),
  });

  return {
    result,
    provider,
  };
};
