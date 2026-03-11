import { tool } from "ai";
import type { Vm } from "freestyle-sandboxes";
import { z } from "zod";
import { WORKDIR } from "../../vars";
import { MAX_GREP_RESULTS } from "../constants";
import { resolveAbsPath, runVmCommand, shellQuote } from "./helpers";

/**
 * Creates the 3 search tools: grep_search, codebase_search, find_by_name
 */
export function createSearchTools(vm: Vm) {
  return {
    grep_search: tool({
      description:
        "Search for a pattern across files in a directory. Must be used instead of running grep in bash. Supports regex patterns.",
      inputSchema: z.object({
        SearchPattern: z.string().describe("Regex or literal pattern to search for"),
        DirectoryPath: z
          .string()
          .optional()
          .describe("Absolute path to scope the search (default: workspace root)"),
        FilePattern: z
          .string()
          .optional()
          .describe("Glob filter e.g. '*.py', '*.ts' to narrow file types"),
        CaseSensitive: z
          .boolean()
          .default(true)
          .describe("Whether the search is case-sensitive"),
      }),
      execute: async ({
        SearchPattern,
        DirectoryPath,
        FilePattern,
        CaseSensitive,
      }) => {
        const searchDir = DirectoryPath
          ? resolveAbsPath(DirectoryPath) ?? WORKDIR
          : WORKDIR;

        const flags = ["-rn", "--color=never"];
        if (!CaseSensitive) flags.push("-i");
        if (FilePattern) flags.push(`--include=${shellQuote(FilePattern)}`);

        // Exclude common noise directories
        flags.push("--exclude-dir=node_modules");
        flags.push("--exclude-dir=.next");
        flags.push("--exclude-dir=.git");
        flags.push("--exclude-dir=dist");

        const cmd = `grep ${flags.join(" ")} ${shellQuote(SearchPattern)} ${shellQuote(searchDir)} 2>/dev/null | head -${MAX_GREP_RESULTS}`;
        const result = await runVmCommand(vm, cmd);

        const matches = result.stdout
          ? result.stdout.split("\n").filter(Boolean)
          : [];

        return {
          pattern: SearchPattern,
          directory: searchDir,
          matchCount: matches.length,
          truncated: matches.length >= MAX_GREP_RESULTS,
          results: result.stdout || "(no matches found)",
        };
      },
    }),

    codebase_search: tool({
      description:
        "Semantic search across the codebase using a natural language query. Searches for each word in the query and ranks results by relevance. Use this for broad discovery; use grep_search for exact pattern matching.",
      inputSchema: z.object({
        Query: z.string().describe("Natural language search query"),
        DirectoryPath: z
          .string()
          .optional()
          .describe("Optional directory to scope the search"),
      }),
      execute: async ({ Query, DirectoryPath }) => {
        const searchDir = DirectoryPath
          ? resolveAbsPath(DirectoryPath) ?? WORKDIR
          : WORKDIR;

        // Split query into meaningful terms (skip short words)
        const terms = Query.toLowerCase()
          .split(/\s+/)
          .filter((t) => t.length > 2);

        if (terms.length === 0) {
          return { error: "Query too short. Provide meaningful search terms." };
        }

        // Search each term and collect file matches
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

        // Sort by score (most terms matched) descending
        const ranked = [...fileScores.entries()]
          .sort((a, b) => b[1].score - a[1].score)
          .slice(0, 20);

        if (ranked.length === 0) {
          return { query: Query, results: "(no matches found)" };
        }

        const output = ranked
          .map(
            ([file, { score, lines }]) =>
              `[${score}/${terms.length} terms] ${file}\n${lines.map((l) => `  ${l}`).join("\n")}`,
          )
          .join("\n\n");

        return {
          query: Query,
          termsSearched: terms,
          filesFound: ranked.length,
          results: output,
        };
      },
    }),

    find_by_name: tool({
      description:
        "Find files or directories by name pattern. Uses fuzzy matching. Preferred over running 'find' in bash.",
      inputSchema: z.object({
        SearchPattern: z
          .string()
          .describe("File/directory name pattern (e.g. '*.ts', 'config*')"),
        DirectoryPath: z
          .string()
          .optional()
          .describe("Absolute path to scope the search"),
        Type: z
          .enum(["file", "directory", "any"])
          .default("any")
          .describe("Filter by type"),
      }),
      execute: async ({ SearchPattern, DirectoryPath, Type }) => {
        const searchDir = DirectoryPath
          ? resolveAbsPath(DirectoryPath) ?? WORKDIR
          : WORKDIR;

        const typeFlag =
          Type === "file" ? "-type f" : Type === "directory" ? "-type d" : "";

        const cmd = `find ${shellQuote(searchDir)} ${typeFlag} -name ${shellQuote(SearchPattern)} -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' 2>/dev/null | head -100 | sort`;
        const result = await runVmCommand(vm, cmd);

        const matches = result.stdout
          ? result.stdout.split("\n").filter(Boolean)
          : [];

        return {
          pattern: SearchPattern,
          type: Type,
          directory: searchDir,
          matchCount: matches.length,
          results: matches.length > 0 ? matches.join("\n") : "(no matches found)",
        };
      },
    }),
  };
}
