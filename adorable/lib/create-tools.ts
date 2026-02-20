import { tool } from "ai";
import { Vm } from "freestyle-sandboxes";
import { z } from "zod";
import { WORKDIR } from "./vars";

const normalizeRelativePath = (rawPath: string): string | null => {
  const value = rawPath.trim();
  if (!value || value.includes("\0") || value.startsWith("/")) return null;

  const normalized = value.replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) return null;

  return normalized || ".";
};

const shellQuote = (value: string): string => {
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

export const createTools = (vm: Vm) => {
  const runExecCommand = async (command: string) => {
    const execResult = await vm.exec({ command });
    if (typeof execResult === "string") {
      return { ok: true, stdout: execResult, stderr: "", command };
    }

    if (execResult && typeof execResult === "object") {
      const cast = execResult as Record<string, unknown>;
      return {
        ok:
          typeof cast.ok === "boolean"
            ? cast.ok
            : typeof cast.exitCode === "number"
              ? cast.exitCode === 0
              : true,
        stdout: typeof cast.stdout === "string" ? cast.stdout : "",
        stderr: typeof cast.stderr === "string" ? cast.stderr : "",
        exitCode: typeof cast.exitCode === "number" ? cast.exitCode : null,
        command,
      };
    }

    return {
      ok: true,
      stdout: execResult == null ? "" : String(execResult),
      stderr: "",
      command,
    };
  };

  const bashTool = tool({
    description:
      "Run a bash command inside the Adorable VM and return its output.",
    inputSchema: z.object({
      command: z.string().min(1).describe("The bash command to execute."),
    }),
    execute: async ({ command }) => {
      return runExecCommand(command);
    },
  });

  const readFileTool = tool({
    description:
      "Read the content of a file in the Adorable VM. Input is the file path relative to the workdir.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("The path of the file to read."),
      })
      .passthrough(),
    execute: async ({ file }) => {
      if (!file) return { content: null };
      const safeFile = normalizeRelativePath(file);
      if (!safeFile) {
        return { ok: false, error: "Invalid file path." };
      }
      const result = await vm.fs.readTextFile(safeFile);
      return { content: result };
    },
  });

  const writeFileTool = tool({
    description:
      "Write content to a file in the Adorable VM. Input is the file path relative to the workdir and the content to write.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("The path of the file to write."),
        content: z.string().describe("The content to write to the file."),
      })
      .passthrough(),
    execute: async ({ file, content }) => {
      const safeFile = file ? normalizeRelativePath(file) : null;
      if (!safeFile) return { ok: false, error: "File path is required." };
      await vm.fs.writeTextFile(safeFile, content);
      return { ok: true };
    },
  });

  const listFilesTool = tool({
    description:
      "List files or directories from a given path. Prefer this over bash for discovery.",
    inputSchema: z
      .object({
        path: z.string().default(".").describe("Path to list."),
        recursive: z
          .boolean()
          .default(false)
          .describe("Whether to list recursively."),
        maxDepth: z
          .number()
          .int()
          .min(1)
          .max(8)
          .default(3)
          .describe("Maximum recursion depth when recursive is true."),
      })
      .passthrough(),
    execute: async ({ path, recursive, maxDepth }) => {
      const safePath = normalizeRelativePath(path ?? ".");
      if (!safePath) return { ok: false, error: "Invalid path." };

      const command = recursive
        ? `cd ${shellQuote(WORKDIR)} && find ${shellQuote(safePath)} -maxdepth ${maxDepth} -print | sed 's#^\\./##'`
        : `cd ${shellQuote(WORKDIR)} && ls -la ${shellQuote(safePath)}`;

      const result = await runExecCommand(command);
      return { ...result, path: safePath, recursive, maxDepth };
    },
  });

  const searchFilesTool = tool({
    description:
      "Search for text within files. Prefer this over bash grep for code/text lookup.",
    inputSchema: z
      .object({
        query: z.string().min(1).describe("Text to search for."),
        path: z.string().default(".").describe("Path to search under."),
        maxResults: z
          .number()
          .int()
          .min(1)
          .max(500)
          .default(100)
          .describe("Maximum number of matching lines to return."),
      })
      .passthrough(),
    execute: async ({ query, path, maxResults }) => {
      const safePath = normalizeRelativePath(path ?? ".");
      if (!safePath) return { ok: false, error: "Invalid path." };

      const command = `cd ${shellQuote(WORKDIR)} && grep -RIn --exclude-dir=node_modules --exclude-dir=.next -- ${shellQuote(query)} ${shellQuote(safePath)} | head -n ${maxResults}`;
      const result = await runExecCommand(command);
      return { ...result, query, path: safePath, maxResults };
    },
  });

  const replaceInFileTool = tool({
    description:
      "Replace text in a file without using bash. Supports replacing first or all occurrences.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("Path of the file to edit."),
        search: z.string().describe("Text to find."),
        replace: z.string().describe("Replacement text."),
        all: z
          .boolean()
          .default(true)
          .describe("Replace all matches when true, otherwise first match."),
      })
      .passthrough(),
    execute: async ({ file, search, replace, all }) => {
      const safeFile = normalizeRelativePath(file);
      if (!safeFile) return { ok: false, error: "Invalid file path." };

      const original = await vm.fs.readTextFile(safeFile);
      const content =
        typeof original === "string" ? original : String(original);

      if (!search) return { ok: false, error: "Search text is required." };
      if (!content.includes(search)) {
        return {
          ok: false,
          file: safeFile,
          replacements: 0,
          error: "No matches found.",
        };
      }

      const nextContent = all
        ? content.split(search).join(replace)
        : content.replace(search, replace);
      const replacements = all
        ? content.split(search).length - 1
        : content === nextContent
          ? 0
          : 1;

      await vm.fs.writeTextFile(safeFile, nextContent);
      return { ok: true, file: safeFile, replacements };
    },
  });

  const appendToFileTool = tool({
    description:
      "Append text content to an existing file (or create it) without bash.",
    inputSchema: z
      .object({
        file: z.string().min(1).describe("Path of the file to append to."),
        content: z.string().describe("Text content to append."),
      })
      .passthrough(),
    execute: async ({ file, content }) => {
      const safeFile = normalizeRelativePath(file);
      if (!safeFile) return { ok: false, error: "Invalid file path." };

      let existing = "";
      try {
        const current = await vm.fs.readFile(safeFile);
        existing = typeof current === "string" ? current : String(current);
      } catch {
        existing = "";
      }

      await vm.fs.writeTextFile(safeFile, `${existing}${content}`);
      return { ok: true, file: safeFile, appendedBytes: content.length };
    },
  });

  const makeDirectoryTool = tool({
    description: "Create a directory path using mkdir -p semantics.",
    inputSchema: z
      .object({
        path: z.string().min(1).describe("Directory path to create."),
      })
      .passthrough(),
    execute: async ({ path }) => {
      const safePath = normalizeRelativePath(path);
      if (!safePath) return { ok: false, error: "Invalid path." };
      return runExecCommand(
        `cd ${shellQuote(WORKDIR)} && mkdir -p ${shellQuote(safePath)}`,
      );
    },
  });

  const movePathTool = tool({
    description: "Move or rename a file or directory.",
    inputSchema: z
      .object({
        from: z.string().min(1).describe("Source path."),
        to: z.string().min(1).describe("Destination path."),
      })
      .passthrough(),
    execute: async ({ from, to }) => {
      const safeFrom = normalizeRelativePath(from);
      const safeTo = normalizeRelativePath(to);
      if (!safeFrom || !safeTo) {
        return { ok: false, error: "Invalid source or destination path." };
      }
      return runExecCommand(
        `cd ${shellQuote(WORKDIR)} && mv ${shellQuote(safeFrom)} ${shellQuote(safeTo)}`,
      );
    },
  });

  const deletePathTool = tool({
    description: "Delete a file or directory path.",
    inputSchema: z
      .object({
        path: z.string().min(1).describe("File or directory path to delete."),
      })
      .passthrough(),
    execute: async ({ path }) => {
      const safePath = normalizeRelativePath(path);
      if (!safePath) return { ok: false, error: "Invalid path." };
      return runExecCommand(
        `cd ${shellQuote(WORKDIR)} && rm -rf ${shellQuote(safePath)}`,
      );
    },
  });

  return {
    bashTool,
    readFileTool,
    writeFileTool,
    listFilesTool,
    searchFilesTool,
    replaceInFileTool,
    appendToFileTool,
    makeDirectoryTool,
    movePathTool,
    deletePathTool,
  };
};
