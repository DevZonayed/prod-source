import { tool } from "ai";
import type { Vm } from "freestyle-sandboxes";
import { z } from "zod";
import { WORKDIR } from "../../vars";
import type { AgenticLoopState } from "../types";
import {
  BACKGROUND_LOG_PREFIX,
  MAX_BACKGROUND_PROCESSES,
  MAX_TERMINAL_OUTPUT_LINES,
} from "../constants";
import { runVmCommand, shellQuote, resolveAbsPath } from "./helpers";

/**
 * Creates the 4 terminal tools: run_command, run_in_background, read_terminal_output, kill_process
 */
export function createTerminalTools(vm: Vm, state: AgenticLoopState) {
  return {
    run_command: tool({
      description:
        "Execute a shell command in the workspace terminal. Only use when no specific tool exists for the task. Returns stdout, stderr, and exit code.",
      inputSchema: z.object({
        Command: z.string().describe("Shell command to execute"),
        WorkingDirectory: z
          .string()
          .optional()
          .describe("Optional working directory (default: workspace root)"),
        Timeout: z
          .number()
          .int()
          .min(1)
          .max(300)
          .default(30)
          .describe("Timeout in seconds (default: 30, max: 300)"),
      }),
      execute: async ({ Command, WorkingDirectory, Timeout }) => {
        const cwd = WorkingDirectory
          ? resolveAbsPath(WorkingDirectory) ?? WORKDIR
          : WORKDIR;

        // Wrap with timeout and cd
        const wrapped = `cd ${shellQuote(cwd)} && timeout ${Timeout} bash -c ${shellQuote(Command)} 2>&1`;
        const result = await runVmCommand(vm, wrapped);

        return {
          ok: result.ok,
          stdout: result.stdout || "",
          stderr: result.stderr || "",
          exitCode: result.exitCode,
          command: Command,
          timedOut: result.exitCode === 124,
        };
      },
    }),

    run_in_background: tool({
      description:
        "Start a long-running process (dev servers, watchers, build processes) that persists across tool calls. Returns a TerminalId for monitoring via read_terminal_output.",
      inputSchema: z.object({
        Command: z.string().describe("Command to run in the background"),
        WorkingDirectory: z
          .string()
          .optional()
          .describe("Optional working directory"),
      }),
      execute: async ({ Command, WorkingDirectory }) => {
        if (state.backgroundProcesses.size >= MAX_BACKGROUND_PROCESSES) {
          return {
            error: `Maximum ${MAX_BACKGROUND_PROCESSES} background processes reached. Kill an existing process first using kill_process.`,
            activeProcesses: [...state.backgroundProcesses.entries()].map(
              ([id, p]) => ({
                terminalId: id,
                command: p.command,
                pid: p.pid,
              }),
            ),
          };
        }

        const cwd = WorkingDirectory
          ? resolveAbsPath(WorkingDirectory) ?? WORKDIR
          : WORKDIR;

        const terminalId = `bg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const logFile = `${BACKGROUND_LOG_PREFIX}-${terminalId}.log`;

        // Start the process with nohup, redirect output to log file, capture PID
        const startCmd = `cd ${shellQuote(cwd)} && nohup bash -c ${shellQuote(Command)} > ${shellQuote(logFile)} 2>&1 & echo $!`;
        const result = await runVmCommand(vm, startCmd);

        const pid = parseInt(result.stdout.trim(), 10);
        if (isNaN(pid)) {
          return {
            error: "Failed to start background process. Could not capture PID.",
            stdout: result.stdout,
            stderr: result.stderr,
          };
        }

        state.backgroundProcesses.set(terminalId, {
          pid,
          command: Command,
          logFile,
          startedAt: Date.now(),
        });

        return {
          ok: true,
          terminalId,
          pid,
          command: Command,
          logFile,
          message: `Process started. Use read_terminal_output with TerminalId "${terminalId}" to monitor output.`,
        };
      },
    }),

    read_terminal_output: tool({
      description:
        "Read recent output from a background process. Also checks if the process is still running.",
      inputSchema: z.object({
        TerminalId: z
          .string()
          .describe("Terminal ID returned by run_in_background"),
        Lines: z
          .number()
          .int()
          .min(1)
          .max(MAX_TERMINAL_OUTPUT_LINES)
          .default(50)
          .describe("Number of recent lines to return (default: 50)"),
      }),
      execute: async ({ TerminalId, Lines }) => {
        const proc = state.backgroundProcesses.get(TerminalId);
        if (!proc) {
          return {
            error: `Unknown TerminalId: ${TerminalId}`,
            availableTerminals: [...state.backgroundProcesses.keys()],
          };
        }

        // Check if process is still running
        const aliveCheck = await runVmCommand(
          vm,
          `kill -0 ${proc.pid} 2>/dev/null && echo "RUNNING" || echo "STOPPED"`,
        );
        const isRunning = aliveCheck.stdout.trim() === "RUNNING";

        // Read last N lines from log file
        const logCmd = `tail -${Lines} ${shellQuote(proc.logFile)} 2>/dev/null || echo "(no output yet)"`;
        const logResult = await runVmCommand(vm, logCmd);

        return {
          terminalId: TerminalId,
          pid: proc.pid,
          command: proc.command,
          isRunning,
          output: logResult.stdout,
          uptimeMs: Date.now() - proc.startedAt,
        };
      },
    }),

    kill_process: tool({
      description: "Kill a background process by its Terminal ID.",
      inputSchema: z.object({
        TerminalId: z
          .string()
          .describe("Terminal ID of the process to kill"),
      }),
      execute: async ({ TerminalId }) => {
        const proc = state.backgroundProcesses.get(TerminalId);
        if (!proc) {
          return {
            error: `Unknown TerminalId: ${TerminalId}`,
            availableTerminals: [...state.backgroundProcesses.keys()],
          };
        }

        // Kill the process and its children
        const killCmd = `kill -TERM ${proc.pid} 2>/dev/null; sleep 0.5; kill -0 ${proc.pid} 2>/dev/null && kill -9 ${proc.pid} 2>/dev/null; echo "KILLED"`;
        await runVmCommand(vm, killCmd);

        state.backgroundProcesses.delete(TerminalId);

        return {
          ok: true,
          terminalId: TerminalId,
          pid: proc.pid,
          command: proc.command,
          message: `Process ${proc.pid} killed.`,
        };
      },
    }),
  };
}
