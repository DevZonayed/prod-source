/**
 * Claude Agent SDK Provider
 *
 * Uses @anthropic-ai/claude-agent-sdk to run the Claude CLI binary with OAuth
 * authentication, but routes ALL tool execution through our VM-scoped custom
 * tools (via an in-process MCP server). Built-in CLI tools (Read, Edit, Write,
 * Bash, etc.) are NOT allowed — only our MCP tools that operate on the
 * Freestyle sandbox VM.
 *
 * This solves the fundamental OAuth constraint: OAuth tokens only work through
 * the CLI binary (attestation), but the CLI's built-in tools operate on the
 * local filesystem. By using the Agent SDK + custom MCP server, we get:
 *   - OAuth authentication (handled by the CLI binary internally)
 *   - VM-scoped tool execution (handled by our MCP tools)
 */

import {
  query,
  tool as sdkTool,
  createSdkMcpServer,
} from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { Vm } from "@/lib/local-vm";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  type UIMessage,
} from "ai";

import { VM_PORT } from "./vars";
import {
  resolveAbsPath,
  readVmFile,
  writeVmFile,
  runVmCommand,
  shellQuote,
  ensureDir,
  getDevServerLogs,
} from "./codemine/tools/helpers";
import {
  MAX_VIEW_FILE_LINES,
  MAX_GREP_RESULTS,
  MAX_BACKGROUND_PROCESSES,
  BACKGROUND_LOG_PREFIX,
  MAX_TERMINAL_OUTPUT_LINES,
} from "./codemine/constants";
import { readRepoMetadata } from "./repo-storage";
import { buildInitialEphemeral } from "./codemine/ephemeral";

// ─── MCP Server Name ───

const MCP_SERVER_NAME = "voxel-vm";

// ─── Tool name prefix for allowedTools ───

const mcpToolName = (name: string) => `mcp__${MCP_SERVER_NAME}__${name}`;

// ─── Types ───

type SdkProviderOptions = {
  systemPrompt: string;
  model?: string;
  maxTurns?: number;
  sourceRepoId?: string;
  metadataRepoId?: string;
  repoId?: string;
  conversationId?: string;
  previewUrl?: string;
  onFinish?: (assistantText: string) => Promise<void>;
};

/**
 * Strip MCP server prefix from tool name for clean UI display.
 * e.g. "mcp__voxel-vm__view_file" → "view_file"
 */
const stripToolPrefix = (name: string): string =>
  name.replace(/^mcp__[^_]+__/, "");

// ─── Build MCP Server with VM-scoped tools ───

function createVmMcpServer(vm: Vm, options?: { sourceRepoId?: string; metadataRepoId?: string }) {
  // Background process tracking (persists across tool calls within the same session)
  const backgroundProcesses = new Map<string, { pid: number; command: string; logFile: string; startedAt: number }>();

  return createSdkMcpServer({
    name: MCP_SERVER_NAME,
    version: "1.0.0",
    tools: [
      // ─── Filesystem Tools ───

      sdkTool(
        "view_file",
        "Read contents of a file with line numbers. Use StartLine/EndLine for large files.",
        {
          AbsolutePath: z.string().describe("Absolute path to the file (within /workspace)"),
          StartLine: z.number().int().min(1).optional().describe("Start line (1-indexed)"),
          EndLine: z.number().int().min(1).optional().describe("End line (1-indexed)"),
        },
        async (args) => {
          const absPath = resolveAbsPath(args.AbsolutePath);
          if (!absPath) return { content: [{ type: "text" as const, text: `Error: Invalid path: ${args.AbsolutePath}. Must be within the workspace.` }] };

          const fileContent = await readVmFile(vm, absPath);
          if (fileContent === null) return { content: [{ type: "text" as const, text: `Error: File not found: ${absPath}` }] };

          const lines = fileContent.split("\n");
          const start = args.StartLine ? Math.max(1, args.StartLine) : 1;
          const end = args.EndLine
            ? Math.min(lines.length, args.EndLine)
            : Math.min(lines.length, start + MAX_VIEW_FILE_LINES - 1);

          const numbered = lines
            .slice(start - 1, end)
            .map((line, i) => `${start + i}: ${line}`)
            .join("\n");

          return { content: [{ type: "text" as const, text: `File: ${absPath} (${lines.length} lines, showing ${start}-${end})\n\n${numbered}` }] };
        },
      ),

      sdkTool(
        "edit_file",
        "Edit a file by replacing an exact string match. OldString must match exactly ONE occurrence.",
        {
          AbsolutePath: z.string().describe("Absolute path to the file"),
          OldString: z.string().describe("Exact string to find (must be unique)"),
          NewString: z.string().describe("Replacement string"),
        },
        async (args) => {
          const absPath = resolveAbsPath(args.AbsolutePath);
          if (!absPath) return { content: [{ type: "text" as const, text: `Error: Invalid path: ${args.AbsolutePath}` }] };

          const fileContent = await readVmFile(vm, absPath);
          if (fileContent === null) return { content: [{ type: "text" as const, text: `Error: File not found: ${absPath}` }] };

          const occurrences = fileContent.split(args.OldString).length - 1;
          if (occurrences === 0) return { content: [{ type: "text" as const, text: `Error: OldString not found in ${absPath}. Use view_file to check current content.` }] };
          if (occurrences > 1) return { content: [{ type: "text" as const, text: `Error: OldString matches ${occurrences} locations. Provide more context to make it unique.` }] };

          const newContent = fileContent.replace(args.OldString, args.NewString);
          const { written } = await writeVmFile(vm, absPath, newContent);
          if (!written) return { content: [{ type: "text" as const, text: `Error: Failed to write ${absPath}` }] };

          const oldLines = args.OldString.split("\n").length;
          const newLines = args.NewString.split("\n").length;
          return { content: [{ type: "text" as const, text: `Replaced ${oldLines} line(s) with ${newLines} line(s) in ${absPath}` }] };
        },
      ),

      sdkTool(
        "create_file",
        "Create a new file. Fails if the file already exists — use edit_file to modify existing files.",
        {
          AbsolutePath: z.string().describe("Absolute path for the new file"),
          Content: z.string().describe("Full file content"),
        },
        async (args) => {
          const absPath = resolveAbsPath(args.AbsolutePath);
          if (!absPath) return { content: [{ type: "text" as const, text: `Error: Invalid path: ${args.AbsolutePath}` }] };

          const existing = await readVmFile(vm, absPath);
          if (existing !== null) return { content: [{ type: "text" as const, text: `Error: File exists: ${absPath}. Use edit_file to modify.` }] };

          const parentDir = absPath.substring(0, absPath.lastIndexOf("/"));
          if (parentDir) await ensureDir(vm, parentDir);

          const { written } = await writeVmFile(vm, absPath, args.Content);
          if (!written) return { content: [{ type: "text" as const, text: `Error: Failed to create ${absPath}` }] };

          return { content: [{ type: "text" as const, text: `Created ${absPath} (${args.Content.split("\n").length} lines, ${args.Content.length} bytes)` }] };
        },
      ),

      sdkTool(
        "delete_file",
        "Delete a file or directory.",
        {
          AbsolutePath: z.string().describe("Path to delete"),
        },
        async (args) => {
          const absPath = resolveAbsPath(args.AbsolutePath);
          if (!absPath) return { content: [{ type: "text" as const, text: `Error: Invalid path: ${args.AbsolutePath}` }] };

          const result = await runVmCommand(vm, `rm -rf ${shellQuote(absPath)}`);
          return { content: [{ type: "text" as const, text: result.ok ? `Deleted ${absPath}` : `Error: ${result.stderr}` }] };
        },
      ),

      sdkTool(
        "list_dir",
        "List files and directories. Ignores node_modules, .next, .git.",
        {
          DirectoryPath: z.string().describe("Absolute path to list"),
        },
        async (args) => {
          const absPath = resolveAbsPath(args.DirectoryPath);
          if (!absPath) return { content: [{ type: "text" as const, text: `Error: Invalid path: ${args.DirectoryPath}` }] };

          const result = await runVmCommand(
            vm,
            `find ${shellQuote(absPath)} -maxdepth 2 -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.*' | head -200 | sort`,
          );
          return { content: [{ type: "text" as const, text: result.stdout || "(empty directory)" }] };
        },
      ),

      // ─── Search Tools ───

      sdkTool(
        "grep_search",
        "Search for a pattern across files. Supports regex.",
        {
          SearchPattern: z.string().describe("Regex or literal pattern"),
          DirectoryPath: z.string().optional().describe("Directory to scope search (default: workspace root)"),
          FilePattern: z.string().optional().describe("Glob filter e.g. '*.ts'"),
          CaseSensitive: z.boolean().default(true).describe("Case-sensitive search"),
        },
        async (args) => {
          const searchDir = args.DirectoryPath ? resolveAbsPath(args.DirectoryPath) ?? "." : ".";
          const flags = ["-rn", "--color=never"];
          if (!args.CaseSensitive) flags.push("-i");
          if (args.FilePattern) flags.push(`--include=${shellQuote(args.FilePattern)}`);
          flags.push("--exclude-dir=node_modules", "--exclude-dir=.next", "--exclude-dir=.git", "--exclude-dir=dist");

          const cmd = `grep ${flags.join(" ")} ${shellQuote(args.SearchPattern)} ${shellQuote(searchDir)} 2>/dev/null | head -${MAX_GREP_RESULTS}`;
          const result = await runVmCommand(vm, cmd);
          return { content: [{ type: "text" as const, text: result.stdout || "(no matches found)" }] };
        },
      ),

      sdkTool(
        "find_by_name",
        "Find files or directories by name pattern.",
        {
          SearchPattern: z.string().describe("File name pattern (e.g. '*.ts', 'config*')"),
          DirectoryPath: z.string().optional().describe("Directory to scope search"),
          Type: z.enum(["file", "directory", "any"]).default("any").describe("Filter by type"),
        },
        async (args) => {
          const searchDir = args.DirectoryPath ? resolveAbsPath(args.DirectoryPath) ?? "." : ".";
          const typeFlag = args.Type === "file" ? "-type f" : args.Type === "directory" ? "-type d" : "";
          const cmd = `find ${shellQuote(searchDir)} ${typeFlag} -name ${shellQuote(args.SearchPattern)} -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' 2>/dev/null | head -100 | sort`;
          const result = await runVmCommand(vm, cmd);
          return { content: [{ type: "text" as const, text: result.stdout || "(no matches found)" }] };
        },
      ),

      sdkTool(
        "codebase_search",
        "Semantic search across the codebase using a natural language query. Searches for each word and ranks files by relevance. Use this for broad discovery; use grep_search for exact patterns.",
        {
          Query: z.string().describe("Natural language search query"),
          DirectoryPath: z.string().optional().describe("Optional directory to scope the search"),
        },
        async (args) => {
          const searchDir = args.DirectoryPath ? resolveAbsPath(args.DirectoryPath) ?? "." : ".";
          const terms = args.Query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
          if (terms.length === 0) return { content: [{ type: "text" as const, text: "Error: Query too short. Provide meaningful search terms." }] };

          const fileScores = new Map<string, { score: number; lines: string[] }>();
          for (const term of terms.slice(0, 5)) {
            const cmd = `grep -rn --color=never -i --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git --exclude-dir=dist ${shellQuote(term)} ${shellQuote(searchDir)} 2>/dev/null | head -100`;
            const result = await runVmCommand(vm, cmd);
            if (!result.stdout) continue;
            for (const line of result.stdout.split("\n").filter(Boolean)) {
              const colonIdx = line.indexOf(":");
              if (colonIdx === -1) continue;
              const file = line.substring(0, colonIdx);
              const entry = fileScores.get(file) ?? { score: 0, lines: [] };
              entry.score++;
              if (entry.lines.length < 3) entry.lines.push(line);
              fileScores.set(file, entry);
            }
          }

          const ranked = [...fileScores.entries()]
            .sort((a, b) => b[1].score - a[1].score)
            .slice(0, 20);

          if (ranked.length === 0) return { content: [{ type: "text" as const, text: `Query: ${args.Query}\n(no matches found)` }] };

          const output = ranked
            .map(([file, { score, lines }]) => `[${score}/${terms.length} terms] ${file}\n${lines.map((l) => `  ${l}`).join("\n")}`)
            .join("\n\n");

          return { content: [{ type: "text" as const, text: `Query: ${args.Query} (${ranked.length} files found)\n\n${output}` }] };
        },
      ),

      // ─── Terminal Tools ───

      sdkTool(
        "run_command",
        "Execute a shell command in the VM workspace. Returns stdout, stderr, and exit code.",
        {
          Command: z.string().describe("Shell command to execute"),
          WorkingDirectory: z.string().optional().describe("Working directory (default: workspace root)"),
          Timeout: z.number().int().min(1).max(300).default(30).describe("Timeout in seconds"),
        },
        async (args) => {
          const cwd = args.WorkingDirectory ? resolveAbsPath(args.WorkingDirectory) ?? "." : ".";
          const wrapped = cwd === "."
            ? `timeout ${args.Timeout} bash -c ${shellQuote(args.Command)} 2>&1`
            : `cd ${shellQuote(cwd)} && timeout ${args.Timeout} bash -c ${shellQuote(args.Command)} 2>&1`;
          const result = await runVmCommand(vm, wrapped);
          const output = [
            result.stdout ? `stdout:\n${result.stdout}` : "",
            result.stderr ? `stderr:\n${result.stderr}` : "",
            `exit_code: ${result.exitCode ?? 0}`,
          ].filter(Boolean).join("\n\n");
          return { content: [{ type: "text" as const, text: output || "(no output)" }] };
        },
      ),

      sdkTool(
        "run_in_background",
        "Start a long-running process (dev servers, watchers, build processes) that persists across tool calls. Returns a TerminalId for monitoring via read_terminal_output.",
        {
          Command: z.string().describe("Command to run in the background"),
          WorkingDirectory: z.string().optional().describe("Optional working directory"),
        },
        async (args) => {
          if (backgroundProcesses.size >= MAX_BACKGROUND_PROCESSES) {
            const active = [...backgroundProcesses.entries()].map(([id, p]) => `${id} (pid ${p.pid}): ${p.command}`).join("\n");
            return { content: [{ type: "text" as const, text: `Error: Maximum ${MAX_BACKGROUND_PROCESSES} background processes reached. Kill an existing process first.\n\nActive:\n${active}` }] };
          }

          const cwd = args.WorkingDirectory ? resolveAbsPath(args.WorkingDirectory) ?? "." : ".";
          const terminalId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
          const logFile = `${BACKGROUND_LOG_PREFIX}-${terminalId}.log`;

          const startCmd = cwd === "."
            ? `nohup bash -c ${shellQuote(args.Command)} > ${shellQuote(logFile)} 2>&1 & echo $!`
            : `cd ${shellQuote(cwd)} && nohup bash -c ${shellQuote(args.Command)} > ${shellQuote(logFile)} 2>&1 & echo $!`;
          const result = await runVmCommand(vm, startCmd);

          const pid = parseInt(result.stdout.trim(), 10);
          if (isNaN(pid)) {
            return { content: [{ type: "text" as const, text: `Error: Failed to start background process. Could not capture PID.\n${result.stdout}\n${result.stderr}` }] };
          }

          backgroundProcesses.set(terminalId, { pid, command: args.Command, logFile, startedAt: Date.now() });
          return { content: [{ type: "text" as const, text: `Process started.\nTerminalId: ${terminalId}\nPID: ${pid}\nCommand: ${args.Command}\nLog: ${logFile}\n\nUse read_terminal_output with TerminalId "${terminalId}" to monitor output.` }] };
        },
      ),

      sdkTool(
        "read_terminal_output",
        "Read recent output from a background process. Also checks if the process is still running.",
        {
          TerminalId: z.string().describe("Terminal ID returned by run_in_background"),
          Lines: z.number().int().min(1).max(MAX_TERMINAL_OUTPUT_LINES).default(50).describe("Number of recent lines to return (default: 50)"),
        },
        async (args) => {
          const proc = backgroundProcesses.get(args.TerminalId);
          if (!proc) {
            const available = backgroundProcesses.size > 0
              ? `Available: ${[...backgroundProcesses.keys()].join(", ")}`
              : "No background processes running.";
            return { content: [{ type: "text" as const, text: `Error: Unknown TerminalId: ${args.TerminalId}\n${available}` }] };
          }

          const aliveCheck = await runVmCommand(vm, `kill -0 ${proc.pid} 2>/dev/null && echo "RUNNING" || echo "STOPPED"`);
          const isRunning = aliveCheck.stdout.trim() === "RUNNING";
          const logCmd = `tail -${args.Lines} ${shellQuote(proc.logFile)} 2>/dev/null || echo "(no output yet)"`;
          const logResult = await runVmCommand(vm, logCmd);
          const uptimeSec = Math.round((Date.now() - proc.startedAt) / 1000);

          return { content: [{ type: "text" as const, text: `TerminalId: ${args.TerminalId}\nPID: ${proc.pid}\nCommand: ${proc.command}\nStatus: ${isRunning ? "RUNNING" : "STOPPED"}\nUptime: ${uptimeSec}s\n\n--- Output (last ${args.Lines} lines) ---\n${logResult.stdout}` }] };
        },
      ),

      sdkTool(
        "kill_process",
        "Kill a background process by its Terminal ID.",
        {
          TerminalId: z.string().describe("Terminal ID of the process to kill"),
        },
        async (args) => {
          const proc = backgroundProcesses.get(args.TerminalId);
          if (!proc) {
            const available = backgroundProcesses.size > 0
              ? `Available: ${[...backgroundProcesses.keys()].join(", ")}`
              : "No background processes running.";
            return { content: [{ type: "text" as const, text: `Error: Unknown TerminalId: ${args.TerminalId}\n${available}` }] };
          }

          await runVmCommand(vm, `kill -TERM ${proc.pid} 2>/dev/null; sleep 0.5; kill -0 ${proc.pid} 2>/dev/null && kill -9 ${proc.pid} 2>/dev/null; echo "KILLED"`);
          backgroundProcesses.delete(args.TerminalId);

          return { content: [{ type: "text" as const, text: `Killed process ${proc.pid} (${proc.command}).\nTerminalId ${args.TerminalId} removed.` }] };
        },
      ),

      // ─── Git Tools ───

      sdkTool(
        "git_status",
        "Show working tree status and current branch.",
        {},
        async () => {
          const status = await runVmCommand(vm, `git status --porcelain`);
          const branch = await runVmCommand(vm, `git branch --show-current`);
          return {
            content: [{
              type: "text" as const,
              text: `Branch: ${branch.stdout.trim() || "unknown"}\n${status.stdout || "(clean working tree)"}`,
            }],
          };
        },
      ),

      sdkTool(
        "git_diff",
        "Show file diffs (staged and unstaged).",
        {
          Path: z.string().optional().describe("File path to scope the diff"),
        },
        async (args) => {
          const pathArg = args.Path ? ` -- ${shellQuote(args.Path)}` : "";
          const [staged, unstaged] = await Promise.all([
            runVmCommand(vm, `git diff --cached${pathArg}`),
            runVmCommand(vm, `git diff${pathArg}`),
          ]);
          return {
            content: [{
              type: "text" as const,
              text: `Staged:\n${staged.stdout || "(none)"}\n\nUnstaged:\n${unstaged.stdout || "(none)"}`,
            }],
          };
        },
      ),

      sdkTool(
        "git_log",
        "Show commit history.",
        {
          MaxEntries: z.number().int().min(1).max(50).default(10).describe("Max log entries"),
        },
        async (args) => {
          const result = await runVmCommand(vm, `git log --oneline --no-decorate -${args.MaxEntries}`);
          return { content: [{ type: "text" as const, text: result.stdout || "(no commits yet)" }] };
        },
      ),

      sdkTool(
        "git_commit",
        "Stage all changes, commit, and push. Triggers deployment if configured.",
        {
          Message: z.string().describe("Commit message"),
        },
        async (args) => {
          const gitCmd = (cmd: string) => runVmCommand(vm, `git ${cmd}`);

          await gitCmd(`config user.name "Voxel"`);
          await gitCmd(`config user.email "voxel@local"`);

          const commitResult = await gitCmd(`commit -am ${shellQuote(args.Message)}`);
          if (!commitResult.ok) {
            return { content: [{ type: "text" as const, text: `Commit failed:\n${commitResult.stdout}\n${commitResult.stderr}` }] };
          }

          await gitCmd("pull --rebase --no-edit 2>/dev/null || true");
          const pushResult = await gitCmd("push 2>&1 || true");

          return { content: [{ type: "text" as const, text: `Committed and pushed.\n${commitResult.stdout}\n${pushResult.stdout}` }] };
        },
      ),

      // ─── App Check Tool ───

      sdkTool(
        "check_app",
        "Check if the app is running by hitting the dev server and scanning logs for errors. ALWAYS call this before finishing a task.",
        {
          path: z.string().default("/").describe("URL path to check"),
        },
        async (args) => {
          const urlPath = args.path?.startsWith("/") ? args.path : `/${args.path ?? ""}`;
          const curlCmd = `curl -s -o /dev/null -w '%{http_code}' http://localhost:${VM_PORT}${urlPath}`;
          const result = await runVmCommand(vm, curlCmd);
          const statusCode = parseInt(result.stdout.trim(), 10) || 0;

          const { errors } = await getDevServerLogs(vm);
          const httpOk = statusCode >= 200 && statusCode < 400;
          const ok = httpOk && errors.length === 0;

          const parts = [`HTTP ${statusCode} — ${httpOk ? "reachable" : "UNREACHABLE"}`];
          if (errors.length > 0) parts.push(`\nErrors found in logs:\n${errors.join("\n")}`);
          if (ok) parts.push("\nApp is running correctly.");

          return { content: [{ type: "text" as const, text: parts.join("") }] };
        },
      ),
    ],
  });
}

// ─── Collect all tool names for allowedTools ───

const ALL_MCP_TOOL_NAMES = [
  "view_file", "edit_file", "create_file", "delete_file", "list_dir",
  "grep_search", "find_by_name", "codebase_search",
  "run_command", "run_in_background", "read_terminal_output", "kill_process",
  "git_status", "git_diff", "git_log", "git_commit",
  "check_app",
].map(mcpToolName);

// Built-in CLI tools allowed alongside MCP tools.
// WebSearch = Anthropic server-side search (executed by Anthropic's servers, not locally)
// WebFetch  = local HTTP fetch + HTML→markdown (executed by the CLI process)
const ALLOWED_BUILTIN_TOOLS = ["WebSearch", "WebFetch"];

const ALL_ALLOWED_TOOLS = [...ALL_MCP_TOOL_NAMES, ...ALLOWED_BUILTIN_TOOLS];

// ─── Build conversation prompt from UIMessages ───

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

// ─── Public API: Create streaming response using Agent SDK ───

export function createClaudeSdkStreamResponse(
  vm: Vm,
  messages: UIMessage[],
  options: SdkProviderOptions,
): Response {
  const messageId = crypto.randomUUID();
  const mcpServer = createVmMcpServer(vm, {
    sourceRepoId: options.sourceRepoId,
    metadataRepoId: options.metadataRepoId,
  });

  const sessionId = crypto.randomUUID();
  async function* generateMessages() {
    const conversationText = buildConversationPrompt(messages);
    yield {
      type: "user" as const,
      message: {
        role: "user" as const,
        content: conversationText,
      },
      parent_tool_use_id: null,
      session_id: sessionId,
    };
  }

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      let currentTextId: string | null = null;
      let inStep = false;
      let totalInputTokens = 0;
      let totalOutputTokens = 0;

      // Collect final text for message saving
      let collectedText = "";

      // Track active tool calls by content_block index
      const activeToolCalls = new Map<
        number,
        { toolCallId: string; toolName: string; argsJson: string }
      >();
      // Track tool calls that have been emitted (to avoid duplicates from assistant message)
      const emittedToolCallIds = new Set<string>();

      const ensureStep = () => {
        if (!inStep) {
          writer.write({ type: "start-step" });
          inStep = true;
        }
      };

      const endText = () => {
        if (currentTextId) {
          writer.write({ type: "text-end", id: currentTextId });
          currentTextId = null;
        }
      };

      const endStep = () => {
        endText();
        if (inStep) {
          writer.write({ type: "finish-step" });
          inStep = false;
        }
      };

      // Build initial ephemeral context with sandbox state
      const { errors: devServerErrors } = await getDevServerLogs(vm);
      const initialEphemeral = buildInitialEphemeral({
        stepId: 0,
        sandboxState: {
          previewUrl: options.previewUrl ?? "N/A",
          devServerRunning: true,
          devServerErrors,
        },
        diagnostics: devServerErrors,
        kiSummaries: [],
        warnings: [],
      });
      const systemPromptWithEphemeral = options.systemPrompt + "\n\n" + initialEphemeral;

      try {
        for await (const message of query({
          prompt: generateMessages(),
          options: {
            systemPrompt: systemPromptWithEphemeral,
            model: options.model ?? "sonnet",
            maxTurns: options.maxTurns ?? 200,
            mcpServers: { [MCP_SERVER_NAME]: mcpServer },
            allowedTools: ALL_ALLOWED_TOOLS,
            tools: [],
            permissionMode: "bypassPermissions",
            includePartialMessages: true,
          },
        })) {
          // ─── Stream events (real-time text + tool call streaming) ───
          if (message.type === "stream_event") {
            const event = message.event as Record<string, unknown>;
            const eventType = event.type as string;

            // --- Content block start ---
            if (eventType === "content_block_start") {
              const block = event.content_block as Record<string, unknown> | undefined;
              if (block?.type === "text") {
                ensureStep();
                currentTextId = crypto.randomUUID();
                writer.write({ type: "text-start", id: currentTextId });
              } else if (block?.type === "tool_use" || block?.type === "server_tool_use") {
                // Handle both MCP/custom tool_use AND server-side tools (WebSearch)
                endText();
                ensureStep();
                const rawName = (block.name as string) || "unknown";
                const cleanName = stripToolPrefix(rawName);
                const toolCallId = (block.id as string) || crypto.randomUUID();
                const idx = typeof event.index === "number" ? event.index : -1;
                activeToolCalls.set(idx, { toolCallId, toolName: cleanName, argsJson: "" });
                emittedToolCallIds.add(toolCallId);
                writer.write({
                  type: "tool-input-start",
                  toolCallId,
                  toolName: cleanName,
                });
              } else if (block?.type === "web_search_tool_result") {
                // Server-side WebSearch results — emit as tool output
                endText();
                ensureStep();
                const toolUseId = (block.tool_use_id as string) || "";
                const content = block.content;
                let resultText = "";
                if (Array.isArray(content)) {
                  const searchResults = content as Array<{ type?: string; title?: string; url?: string; encrypted_content?: string }>;
                  resultText = searchResults
                    .filter((r) => r.type === "search_result")
                    .map((r) => `- ${r.title ?? ""}  \n  ${r.url ?? ""}`)
                    .join("\n");
                } else if (content && typeof content === "object" && "error_code" in (content as Record<string, unknown>)) {
                  resultText = `Web search error: ${(content as Record<string, unknown>).error_code}`;
                }
                if (toolUseId && emittedToolCallIds.has(toolUseId)) {
                  writer.write({
                    type: "tool-output-available",
                    toolCallId: toolUseId,
                    output: resultText || "Search completed",
                  });
                }
              }
            }

            // --- Content block delta ---
            if (eventType === "content_block_delta") {
              const delta = event.delta as Record<string, unknown> | undefined;
              if (delta?.type === "text_delta" && typeof delta.text === "string") {
                if (!currentTextId) {
                  ensureStep();
                  currentTextId = crypto.randomUUID();
                  writer.write({ type: "text-start", id: currentTextId });
                }
                writer.write({ type: "text-delta", id: currentTextId, delta: delta.text });
                collectedText += delta.text;
              } else if (delta?.type === "input_json_delta" && typeof delta.partial_json === "string") {
                const idx = typeof event.index === "number" ? event.index : -1;
                const tc = activeToolCalls.get(idx);
                if (tc) {
                  tc.argsJson += delta.partial_json;
                  writer.write({
                    type: "tool-input-delta",
                    toolCallId: tc.toolCallId,
                    inputTextDelta: delta.partial_json,
                  });
                }
              }
            }

            // --- Content block stop ---
            if (eventType === "content_block_stop") {
              // End text block if active
              if (currentTextId) {
                writer.write({ type: "text-end", id: currentTextId });
                currentTextId = null;
              }
              // End tool_use block if active — mark as complete
              const stopIdx = typeof event.index === "number" ? event.index : -1;
              const stoppedTc = activeToolCalls.get(stopIdx);
              if (stoppedTc) {
                let parsedInput: unknown = {};
                try { parsedInput = JSON.parse(stoppedTc.argsJson || "{}"); } catch { /* */ }
                // Mark input as ready
                writer.write({
                  type: "tool-input-available",
                  toolCallId: stoppedTc.toolCallId,
                  toolName: stoppedTc.toolName,
                  input: parsedInput,
                });
                // Mark output as complete — SDK executes tools internally via MCP,
                // so we emit output immediately to stop the spinner
                writer.write({
                  type: "tool-output-available",
                  toolCallId: stoppedTc.toolCallId,
                  output: "Completed",
                });
                activeToolCalls.delete(stopIdx);
              }
            }

            // --- Message delta (usage) ---
            if (eventType === "message_delta") {
              const usage = event.usage as Record<string, number> | undefined;
              if (usage) {
                totalInputTokens += usage.input_tokens ?? 0;
                totalOutputTokens += usage.output_tokens ?? 0;
              }
            }

            // --- Message stop (end of one assistant turn) ---
            if (eventType === "message_stop") {
              endStep();
            }
          }

          // ─── Complete assistant message (fallback for tool calls not caught by stream events) ───
          if (message.type === "assistant") {
            const msg = message as Record<string, unknown>;
            const content = (msg.message as Record<string, unknown>)?.content;
            if (Array.isArray(content)) {
              for (const block of content) {
                const b = block as Record<string, unknown>;
                if ((b.type === "tool_use" || b.type === "server_tool_use") && typeof b.name === "string") {
                  const toolCallId = (b.id as string) || crypto.randomUUID();
                  // Only emit if not already streamed via stream_event
                  if (!emittedToolCallIds.has(toolCallId)) {
                    endText();
                    ensureStep();
                    const cleanName = stripToolPrefix(b.name);
                    emittedToolCallIds.add(toolCallId);
                    writer.write({
                      type: "tool-input-start",
                      toolCallId,
                      toolName: cleanName,
                    });
                    // Emit args at once
                    const argsStr = JSON.stringify(b.input ?? {});
                    writer.write({
                      type: "tool-input-delta",
                      toolCallId,
                      inputTextDelta: argsStr,
                    });
                    // Mark as complete
                    writer.write({
                      type: "tool-input-available",
                      toolCallId,
                      toolName: cleanName,
                      input: b.input ?? {},
                    });
                    writer.write({
                      type: "tool-output-available",
                      toolCallId,
                      output: "Completed",
                    });
                  }
                }
                // Collect any text from assistant message
                if (b.type === "text" && typeof b.text === "string") {
                  // Text may already be streamed; only add if not yet captured
                  if (!collectedText.includes(b.text.slice(0, 50))) {
                    collectedText += b.text;
                  }
                }
              }
            }
            // End step after processing assistant message
            endStep();
          }

          // ─── Tool progress (tool execution happening) ───
          if (message.type === "tool_progress") {
            const msg = message as Record<string, unknown>;
            const toolUseId = msg.tool_use_id as string;
            if (toolUseId && emittedToolCallIds.has(toolUseId)) {
              // Tool is executing — the spinner is already showing via status
            }
          }

          // ─── Tool use summary (tool execution completed) ───
          if (message.type === "tool_use_summary") {
            const msg = message as Record<string, unknown>;
            const toolUseIds = msg.preceding_tool_use_ids as string[] | undefined;
            const summary = msg.summary as string | undefined;

            if (toolUseIds && summary) {
              for (const toolUseId of toolUseIds) {
                if (emittedToolCallIds.has(toolUseId)) {
                  ensureStep();
                  writer.write({
                    type: "tool-output-available",
                    toolCallId: toolUseId,
                    output: summary,
                  });
                  endStep();
                }
              }
            }
          }

          // ─── Final result ───
          if (message.type === "result") {
            const msg = message as Record<string, unknown>;
            if (typeof msg.result === "string" && msg.result) {
              if (!collectedText) {
                ensureStep();
                const resultTextId = crypto.randomUUID();
                writer.write({ type: "text-start", id: resultTextId });
                writer.write({ type: "text-delta", id: resultTextId, delta: msg.result });
                writer.write({ type: "text-end", id: resultTextId });
                collectedText += msg.result;
              }
            }
          }
        }

        // Finalize any open step
        endStep();

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

        // Save the collected response via callback
        if (options.onFinish) {
          try {
            await options.onFinish(collectedText);
          } catch (saveErr) {
            console.error("[ClaudeSDK] Failed to save messages:", saveErr);
          }
        }
      } catch (err) {
        console.error("[ClaudeSDK] Error:", err instanceof Error ? err.stack : err);

        const errMsg = err instanceof Error ? err.message : "Claude SDK error";
        const errTextId = crypto.randomUUID();

        endStep();

        writer.write({ type: "start-step" });
        writer.write({ type: "text-start", id: errTextId });
        writer.write({ type: "text-delta", id: errTextId, delta: `Error: ${errMsg}` });
        writer.write({ type: "text-end", id: errTextId });
        writer.write({ type: "finish-step" });
        writer.write({ type: "finish", finishReason: "error" });
      }
    },
    generateId: () => messageId,
  });

  return createUIMessageStreamResponse({
    stream,
    headers: { "X-Message-Id": messageId },
  });
}
