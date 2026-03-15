import { tool } from "ai";
import type { Vm } from "@/lib/local-vm";
import { z } from "zod";

import { MAX_VIEW_FILE_LINES } from "../constants";
import {
  resolveAbsPath,
  readVmFile,
  writeVmFile,
  runVmCommand,
  shellQuote,
  ensureDir,
} from "./helpers";

/**
 * Creates the 5 filesystem tools: view_file, edit_file, create_file, delete_file, list_dir
 */
export function createFilesystemTools(vm: Vm, trackFile: (path: string) => void) {
  return {
    view_file: tool({
      description:
        "Read the contents of a file with line numbers. Primary tool for reading code. Use StartLine/EndLine for large files.",
      inputSchema: z.object({
        AbsolutePath: z
          .string()
          .describe("Absolute path to the file (within /workspace)"),
        StartLine: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Optional start line (1-indexed)"),
        EndLine: z
          .number()
          .int()
          .min(1)
          .optional()
          .describe("Optional end line (1-indexed)"),
      }),
      execute: async ({ AbsolutePath, StartLine, EndLine }) => {
        const absPath = resolveAbsPath(AbsolutePath);
        if (!absPath)
          return { error: `Invalid path: ${AbsolutePath}. Must be within the workspace.` };

        const content = await readVmFile(vm, absPath);
        if (content === null) return { error: `File not found: ${absPath}` };

        trackFile(absPath);

        const lines = content.split("\n");
        const start = StartLine ? Math.max(1, StartLine) : 1;
        const end = EndLine
          ? Math.min(lines.length, EndLine)
          : Math.min(lines.length, start + MAX_VIEW_FILE_LINES - 1);

        const numbered = lines
          .slice(start - 1, end)
          .map((line, i) => `${start + i}: ${line}`)
          .join("\n");

        return {
          path: absPath,
          totalLines: lines.length,
          displayedRange: { start, end },
          content: numbered,
        };
      },
    }),

    edit_file: tool({
      description:
        "Edit a file by replacing an exact string match. OldString must match exactly ONE occurrence in the file. Use view_file first to see the current content.",
      inputSchema: z.object({
        AbsolutePath: z.string().describe("Absolute path to the file"),
        OldString: z
          .string()
          .describe("Exact string to find (must be unique in the file)"),
        NewString: z.string().describe("Replacement string"),
      }),
      execute: async ({ AbsolutePath, OldString, NewString }) => {
        const absPath = resolveAbsPath(AbsolutePath);
        if (!absPath)
          return { error: `Invalid path: ${AbsolutePath}. Must be within the workspace.` };

        const content = await readVmFile(vm, absPath);
        if (content === null) return { error: `File not found: ${absPath}` };

        // Count occurrences
        const occurrences = content.split(OldString).length - 1;
        if (occurrences === 0) {
          return {
            error: `OldString not found in ${absPath}. Use view_file to check the current file content.`,
          };
        }
        if (occurrences > 1) {
          return {
            error: `OldString matches ${occurrences} locations in ${absPath}. Provide more surrounding context to make the match unique.`,
          };
        }

        const newContent = content.replace(OldString, NewString);
        const { written } = await writeVmFile(vm, absPath, newContent);
        if (!written) return { error: `Failed to write: ${absPath}` };

        // Build a diff-like summary
        const oldLines = OldString.split("\n").length;
        const newLines = NewString.split("\n").length;
        return {
          ok: true,
          path: absPath,
          linesRemoved: oldLines,
          linesAdded: newLines,
          summary: `Replaced ${oldLines} line(s) with ${newLines} line(s) in ${absPath}`,
        };
      },
    }),

    create_file: tool({
      description:
        "Create a new file with given content. Fails if the file already exists — use edit_file to modify existing files.",
      inputSchema: z.object({
        AbsolutePath: z.string().describe("Absolute path for the new file"),
        Content: z.string().describe("Full file content"),
      }),
      execute: async ({ AbsolutePath, Content }) => {
        const absPath = resolveAbsPath(AbsolutePath);
        if (!absPath)
          return { error: `Invalid path: ${AbsolutePath}. Must be within the workspace.` };

        // Check if file already exists
        const existing = await readVmFile(vm, absPath);
        if (existing !== null) {
          return {
            error: `File already exists: ${absPath}. Use edit_file to modify it.`,
          };
        }

        // Ensure parent directory exists
        const parentDir = absPath.substring(0, absPath.lastIndexOf("/"));
        if (parentDir) await ensureDir(vm, parentDir);

        const { written } = await writeVmFile(vm, absPath, Content);
        if (!written) return { error: `Failed to create file: ${absPath}` };

        return {
          ok: true,
          path: absPath,
          lines: Content.split("\n").length,
          bytes: Content.length,
        };
      },
    }),

    delete_file: tool({
      description: "Delete a file at the specified path.",
      inputSchema: z.object({
        AbsolutePath: z.string().describe("Absolute path to the file to delete"),
      }),
      execute: async ({ AbsolutePath }) => {
        const absPath = resolveAbsPath(AbsolutePath);
        if (!absPath)
          return { error: `Invalid path: ${AbsolutePath}. Must be within the workspace.` };

        const result = await runVmCommand(
          vm,
          `rm -f ${shellQuote(absPath)}`,
        );
        return {
          ok: result.ok,
          path: absPath,
          ...(result.stderr ? { stderr: result.stderr } : {}),
        };
      },
    }),

    list_dir: tool({
      description:
        "List files and directories up to 2 levels deep. Ignores node_modules, .next, and hidden directories.",
      inputSchema: z.object({
        DirectoryPath: z
          .string()
          .describe("Absolute path to the directory to list"),
      }),
      execute: async ({ DirectoryPath }) => {
        const absPath = resolveAbsPath(DirectoryPath);
        if (!absPath)
          return {
            error: `Invalid path: ${DirectoryPath}. Must be within the workspace.`,
          };

        const result = await runVmCommand(
          vm,
          `find ${shellQuote(absPath)} -maxdepth 2 ` +
            `-not -path '*/node_modules/*' ` +
            `-not -path '*/.next/*' ` +
            `-not -path '*/.*' ` +
            `| head -200 | sort`,
        );

        return {
          path: absPath,
          listing: result.stdout || "(empty directory)",
          ...(result.stderr ? { stderr: result.stderr } : {}),
        };
      },
    }),
  };
}
