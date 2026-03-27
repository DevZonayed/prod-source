/**
 * Voxel SDK Types
 *
 * Core type definitions for the Claude Code CLI bridge.
 */

import type { z } from "zod";

// ─── MCP Tool Definition ───

/**
 * A tool registered on the MCP server.
 * Uses the same signature as @anthropic-ai/claude-agent-sdk's `tool()`.
 */
export type McpToolDefinition<T extends z.ZodRawShape = z.ZodRawShape> = {
  name: string;
  description: string;
  schema: T;
  handler: (args: z.infer<z.ZodObject<T>>) => Promise<McpToolResult>;
};

export type McpToolResult = {
  content: Array<{ type: "text"; text: string } | { type: "image"; data: string; mimeType: string }>;
};

// ─── Skill ───

export type Skill = {
  name: string;
  content: string;
};

// ─── Query Options ───

export type QueryOptions = {
  /** System prompt (assembled by the SDK from your config) */
  systemPrompt: string;
  /** Model to use: "sonnet", "opus", "haiku", or a full model ID */
  model?: string;
  /** Maximum agentic turns before stopping */
  maxTurns?: number;
  /** Permission mode for tool execution */
  permissionMode?: "bypassPermissions" | "default";
  /** Whether to include partial (streaming) messages */
  includePartialMessages?: boolean;
  /** Extra allowed tools beyond MCP (e.g. "WebSearch", "WebFetch") */
  allowedBuiltinTools?: string[];
};

// ─── Stream Events ───

export type StreamEvent =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-delta"; toolCallId: string; inputTextDelta: string }
  | { type: "tool-input-available"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-output-available"; toolCallId: string; output: string }
  | { type: "start-step" }
  | { type: "finish-step" }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "finish"; text: string }
  | { type: "error"; message: string };

/** Callback for streaming events */
export type StreamHandler = (event: StreamEvent) => void;

// ─── SDK Configuration ───

export type VoxelSdkConfig = {
  /** Name for the MCP server (default: "voxel") */
  mcpServerName?: string;
  /** Default model (default: "sonnet") */
  defaultModel?: string;
  /** Default max turns (default: 200) */
  defaultMaxTurns?: number;
  /** Built-in CLI tools to allow alongside MCP tools */
  allowedBuiltinTools?: string[];
};
