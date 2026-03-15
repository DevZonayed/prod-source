/**
 * Claude Engine — Raw API Connection Layer
 *
 * Stripped from cli.js v2.1.76: no hardcoded prompts, no built-in tools.
 * Pure connection + streaming + tool execution loop.
 *
 * YOU provide: system prompt, tools (with schemas), messages.
 * Engine handles: auth, streaming, tool loop, retries.
 *
 * Supports:
 *   - API Key auth (ANTHROPIC_API_KEY)
 *   - OAuth auth (Claude Code credentials)
 *   - Streaming with SSE event processing
 *   - Automatic tool execution loop (up to maxTurns)
 *   - Thinking/extended thinking
 *   - Compatible with Vercel AI SDK UI stream
 */

import Anthropic from "@anthropic-ai/sdk";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
} from "ai";
import { getValidToken } from "./claude-auth";

// ─── Types ───

export type ToolSchema = {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
};

export type ToolExecutor = (
  name: string,
  input: Record<string, unknown>,
) => Promise<string | { type: "text"; text: string }[]>;

export type ClaudeEngineConfig = {
  /** Your custom system prompt — the ONLY prompt sent to the model */
  systemPrompt: string;
  /** Your custom tools with Anthropic-format schemas */
  tools: ToolSchema[];
  /** Function that executes tool calls and returns results */
  toolExecutor: ToolExecutor;
  /** Conversation messages in Anthropic format */
  messages: Anthropic.MessageParam[];
  /** Model ID (default: claude-sonnet-4-20250514) */
  model?: string;
  /** Max output tokens (default: 16384) */
  maxTokens?: number;
  /** Max tool execution turns before stopping (default: 200) */
  maxTurns?: number;
  /** Thinking config: "adaptive" | "disabled" | { budget: number } */
  thinking?: "adaptive" | "disabled" | { budget: number };
  /** Temperature (only when thinking is disabled) */
  temperature?: number;
  /** Auth mode: "api-key" uses ANTHROPIC_API_KEY, "oauth" uses Claude Code OAuth */
  auth?: "api-key" | "oauth";
  /** Direct API key (overrides env) */
  apiKey?: string;
  /** Abort signal */
  signal?: AbortSignal;
  /** Called on each streamed text delta */
  onTextDelta?: (text: string) => void;
  /** Called when a tool is about to be executed */
  onToolCall?: (name: string, input: Record<string, unknown>) => void;
  /** Called on each completed turn with usage stats */
  onTurnComplete?: (turn: number, usage: TokenUsage) => void;
};

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
};

export type ClaudeEngineResult = {
  /** Final text response */
  text: string;
  /** All content blocks from the final message */
  content: Anthropic.ContentBlock[];
  /** Stop reason */
  stopReason: string;
  /** Total usage across all turns */
  usage: TokenUsage;
  /** Number of turns taken */
  turns: number;
  /** Full message history (for continuation) */
  messages: Anthropic.MessageParam[];
};

// ─── Auth Helpers ───

const CLI_VERSION = "2.1.76";

/**
 * Creates an Anthropic client with the appropriate auth.
 * Mirrors cli.js auth patterns exactly.
 */
async function createClient(
  auth: "api-key" | "oauth" = "api-key",
  apiKey?: string,
): Promise<Anthropic> {
  if (auth === "oauth") {
    const token = await getValidToken();
    return new Anthropic({
      apiKey: "placeholder", // overridden by custom headers
      defaultHeaders: {
        Authorization: `Bearer ${token}`,
        "anthropic-beta": "oauth-2025-04-20",
        "User-Agent": `claude-cli/${CLI_VERSION} (external, voxel-engine)`,
      },
    });
  }

  // API key auth
  const key = apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!key) {
    throw new Error(
      "No ANTHROPIC_API_KEY found. Set it in env or pass apiKey directly.",
    );
  }
  return new Anthropic({ apiKey: key });
}

// ─── Thinking Config Builder ───

function buildThinkingConfig(
  thinking?: ClaudeEngineConfig["thinking"],
): Anthropic.ThinkingConfigParam | undefined {
  if (!thinking || thinking === "disabled") return undefined;
  if (thinking === "adaptive") return { type: "enabled", budget_tokens: 8192 };
  return { type: "enabled", budget_tokens: thinking.budget };
}

// ─── Core: Single Turn (non-streaming) ───

/**
 * Send a single turn to Claude and get the response.
 * No tool loop — returns the raw message.
 */
export async function queryClaude(
  config: Omit<ClaudeEngineConfig, "toolExecutor" | "maxTurns">,
): Promise<Anthropic.Message> {
  const client = await createClient(config.auth, config.apiKey);

  const params: Anthropic.MessageCreateParams = {
    model: config.model ?? "claude-sonnet-4-20250514",
    max_tokens: config.maxTokens ?? 16384,
    system: config.systemPrompt,
    messages: config.messages,
    tools: config.tools as Anthropic.Tool[],
  };

  const thinking = buildThinkingConfig(config.thinking);
  if (thinking) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (params as any).thinking = thinking;
  }

  if (config.temperature !== undefined && !thinking) {
    params.temperature = config.temperature;
  }

  return client.messages.create(params);
}

// ─── Core: Streaming with Tool Loop ───

/**
 * Run the full Claude interaction loop:
 *   1. Send messages + system prompt + tools to API
 *   2. Stream response
 *   3. If model calls tools → execute them → send results → loop
 *   4. Continue until end_turn or maxTurns
 *
 * This is the equivalent of cli.js's mGq() + Yh() functions,
 * stripped of all hardcoded prompts and tools.
 */
export async function runClaudeEngine(
  config: ClaudeEngineConfig,
): Promise<ClaudeEngineResult> {
  const client = await createClient(config.auth, config.apiKey);
  const model = config.model ?? "claude-sonnet-4-20250514";
  const maxTokens = config.maxTokens ?? 16384;
  const maxTurns = config.maxTurns ?? 200;
  const thinking = buildThinkingConfig(config.thinking);

  // Mutable message history
  const messages: Anthropic.MessageParam[] = [...config.messages];

  // Accumulate usage
  const totalUsage: TokenUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationTokens: 0,
    cacheReadTokens: 0,
  };

  let finalText = "";
  let finalContent: Anthropic.ContentBlock[] = [];
  let stopReason = "end_turn";
  let turn = 0;

  while (turn < maxTurns) {
    turn++;

    // Build request
    const params: Anthropic.MessageCreateParamsStreaming = {
      model,
      max_tokens: maxTokens,
      system: config.systemPrompt,
      messages,
      tools: config.tools as Anthropic.Tool[],
      stream: true,
    };

    if (thinking) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (params as any).thinking = thinking;
    }

    if (config.temperature !== undefined && !thinking) {
      params.temperature = config.temperature;
    }

    // Stream the response
    const stream = client.messages.stream(params, {
      signal: config.signal,
    });

    const response = await stream.finalMessage();

    // Accumulate usage
    totalUsage.inputTokens += response.usage.input_tokens;
    totalUsage.outputTokens += response.usage.output_tokens;
    if ("cache_creation_input_tokens" in response.usage) {
      totalUsage.cacheCreationTokens +=
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response.usage as any).cache_creation_input_tokens ?? 0;
    }
    if ("cache_read_input_tokens" in response.usage) {
      totalUsage.cacheReadTokens +=
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response.usage as any).cache_read_input_tokens ?? 0;
    }

    // Fire text deltas
    const textBlocks = response.content.filter(
      (b): b is Anthropic.TextBlock => b.type === "text",
    );
    for (const block of textBlocks) {
      config.onTextDelta?.(block.text);
    }

    // Fire turn complete
    config.onTurnComplete?.(turn, { ...totalUsage });

    finalContent = response.content as Anthropic.ContentBlock[];
    finalText = textBlocks.map((b) => b.text).join("\n");
    stopReason = response.stop_reason ?? "end_turn";

    // Add assistant message to history
    messages.push({ role: "assistant", content: response.content });

    // If no tool use, we're done
    if (response.stop_reason !== "tool_use") {
      break;
    }

    // Execute tool calls
    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    const toolResults: Anthropic.ToolResultBlockParam[] = [];

    for (const toolCall of toolUseBlocks) {
      config.onToolCall?.(toolCall.name, toolCall.input as Record<string, unknown>);

      try {
        const result = await config.toolExecutor(
          toolCall.name,
          toolCall.input as Record<string, unknown>,
        );

        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: typeof result === "string" ? result : result,
        });
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Tool execution failed";
        toolResults.push({
          type: "tool_result",
          tool_use_id: toolCall.id,
          content: `Error: ${errorMsg}`,
          is_error: true,
        });
      }
    }

    // Add tool results to history
    messages.push({ role: "user", content: toolResults });
  }

  return {
    text: finalText,
    content: finalContent,
    stopReason,
    usage: totalUsage,
    turns: turn,
    messages,
  };
}

// ─── Streaming UI Response (for Next.js API routes) ───

/**
 * Run Claude Engine and return a streaming Response compatible with
 * Vercel AI SDK's useChat / useAssistant on the frontend.
 *
 * Drop-in replacement for streamText(...).toUIMessageStreamResponse()
 */
export function createClaudeEngineStreamResponse(
  config: ClaudeEngineConfig,
): Response {
  const messageId = crypto.randomUUID();

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const client = await createClient(config.auth, config.apiKey);
      const model = config.model ?? "claude-sonnet-4-20250514";
      const maxTokens = config.maxTokens ?? 16384;
      const maxTurns = config.maxTurns ?? 200;
      const thinking = buildThinkingConfig(config.thinking);

      const messages: Anthropic.MessageParam[] = [...config.messages];
      const totalUsage: TokenUsage = {
        inputTokens: 0,
        outputTokens: 0,
        cacheCreationTokens: 0,
        cacheReadTokens: 0,
      };

      let turn = 0;

      while (turn < maxTurns) {
        turn++;

        const params: Anthropic.MessageCreateParamsStreaming = {
          model,
          max_tokens: maxTokens,
          system: config.systemPrompt,
          messages,
          tools: config.tools as Anthropic.Tool[],
          stream: true,
        };

        if (thinking) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (params as any).thinking = thinking;
        }
        if (config.temperature !== undefined && !thinking) {
          params.temperature = config.temperature;
        }

        // Stream the response with real-time text deltas to the UI
        const apiStream = client.messages.stream(params, {
          signal: config.signal,
        });

        const textId = crypto.randomUUID();
        let hasStartedText = false;

        // Process SSE events
        apiStream.on("text", (text) => {
          if (!hasStartedText) {
            writer.write({ type: "start-step" });
            writer.write({ type: "text-start", id: textId });
            hasStartedText = true;
          }
          writer.write({ type: "text-delta", id: textId, delta: text });
        });

        // Wait for the full message
        const response = await apiStream.finalMessage();

        // Close text block if opened
        if (hasStartedText) {
          writer.write({ type: "text-end", id: textId });
          writer.write({ type: "finish-step" });
        }

        // Accumulate usage
        totalUsage.inputTokens += response.usage.input_tokens;
        totalUsage.outputTokens += response.usage.output_tokens;
        if ("cache_creation_input_tokens" in response.usage) {
          totalUsage.cacheCreationTokens +=
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response.usage as any).cache_creation_input_tokens ?? 0;
        }
        if ("cache_read_input_tokens" in response.usage) {
          totalUsage.cacheReadTokens +=
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (response.usage as any).cache_read_input_tokens ?? 0;
        }

        config.onTurnComplete?.(turn, { ...totalUsage });

        // Add assistant message to history
        messages.push({ role: "assistant", content: response.content });

        // If no tool use, we're done
        if (response.stop_reason !== "tool_use") {
          break;
        }

        // Execute tool calls
        const toolUseBlocks = response.content.filter(
          (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
        );

        const toolResults: Anthropic.ToolResultBlockParam[] = [];

        for (const toolCall of toolUseBlocks) {
          config.onToolCall?.(toolCall.name, toolCall.input as Record<string, unknown>);

          try {
            const result = await config.toolExecutor(
              toolCall.name,
              toolCall.input as Record<string, unknown>,
            );
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: typeof result === "string" ? result : result,
            });
          } catch (err) {
            const errorMsg =
              err instanceof Error ? err.message : "Tool execution failed";
            toolResults.push({
              type: "tool_result",
              tool_use_id: toolCall.id,
              content: `Error: ${errorMsg}`,
              is_error: true,
            });
          }
        }

        // Add tool results to history
        messages.push({ role: "user", content: toolResults });
      }

      // Final finish event with usage
      writer.write({
        type: "finish",
        finishReason: "stop",
        messageMetadata: {
          steps: [
            {
              usage: {
                inputTokens: totalUsage.inputTokens,
                outputTokens: totalUsage.outputTokens,
              },
            },
          ],
        },
      });
    },
    generateId: () => messageId,
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Message-Id": messageId },
  });
}

// ─── Utility: Convert UIMessages to Anthropic format ───

type UIMessageLike = {
  role: "user" | "assistant" | "system";
  parts?: Array<{ type: string; text?: string; [key: string]: unknown }>;
  content?: string;
};

/**
 * Convert Vercel AI SDK UIMessages to Anthropic MessageParam format.
 * Use this to bridge your frontend chat to Claude Engine.
 */
export function uiMessagesToAnthropic(
  messages: UIMessageLike[],
): Anthropic.MessageParam[] {
  const result: Anthropic.MessageParam[] = [];

  for (const msg of messages) {
    if (msg.role === "system") continue; // system prompt is separate

    const textParts = msg.parts
      ?.filter((p) => p.type === "text" && p.text)
      .map((p) => p.text!)
      .filter(Boolean);

    const text = textParts?.join("\n") || msg.content || "";
    if (!text) continue;

    result.push({
      role: msg.role === "user" ? "user" : "assistant",
      content: text,
    });
  }

  return result;
}
