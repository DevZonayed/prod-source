/**
 * Voxel SDK
 *
 * A bridge to the Claude Code CLI via the Agent SDK.
 * Provides MCP server management, prompt composition, OAuth auth,
 * and streaming query execution.
 *
 * Usage:
 *   import { McpServer, runQuery, buildPrompt } from "voxel-sdk";
 *
 *   const server = new McpServer("my-tools");
 *   server.addTool("greet", "Say hello", { Name: z.string() }, async (args) => ({
 *     content: [{ type: "text", text: `Hello ${args.Name}!` }]
 *   }));
 *
 *   const prompt = buildPrompt({ agentName: "My Agent" }, server);
 *   const result = await runQuery(messages, { systemPrompt: prompt }, { mcpServer: server });
 */

// MCP Server — create and manage tools
export { McpServer } from "./mcp-server";

// Query Bridge — execute queries through Claude Code CLI
export { runQuery, type Message, type QueryBridgeOptions } from "./query-bridge";

// Prompt Builder — compose system prompts
export { buildPrompt, loadSkillsFromFiles, type PromptConfig } from "./prompt-builder";

// Auth — Claude Code CLI OAuth management
export {
  getValidToken,
  getAccessToken,
  getAuthStatus,
  isCliInstalled,
} from "./auth";

// Types
export type {
  McpToolDefinition,
  McpToolResult,
  Skill,
  QueryOptions,
  StreamEvent,
  StreamHandler,
  VoxelSdkConfig,
} from "./types";
