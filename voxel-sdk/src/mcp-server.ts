/**
 * MCP Server Builder
 *
 * Creates an in-process MCP server that registers tools dynamically.
 * Uses @anthropic-ai/claude-agent-sdk's createSdkMcpServer under the hood.
 */

import {
  tool as sdkTool,
  createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { McpToolResult } from "./types";

// ─── Tool Storage ───

type RegisteredTool = {
  name: string;
  description: string;
  schema: z.ZodRawShape;
  handler: (args: Record<string, unknown>) => Promise<McpToolResult>;
  category?: string;
};

/**
 * McpServer — Manages tools and creates an MCP server instance for the Agent SDK.
 *
 * Usage:
 *   const server = new McpServer("my-server");
 *   server.addTool("greet", "Say hello", { Name: z.string() }, async (args) => ({
 *     content: [{ type: "text", text: `Hello ${args.Name}!` }]
 *   }));
 *   const mcpInstance = server.build();
 *   // Pass mcpInstance to the QueryBridge
 */
export class McpServer {
  private name: string;
  private version: string;
  private tools: Map<string, RegisteredTool> = new Map();

  constructor(name: string, version = "1.0.0") {
    this.name = name;
    this.version = version;
  }

  /** Get the server name (used for tool name prefixing) */
  getName(): string {
    return this.name;
  }

  /**
   * Register a tool on the MCP server.
   *
   * @param name — Tool name (e.g. "view_file")
   * @param description — Tool description (shown to Claude as decision signal)
   * @param schema — Zod schema object for tool parameters
   * @param handler — Async function that executes the tool
   * @param category — Optional category for organization
   */
  addTool<T extends z.ZodRawShape>(
    name: string,
    description: string,
    schema: T,
    handler: (args: z.infer<z.ZodObject<T>>) => Promise<McpToolResult>,
    category?: string,
  ): this {
    this.tools.set(name, {
      name,
      description,
      schema,
      handler: handler as (args: Record<string, unknown>) => Promise<McpToolResult>,
      category,
    });
    return this;
  }

  /** Remove a tool by name */
  removeTool(name: string): boolean {
    return this.tools.delete(name);
  }

  /** Check if a tool exists */
  hasTool(name: string): boolean {
    return this.tools.has(name);
  }

  /** List all registered tool names */
  listTools(): Array<{ name: string; description: string; category?: string }> {
    return [...this.tools.values()].map((t) => ({
      name: t.name,
      description: t.description,
      category: t.category,
    }));
  }

  /** Get tool count */
  get size(): number {
    return this.tools.size;
  }

  /** Clear all tools */
  clear(): void {
    this.tools.clear();
  }

  /**
   * Generate a tool catalog string for embedding in system prompts.
   * Groups tools by category.
   */
  getCatalog(): string {
    const byCategory = new Map<string, RegisteredTool[]>();
    for (const tool of this.tools.values()) {
      const cat = tool.category ?? "General";
      const list = byCategory.get(cat) ?? [];
      list.push(tool);
      byCategory.set(cat, list);
    }

    const lines: string[] = [];
    for (const [category, tools] of byCategory) {
      lines.push(`**${category}:**`);
      for (const t of tools) {
        lines.push(`  ${t.name} — ${t.description.split("\n")[0]}`);
      }
      lines.push("");
    }
    return lines.join("\n");
  }

  /**
   * Get all tool names with the MCP prefix (for allowedTools).
   * Format: mcp__<serverName>__<toolName>
   */
  getAllowedToolNames(): string[] {
    return [...this.tools.keys()].map(
      (name) => `mcp__${this.name}__${name}`,
    );
  }

  /**
   * Build the MCP server instance for use with the Agent SDK's query().
   * This creates the actual server that handles tool execution.
   */
  build(): ReturnType<typeof createSdkMcpServer> {
    const toolDefs = [...this.tools.values()].map((t) =>
      sdkTool(t.name, t.description, t.schema, t.handler),
    );

    return createSdkMcpServer({
      name: this.name,
      version: this.version,
      tools: toolDefs,
    });
  }
}
