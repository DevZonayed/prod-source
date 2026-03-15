import { tool } from "ai";
import type { Vm } from "@/lib/local-vm";
import { z } from "zod";

import type { AgenticLoopState } from "../types";
import { runVmCommand, shellQuote, readVmFile } from "./helpers";

/**
 * Creates the 5 IDE-context tools:
 * get_diagnostics, get_open_files, rename_symbol, read_clipboard, open_in_editor
 *
 * Since this is a web-based app builder (not an IDE extension), some tools
 * are adapted for the web context while others are stubs.
 */
export function createIdeContextTools(vm: Vm, state: AgenticLoopState) {
  return {
    get_diagnostics: tool({
      description:
        "Get TypeScript compiler errors and dev server diagnostics. Runs tsc --noEmit and scans dev server logs for runtime errors.",
      inputSchema: z.object({}),
      execute: async () => {
        // Run TypeScript type checking
        const tscResult = await runVmCommand(
          vm,
          `npx tsc --noEmit --pretty false 2>&1 | head -100`,
        );

        // Get dev server logs and extract errors
        const devServer = (vm as { devServer?: { getLogs?: () => unknown } })
          .devServer;
        let devServerErrors: string[] = [];
        if (devServer?.getLogs) {
          try {
            const raw = await devServer.getLogs();
            const logs = typeof raw === "string" ? raw : "";
            const errorPattern =
              /(error -|failed to compile|module not found|unhandled runtime error|referenceerror|typeerror|syntaxerror|cannot find module)/i;
            devServerErrors = logs
              .split("\n")
              .filter((line) => errorPattern.test(line))
              .slice(-20);
          } catch {
            // ignore
          }
        }

        // Parse tsc output into structured diagnostics
        const tscErrors = tscResult.stdout
          ? tscResult.stdout
              .split("\n")
              .filter((line) => line.includes("error TS") || line.includes("warning"))
              .slice(0, 50)
          : [];

        const hasErrors = tscErrors.length > 0 || devServerErrors.length > 0;

        return {
          ok: !hasErrors,
          typescript: {
            errorCount: tscErrors.length,
            errors: tscErrors,
            rawOutput: tscResult.stdout.slice(0, 3000),
          },
          devServer: {
            errorCount: devServerErrors.length,
            errors: devServerErrors,
          },
          summary: hasErrors
            ? `Found ${tscErrors.length} TypeScript error(s) and ${devServerErrors.length} dev server error(s).`
            : "No diagnostics issues found.",
        };
      },
    }),

    get_open_files: tool({
      description:
        "List files that have been recently accessed in this session. Tracks files opened via view_file.",
      inputSchema: z.object({}),
      execute: async () => {
        const files = [...new Set(state.recentFiles)].slice(-20);
        return {
          openFiles: files,
          count: files.length,
        };
      },
    }),

    rename_symbol: tool({
      description:
        "Rename a symbol (variable, function, class) across the codebase. Uses text-based search and replace — review the changes after renaming.",
      inputSchema: z.object({
        OldName: z.string().describe("Current symbol name"),
        NewName: z.string().describe("New symbol name"),
        DirectoryPath: z
          .string()
          .optional()
          .describe("Scope the rename to a specific directory"),
        FilePattern: z
          .string()
          .optional()
          .describe("Glob pattern to filter files (e.g. '*.ts', '*.tsx')"),
      }),
      execute: async ({ OldName, NewName, DirectoryPath, FilePattern }) => {
        const searchDir = DirectoryPath ?? ".";
        const includeFlag = FilePattern
          ? `--include=${shellQuote(FilePattern)}`
          : "--include='*.ts' --include='*.tsx' --include='*.js' --include='*.jsx'";

        // First, find all occurrences
        const findCmd = `grep -rn ${includeFlag} --exclude-dir=node_modules --exclude-dir=.next --exclude-dir=.git ${shellQuote(OldName)} ${shellQuote(searchDir)} 2>/dev/null`;
        const findResult = await runVmCommand(vm, findCmd);

        const matches = findResult.stdout
          ? findResult.stdout.split("\n").filter(Boolean)
          : [];

        if (matches.length === 0) {
          return {
            ok: false,
            error: `Symbol "${OldName}" not found in ${searchDir}`,
          };
        }

        // Extract unique files
        const files = [
          ...new Set(matches.map((m) => m.split(":")[0]!).filter(Boolean)),
        ];

        // Perform replacements file by file
        let totalReplacements = 0;
        const modifiedFiles: string[] = [];

        for (const file of files) {
          const content = await readVmFile(vm, file);
          if (!content) continue;

          const count = content.split(OldName).length - 1;
          if (count === 0) continue;

          const newContent = content.replaceAll(OldName, NewName);
          try {
            await vm.fs.writeTextFile(file, newContent);
            totalReplacements += count;
            modifiedFiles.push(file);
          } catch {
            // skip failed files
          }
        }

        return {
          ok: true,
          oldName: OldName,
          newName: NewName,
          filesModified: modifiedFiles.length,
          totalReplacements,
          files: modifiedFiles,
        };
      },
    }),

    read_clipboard: tool({
      description:
        "Read clipboard contents. Not available in web-based context.",
      inputSchema: z.object({}),
      execute: async () => {
        return {
          error:
            "Clipboard access is not available in the web-based app builder. Please paste content directly in your message.",
        };
      },
    }),

    open_in_editor: tool({
      description:
        "Open a file in the editor. Not available in web-based context — use view_file instead.",
      inputSchema: z.object({
        AbsolutePath: z.string().describe("File path to open"),
        Line: z.number().int().optional().describe("Line number to jump to"),
      }),
      execute: async ({ AbsolutePath, Line }) => {
        return {
          note: `In the web-based app builder, files are not opened in an editor. Use view_file to read "${AbsolutePath}"${Line ? ` starting at line ${Line}` : ""}.`,
        };
      },
    }),
  };
}
