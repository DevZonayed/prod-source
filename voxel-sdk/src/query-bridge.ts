/**
 * Query Bridge
 *
 * The core bridge between your application and the Claude Code CLI.
 * Wraps @anthropic-ai/claude-agent-sdk's query() function, handles
 * MCP server routing, streaming, and event parsing.
 */

import { query } from "@anthropic-ai/claude-agent-sdk";
import type { McpServer } from "./mcp-server";
import type { QueryOptions, StreamHandler, StreamEvent } from "./types";

// ─── Message Types ───

export type Message = {
  role: "user" | "assistant";
  content: string;
};

// ─── Query Bridge ───

export type QueryBridgeOptions = {
  /** The MCP server instance (built from McpServer.build()) */
  mcpServer: McpServer;
  /** Stream event handler (called for every event during execution) */
  onEvent?: StreamHandler;
};

/**
 * Strip MCP server prefix from tool name for clean display.
 * e.g. "mcp__voxel__view_file" → "view_file"
 */
function stripToolPrefix(name: string): string {
  return name.replace(/^mcp__[^_]+__/, "");
}

/**
 * Execute a query through the Claude Code CLI Agent SDK.
 *
 * This is the main entry point. It:
 * 1. Builds the MCP server from your registered tools
 * 2. Assembles the allowedTools list (MCP tools + optional built-in tools)
 * 3. Runs query() which invokes the Claude CLI binary with OAuth
 * 4. Streams events back to your handler
 * 5. Returns the collected assistant text
 *
 * @param messages — Conversation messages
 * @param options — Query options (system prompt, model, etc.)
 * @param bridgeOptions — MCP server and event handler
 * @returns The assistant's final text response
 */
export async function runQuery(
  messages: Message[],
  options: QueryOptions,
  bridgeOptions: QueryBridgeOptions,
): Promise<{ text: string; inputTokens: number; outputTokens: number }> {
  const { mcpServer, onEvent } = bridgeOptions;
  const emit = onEvent ?? (() => {});

  const serverName = mcpServer.getName();
  const mcpInstance = mcpServer.build();

  // Build allowed tools list: MCP tools + optional built-in CLI tools
  const allowedTools = [
    ...mcpServer.getAllowedToolNames(),
    ...(options.allowedBuiltinTools ?? []),
  ];

  // Build conversation prompt
  const conversationText = messages
    .map((m) => `${m.role === "user" ? "Human" : "Assistant"}: ${m.content}`)
    .join("\n\n");

  const sessionId = crypto.randomUUID();

  async function* generateMessages() {
    yield {
      type: "user" as const,
      message: { role: "user" as const, content: conversationText },
      parent_tool_use_id: null,
      session_id: sessionId,
    };
  }

  // State tracking
  let collectedText = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let currentTextId: string | null = null;
  let inStep = false;

  const activeToolCalls = new Map<
    number,
    { toolCallId: string; toolName: string; argsJson: string }
  >();
  const emittedToolCallIds = new Set<string>();

  const ensureStep = () => {
    if (!inStep) { emit({ type: "start-step" }); inStep = true; }
  };
  const endText = () => {
    if (currentTextId) { emit({ type: "text-end", id: currentTextId }); currentTextId = null; }
  };
  const endStep = () => {
    endText();
    if (inStep) { emit({ type: "finish-step" }); inStep = false; }
  };

  try {
    for await (const message of query({
      prompt: generateMessages(),
      options: {
        systemPrompt: options.systemPrompt,
        model: options.model ?? "sonnet",
        maxTurns: options.maxTurns ?? 200,
        mcpServers: { [serverName]: mcpInstance },
        allowedTools,
        tools: [],
        permissionMode: options.permissionMode ?? "bypassPermissions",
        includePartialMessages: options.includePartialMessages ?? true,
      },
    })) {
      // ─── Stream events ───
      if (message.type === "stream_event") {
        const event = message.event as Record<string, unknown>;
        const eventType = event.type as string;

        // Content block start
        if (eventType === "content_block_start") {
          const block = event.content_block as Record<string, unknown> | undefined;

          if (block?.type === "text") {
            ensureStep();
            currentTextId = crypto.randomUUID();
            emit({ type: "text-start", id: currentTextId });
          } else if (block?.type === "tool_use" || block?.type === "server_tool_use") {
            endText();
            ensureStep();
            const rawName = (block.name as string) || "unknown";
            const cleanName = stripToolPrefix(rawName);
            const toolCallId = (block.id as string) || crypto.randomUUID();
            const idx = typeof event.index === "number" ? event.index : -1;
            activeToolCalls.set(idx, { toolCallId, toolName: cleanName, argsJson: "" });
            emittedToolCallIds.add(toolCallId);
            emit({ type: "tool-input-start", toolCallId, toolName: cleanName });
          } else if (block?.type === "web_search_tool_result") {
            endText();
            ensureStep();
            const toolUseId = (block.tool_use_id as string) || "";
            const content = block.content;
            let resultText = "";
            if (Array.isArray(content)) {
              resultText = (content as Array<{ type?: string; title?: string; url?: string }>)
                .filter((r) => r.type === "search_result")
                .map((r) => `- ${r.title ?? ""}\n  ${r.url ?? ""}`)
                .join("\n");
            }
            if (toolUseId && emittedToolCallIds.has(toolUseId)) {
              emit({ type: "tool-output-available", toolCallId: toolUseId, output: resultText || "Search completed" });
            }
          }
        }

        // Content block delta
        if (eventType === "content_block_delta") {
          const delta = event.delta as Record<string, unknown> | undefined;
          if (delta?.type === "text_delta" && typeof delta.text === "string") {
            if (!currentTextId) {
              ensureStep();
              currentTextId = crypto.randomUUID();
              emit({ type: "text-start", id: currentTextId });
            }
            emit({ type: "text-delta", id: currentTextId, delta: delta.text });
            collectedText += delta.text;
          } else if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string") {
            const idx = typeof event.index === "number" ? event.index : -1;
            const tc = activeToolCalls.get(idx);
            if (tc) {
              tc.argsJson += delta.partial_json;
              emit({ type: "tool-input-delta", toolCallId: tc.toolCallId, inputTextDelta: delta.partial_json });
            }
          }
        }

        // Content block stop
        if (eventType === "content_block_stop") {
          if (currentTextId) {
            emit({ type: "text-end", id: currentTextId });
            currentTextId = null;
          }
          const stopIdx = typeof event.index === "number" ? event.index : -1;
          const stoppedTc = activeToolCalls.get(stopIdx);
          if (stoppedTc) {
            let parsedInput: unknown = {};
            try { parsedInput = JSON.parse(stoppedTc.argsJson || "{}"); } catch { /* */ }
            emit({ type: "tool-input-available", toolCallId: stoppedTc.toolCallId, toolName: stoppedTc.toolName, input: parsedInput });
            emit({ type: "tool-output-available", toolCallId: stoppedTc.toolCallId, output: "Completed" });
            activeToolCalls.delete(stopIdx);
          }
        }

        // Usage
        if (eventType === "message_delta") {
          const usage = event.usage as Record<string, number> | undefined;
          if (usage) {
            totalInputTokens += usage.input_tokens ?? 0;
            totalOutputTokens += usage.output_tokens ?? 0;
          }
        }

        // Message stop
        if (eventType === "message_stop") {
          endStep();
        }
      }

      // ─── Complete assistant message (fallback) ───
      if (message.type === "assistant") {
        const msg = message as Record<string, unknown>;
        const content = (msg.message as Record<string, unknown>)?.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            const b = block as Record<string, unknown>;
            if ((b.type === "tool_use" || b.type === "server_tool_use") && typeof b.name === "string") {
              const toolCallId = (b.id as string) || crypto.randomUUID();
              if (!emittedToolCallIds.has(toolCallId)) {
                endText();
                ensureStep();
                const cleanName = stripToolPrefix(b.name);
                emittedToolCallIds.add(toolCallId);
                emit({ type: "tool-input-start", toolCallId, toolName: cleanName });
                emit({ type: "tool-input-delta", toolCallId, inputTextDelta: JSON.stringify(b.input ?? {}) });
                emit({ type: "tool-input-available", toolCallId, toolName: cleanName, input: b.input ?? {} });
                emit({ type: "tool-output-available", toolCallId, output: "Completed" });
              }
            }
            if (b.type === "text" && typeof b.text === "string") {
              if (!collectedText.includes(b.text.slice(0, 50))) {
                collectedText += b.text;
              }
            }
          }
          endStep();
        }
      }

      // ─── Tool use summary ───
      if (message.type === "tool_use_summary") {
        const msg = message as Record<string, unknown>;
        const toolUseIds = msg.preceding_tool_use_ids as string[] | undefined;
        const summary = msg.summary as string | undefined;
        if (toolUseIds && summary) {
          for (const toolUseId of toolUseIds) {
            if (emittedToolCallIds.has(toolUseId)) {
              ensureStep();
              emit({ type: "tool-output-available", toolCallId: toolUseId, output: summary });
              endStep();
            }
          }
        }
      }

      // ─── Final result ───
      if (message.type === "result") {
        const msg = message as Record<string, unknown>;
        if (typeof msg.result === "string" && msg.result && !collectedText) {
          collectedText += msg.result;
        }
      }
    }

    endStep();
    emit({ type: "usage", inputTokens: totalInputTokens, outputTokens: totalOutputTokens });
    emit({ type: "finish", text: collectedText });

  } catch (err) {
    const errMsg = err instanceof Error ? err.message : "Query error";
    endStep();
    emit({ type: "error", message: errMsg });
  }

  return {
    text: collectedText,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
