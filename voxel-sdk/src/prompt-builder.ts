/**
 * Prompt Builder
 *
 * Assembles system prompts from components: identity, tool catalog,
 * custom instructions, and skills. Designed to be composable —
 * add or remove sections as needed.
 */

import type { Skill } from "./types";
import type { McpServer } from "./mcp-server";

export type PromptConfig = {
  /** Agent identity name */
  agentName?: string;
  /** Agent builder/creator */
  agentBuilder?: string;
  /** Core instructions for the agent's behavior */
  coreInstructions?: string;
  /** Additional custom instructions appended at the end */
  additionalInstructions?: string;
};

/**
 * Build a complete system prompt from components.
 *
 * @param config — Identity and instructions
 * @param mcpServer — MCP server (used to generate tool catalog)
 * @param skills — Optional skill content to embed
 * @returns Assembled system prompt string
 */
export function buildPrompt(
  config: PromptConfig,
  mcpServer?: McpServer,
  skills?: Skill[],
): string {
  const parts: string[] = [];

  // Identity
  const name = config.agentName ?? "Assistant";
  const builder = config.agentBuilder ?? "";
  parts.push(`<identity>`);
  parts.push(`You are ${name}${builder ? `, built by ${builder}` : ""}.`);
  parts.push(`</identity>`);
  parts.push("");

  // Core instructions
  if (config.coreInstructions) {
    parts.push(config.coreInstructions);
    parts.push("");
  }

  // Tool catalog (auto-generated from MCP server)
  if (mcpServer && mcpServer.size > 0) {
    parts.push("# Tool catalog");
    parts.push("");
    parts.push(mcpServer.getCatalog());
    parts.push("");
  }

  // Skills
  if (skills && skills.length > 0) {
    parts.push("<skills>");
    parts.push("These are expert knowledge modules. Follow their guidance when relevant.");
    parts.push("");
    for (const skill of skills) {
      parts.push(`<skill name="${skill.name}">`);
      parts.push(skill.content);
      parts.push(`</skill>`);
      parts.push("");
    }
    parts.push("</skills>");
    parts.push("");
  }

  // Additional instructions
  if (config.additionalInstructions) {
    parts.push(config.additionalInstructions);
  }

  return parts.join("\n");
}

/**
 * Load skills from an array of file paths or { name, content } objects.
 * Convenience function — you can also pass Skill[] directly to buildPrompt.
 */
export function loadSkillsFromFiles(
  ...files: Array<{ name: string; path: string }>
): Skill[] {
  const { readFileSync } = require("fs");
  const loaded: Skill[] = [];
  for (const { name, path } of files) {
    try {
      const content = readFileSync(path, "utf-8");
      loaded.push({ name, content });
    } catch {
      // Skip missing files
    }
  }
  return loaded;
}
