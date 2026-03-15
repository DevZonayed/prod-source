/**
 * Claude CLI LLM Provider
 *
 * Uses the Claude Code CLI binary (`claude --print`) as the LLM backend.
 * This is the ONLY way to use Claude Code OAuth tokens — Anthropic restricts
 * OAuth API access to the official Claude Code binary (verified by curl tests:
 * both x-api-key and Authorization:Bearer with OAuth tokens return 401/500).
 *
 * How --system-prompt works in cli.js v2.1.76:
 *
 *   cli.js cg() function has a priority chain:
 *     1. overrideSystemPrompt  → (internal only, not from CLI)
 *     2. customSystemPrompt    → from --system-prompt / --system-prompt-file
 *                                 ** REPLACES entire default prompt **
 *     3. defaultSystemPrompt   → "You are Claude Code..." (used if no custom)
 *     4. appendSystemPrompt    → from --append-system-prompt (always appended)
 *
 *   So --system-prompt-file REPLACES "You are Claude Code..." entirely.
 *   We write the prompt to a temp file to avoid shell arg length limits.
 */

import { spawn, type ChildProcess } from "child_process";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

// ─── Types ───

type ClaudeCliResponse = {
  type: "result";
  subtype: "success" | "error";
  result: string;
  duration_ms: number;
  total_cost_usd: number;
  session_id: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens: number;
    cache_read_input_tokens: number;
  };
};

type StreamEvent = {
  type: string;
  subtype?: string;
  content_block?: { type: string; text?: string };
  delta?: { type: string; text?: string };
  result?: string;
  session_id?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
};

// ─── Constants ───

/**
 * Allowed tools for the CLI session.
 * Only include tools that are useful for operating on the VM.
 * This drastically reduces token overhead (~7k tokens for tool schemas
 * instead of ~30k+ for all CLI tools).
 *
 * CLI tool names from cli.js v2.1.76:
 * - Read, Edit, Write: file operations
 * - Bash: shell commands
 * - Glob, Grep: file search
 * - LS: directory listing
 */
const ALLOWED_TOOLS = [
  "Read",
  "Edit",
  "Write",
  "Bash",
  "Glob",
  "Grep",
  "LS",
];

// ─── Helpers ───

/**
 * Build conversation context from UIMessages for the CLI.
 * Formats all messages into a structured conversation so the model has full context.
 */
function buildConversationPrompt(messages: UIMessage[]): string {
  const parts: string[] = [];

  for (const msg of messages) {
    const role = msg.role === "user" ? "Human" : "Assistant";
    const textParts = msg.parts
      ?.filter((p) => p.type === "text")
      .map((p) => ("text" in p ? p.text : ""))
      .filter(Boolean);

    if (textParts && textParts.length > 0) {
      parts.push(`${role}: ${textParts.join("\n")}`);
    }
  }

  return parts.join("\n\n");
}

/**
 * Extract total usage from CLI response.
 */
function extractUsage(usage?: ClaudeCliResponse["usage"]) {
  return {
    inputTokens:
      (usage?.input_tokens ?? 0) +
      (usage?.cache_creation_input_tokens ?? 0) +
      (usage?.cache_read_input_tokens ?? 0),
    outputTokens: usage?.output_tokens ?? 0,
  };
}

/**
 * Write the system prompt to a temp file and return args using --system-prompt-file.
 *
 * Why a file instead of --system-prompt:
 *   - Shell arg length limits can silently truncate large prompts
 *   - --system-prompt-file maps to the same customSystemPrompt in cli.js cg()
 *   - cg() logic: if customSystemPrompt is set, it REPLACES the entire default
 *     ("You are Claude Code...") — no CLI identity, no environment, no CLAUDE.md
 */
async function buildBaseArgs(options?: {
  systemPrompt?: string;
  model?: string;
  maxTurns?: number;
  allowedTools?: string[];
  systemPromptFile?: string; // path to temp file (set internally)
}): Promise<{ args: string[]; cleanupFile?: string }> {
  const maxTurns = options?.maxTurns ?? 200;

  const args = [
    "--print",
    "--model", options?.model ?? "sonnet",
    "--max-turns", String(maxTurns),
    "--no-session-persistence",
    "--disable-slash-commands",
    // Block ALL MCP servers and plugins from loading.
    // Without this, plugins from ~/.claude/settings.json (Excalidraw, superpowers, etc.)
    // inject their tools and prompts even when --system-prompt-file is used.
    "--strict-mcp-config",
    "--mcp-config", '{"mcpServers":{}}',
  ];

  let cleanupFile: string | undefined;

  // Write system prompt to temp file → --system-prompt-file
  // This REPLACES the CLI's entire default identity prompt via cg()
  if (options?.systemPrompt) {
    const promptFile = join("/tmp", `voxel-prompt-${crypto.randomUUID()}.txt`);
    await writeFile(promptFile, options.systemPrompt, "utf-8");
    args.push("--system-prompt-file", promptFile);
    cleanupFile = promptFile;

    console.log("[ClaudeCLI] System prompt written to file:", {
      path: promptFile,
      length: options.systemPrompt.length,
      preview: options.systemPrompt.slice(0, 200) + "...",
    });
  }

  // --allowed-tools restricts which tools are loaded.
  const tools = options?.allowedTools ?? ALLOWED_TOOLS;
  if (tools.length > 0) {
    args.push("--allowed-tools", tools.join(","));
  }

  return { args, cleanupFile };
}

/**
 * Spawn options for the CLI process.
 * Uses /tmp as cwd to prevent the CLI from scanning the server's project
 * directory, loading CLAUDE.md, and confusing the model with the host codebase.
 */
function getCliSpawnOptions() {
  return {
    stdio: ["pipe", "pipe", "pipe"] as ["pipe", "pipe", "pipe"],
    timeout: 10 * 60_000,
    // Use /tmp as cwd to prevent CLI from scanning the server's project dir,
    // loading CLAUDE.md, and confusing the model with the host codebase.
    cwd: "/tmp",
    env: {
      ...process.env,
      // Disable nonessential traffic (telemetry, etc.) to reduce latency
      CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: "1",
      // Disable built-in agents (code-review, build-verify, etc.)
      // so they don't inject their prompts/tools
      CLAUDE_AGENT_SDK_DISABLE_BUILTIN_AGENTS: "1",
      // Use simple mode — no plugins, no MCP, no agents
      CLAUDE_CODE_SIMPLE: "1",
    },
  };
}

// ─── Core: Query Claude CLI (non-streaming) ───

async function queryClaudeCli(
  prompt: string,
  options?: {
    systemPrompt?: string;
    model?: string;
    maxTurns?: number;
  },
): Promise<{
  text: string;
  usage: { inputTokens: number; outputTokens: number };
}> {
  const { args, cleanupFile } = await buildBaseArgs(options);
  const fullArgs = [...args, "--output-format", "json"];

  return new Promise((resolve, reject) => {
    const child = spawn("claude", fullArgs, getCliSpawnOptions());

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    child.stdin.write(prompt);
    child.stdin.end();

    child.on("close", (code) => {
      // Cleanup temp prompt file
      if (cleanupFile) unlink(cleanupFile).catch(() => {});

      console.log("[ClaudeCLI] Process exit:", code, "stdout:", stdout.length);

      if (code !== 0) {
        console.error("[ClaudeCLI] stderr:", stderr.slice(0, 500));
        reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 300)}`));
        return;
      }

      try {
        const response: ClaudeCliResponse = JSON.parse(stdout);
        if (response.subtype === "error") {
          reject(new Error(`Claude CLI error: ${response.result}`));
          return;
        }
        resolve({
          text: response.result,
          usage: extractUsage(response.usage),
        });
      } catch {
        resolve({
          text: stdout.trim(),
          usage: { inputTokens: 0, outputTokens: 0 },
        });
      }
    });

    child.on("error", (err) => {
      if (cleanupFile) unlink(cleanupFile).catch(() => {});
      reject(new Error(`Failed to spawn claude: ${err.message}`));
    });
  });
}

// ─── Core: Streaming CLI Response ───

async function spawnStreamingCli(
  prompt: string,
  options?: {
    systemPrompt?: string;
    model?: string;
    maxTurns?: number;
  },
): Promise<{ child: ChildProcess; cleanupFile?: string }> {
  const { args, cleanupFile } = await buildBaseArgs(options);
  const fullArgs = [
    ...args,
    "--output-format", "stream-json",
    "--verbose",
  ];

  console.log("[ClaudeCLI] Spawning with args:", fullArgs.filter(a => !a.startsWith("/tmp/")).join(" "));

  const child = spawn("claude", fullArgs, getCliSpawnOptions());

  child.stdin.write(prompt);
  child.stdin.end();

  return { child, cleanupFile };
}

// ─── Public API ───

/**
 * Create a streaming UI Message Stream response using the Claude CLI.
 *
 * Features:
 * - Full system prompt (replaces CLI's default identity via --system-prompt)
 * - Restricted tool set via --allowed-tools (reduces ~20k token overhead)
 * - Full conversation history passed as context
 * - Streaming via --output-format stream-json with json fallback
 * - maxTurns=200 matching CLI default
 */
export function createClaudeCliStreamResponse(
  messages: UIMessage[],
  options?: {
    systemPrompt?: string;
    model?: string;
    conversationId?: string;
    maxTurns?: number;
  },
): Response {
  const messageId = crypto.randomUUID();
  const prompt = buildConversationPrompt(messages);

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      const textId = crypto.randomUUID();
      let totalInputTokens = 0;
      let totalOutputTokens = 0;
      let hasStartedText = false;
      let streamingWorked = false;

      try {
        // Try streaming mode first
        const { child, cleanupFile } = await spawnStreamingCli(prompt, options);
        let buffer = "";

        await new Promise<void>((resolve, reject) => {
          child.stdout!.on("data", (data: Buffer) => {
            buffer += data.toString();

            // Process complete JSONL lines
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed) continue;

              let event: StreamEvent;
              try {
                event = JSON.parse(trimmed);
              } catch {
                continue;
              }

              if (event.type === "assistant" && event.subtype === "text") {
                const text = event.content_block?.text ?? event.delta?.text ?? "";
                if (text) {
                  if (!hasStartedText) {
                    writer.write({ type: "start-step" });
                    writer.write({ type: "text-start", id: textId });
                    hasStartedText = true;
                  }
                  writer.write({ type: "text-delta", id: textId, delta: text });
                  streamingWorked = true;
                }
              } else if (event.type === "result") {
                if (event.usage) {
                  totalInputTokens = extractUsage(event.usage as ClaudeCliResponse["usage"]).inputTokens;
                  totalOutputTokens = extractUsage(event.usage as ClaudeCliResponse["usage"]).outputTokens;
                }
                if (!streamingWorked && event.result) {
                  if (!hasStartedText) {
                    writer.write({ type: "start-step" });
                    writer.write({ type: "text-start", id: textId });
                    hasStartedText = true;
                  }
                  writer.write({ type: "text-delta", id: textId, delta: event.result });
                }
              }
            }
          });

          let stderr = "";
          child.stderr!.on("data", (data: Buffer) => {
            stderr += data.toString();
          });

          child.on("close", (code) => {
            // Cleanup temp prompt file
            if (cleanupFile) unlink(cleanupFile).catch(() => {});

            if (buffer.trim()) {
              try {
                const event: StreamEvent = JSON.parse(buffer.trim());
                if (event.type === "result" && event.result && !streamingWorked) {
                  if (!hasStartedText) {
                    writer.write({ type: "start-step" });
                    writer.write({ type: "text-start", id: textId });
                    hasStartedText = true;
                  }
                  writer.write({ type: "text-delta", id: textId, delta: event.result });
                }
                if (event.usage) {
                  totalInputTokens = extractUsage(event.usage as ClaudeCliResponse["usage"]).inputTokens;
                  totalOutputTokens = extractUsage(event.usage as ClaudeCliResponse["usage"]).outputTokens;
                }
              } catch {
                if (!hasStartedText && buffer.trim()) {
                  writer.write({ type: "start-step" });
                  writer.write({ type: "text-start", id: textId });
                  writer.write({ type: "text-delta", id: textId, delta: buffer.trim() });
                  hasStartedText = true;
                }
              }
            }

            if (code !== 0 && !hasStartedText) {
              reject(new Error(`Claude CLI exited with code ${code}: ${stderr.slice(0, 300)}`));
            } else {
              resolve();
            }
          });

          child.on("error", (err) => {
            reject(new Error(`Failed to spawn claude: ${err.message}`));
          });
        });

        if (hasStartedText) {
          writer.write({ type: "text-end", id: textId });
          writer.write({ type: "finish-step" });
        }

        writer.write({
          type: "finish",
          finishReason: "stop",
          messageMetadata: {
            steps: [{
              usage: {
                inputTokens: totalInputTokens,
                outputTokens: totalOutputTokens,
              },
            }],
          },
        });
      } catch (err) {
        console.warn("[ClaudeCLI] Streaming failed, falling back:", err);

        try {
          const result = await queryClaudeCli(prompt, options);
          const fallbackTextId = crypto.randomUUID();

          writer.write({ type: "start-step" });
          writer.write({ type: "text-start", id: fallbackTextId });
          writer.write({ type: "text-delta", id: fallbackTextId, delta: result.text });
          writer.write({ type: "text-end", id: fallbackTextId });
          writer.write({ type: "finish-step" });
          writer.write({
            type: "finish",
            finishReason: "stop",
            messageMetadata: {
              steps: [{
                usage: {
                  inputTokens: result.usage.inputTokens,
                  outputTokens: result.usage.outputTokens,
                },
              }],
            },
          });
        } catch (fallbackErr) {
          const errMsg = fallbackErr instanceof Error ? fallbackErr.message : "Claude CLI error";
          const errTextId = crypto.randomUUID();
          writer.write({ type: "start-step" });
          writer.write({ type: "text-start", id: errTextId });
          writer.write({ type: "text-delta", id: errTextId, delta: `Error: ${errMsg}` });
          writer.write({ type: "text-end", id: errTextId });
          writer.write({ type: "finish-step" });
          writer.write({ type: "finish", finishReason: "error" });
        }
      }
    },
    generateId: () => messageId,
  });

  return createUIMessageStreamResponse({
    stream,
    headers: {
      "X-Message-Id": messageId,
    },
  });
}
