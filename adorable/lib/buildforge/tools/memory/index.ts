// =============================================================================
// Memory Tools — Consolidated Query & Sync
// Two tools that replace the previous 10+ memory-context tools.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "@/lib/local-vm";
import type { BuildForgeContext, MemoryFileType } from "../../types";
import {
  initializeMemory,
  readMemoryFile,
  writeMemoryFile,
  appendToMemoryFile,
  updateMemorySection,
  searchMemory,
  readSpec,
  isInitialized,
  getProjectMemoryState,
} from "../../memory/level2-project";

const VALID_FILE_TYPES: MemoryFileType[] = [
  "architecture", "entities", "components", "api-endpoints",
  "business-rules", "ui-patterns", "issues-resolved", "changelog", "decisions",
];

const scopeEnum = z.enum([
  "all", "architecture", "entities", "components", "api-endpoints",
  "business-rules", "ui-patterns", "issues-resolved", "changelog", "decisions",
]);

const fileTypeEnum = z.enum([
  "architecture", "entities", "components", "api-endpoints",
  "business-rules", "ui-patterns", "issues-resolved", "changelog", "decisions",
]);

export const createMemoryTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  memoryQuery: tool({
    description:
      "Query project memory. Consolidates read, search, and status into one tool. " +
      "If scope is specified, reads that specific memory file. If scope is 'all' or omitted, " +
      "searches across all memory files for the query. Also returns initialization status and spec summary.",
    inputSchema: z.object({
      query: z.string().min(1).describe(
        "Feature name, keyword, or natural language question to search for in project memory.",
      ),
      scope: scopeEnum.optional().describe(
        "Which memory file to read, or 'all' to search across everything. Defaults to 'all'.",
      ),
    }),
    execute: async ({ query, scope }) => {
      const initialized = await isInitialized(vm);
      const spec = await readSpec(vm);

      const status = {
        initialized,
        hasSpec: !!spec,
        specName: spec?.name ?? null,
        specEntities: spec?.entities?.length ?? 0,
        specScreens: spec?.screens?.length ?? 0,
      };

      // If a specific scope (not "all") is provided, read that file directly
      if (scope && scope !== "all") {
        const content = await readMemoryFile(vm, scope as MemoryFileType);
        return {
          ok: !!content,
          status,
          scope,
          content: content ?? "File not found or empty.",
        };
      }

      // Otherwise, search across all memory files
      const results = await searchMemory(vm, query);
      return {
        ok: true,
        status,
        query,
        resultCount: results.length,
        results: results.slice(0, 10).map((r) => ({
          file: r.fileType,
          section: r.section,
          preview: r.content.slice(0, 300),
        })),
      };
    },
  }),

  memorySync: tool({
    description:
      "Initialize or update project memory. Supports: init (create memory system), " +
      "update (full replace of a memory file), append (add timestamped entry), " +
      "log_decision (record architectural decision), log_issue (record resolved issue).",
    inputSchema: z.object({
      action: z.enum(["init", "update", "append", "log_decision", "log_issue"]).describe(
        "The action to perform on project memory.",
      ),
      projectName: z.string().optional().describe("Project name (required for 'init')."),
      techStack: z.string().optional().describe("Tech stack summary (for 'init')."),
      fileType: fileTypeEnum.optional().describe(
        "Which memory file to update/append to (required for 'update' and 'append').",
      ),
      content: z.string().optional().describe(
        "Content to write (required for 'update' and 'append').",
      ),
      sectionHeading: z.string().optional().describe(
        "For targeted section updates within a memory file.",
      ),
      title: z.string().optional().describe("Decision title (for 'log_decision')."),
      context: z.string().optional().describe("Why the decision was needed (for 'log_decision')."),
      decision: z.string().optional().describe("What was chosen (for 'log_decision')."),
      reasoning: z.string().optional().describe("Why this option was selected (for 'log_decision')."),
      issue: z.string().optional().describe("Description of the problem (for 'log_issue')."),
      rootCause: z.string().optional().describe("What caused the issue (for 'log_issue')."),
      solution: z.string().optional().describe("How it was fixed (for 'log_issue')."),
      prevention: z.string().optional().describe("How to prevent it in future (for 'log_issue')."),
    }),
    execute: async (input) => {
      switch (input.action) {
        case "init": {
          if (!input.projectName) {
            return { ok: false, error: "projectName is required for init." };
          }
          const already = await isInitialized(vm);
          if (already) {
            return { ok: true, message: "BuildForge memory already initialized.", alreadyInitialized: true };
          }
          await initializeMemory(vm, input.projectName, input.techStack);
          return { ok: true, message: `BuildForge memory initialized for "${input.projectName}".` };
        }

        case "update": {
          if (!input.fileType) {
            return { ok: false, error: "fileType is required for update." };
          }
          if (!input.content) {
            return { ok: false, error: "content is required for update." };
          }
          if (input.sectionHeading) {
            const updated = await updateMemorySection(
              vm, input.fileType as MemoryFileType, input.sectionHeading, input.content,
            );
            return { ok: updated, fileType: input.fileType, section: input.sectionHeading };
          }
          await writeMemoryFile(vm, input.fileType as MemoryFileType, input.content);
          return { ok: true, fileType: input.fileType, message: `Memory file "${input.fileType}" updated.` };
        }

        case "append": {
          if (!input.fileType) {
            return { ok: false, error: "fileType is required for append." };
          }
          if (!input.content) {
            return { ok: false, error: "content is required for append." };
          }
          await appendToMemoryFile(vm, input.fileType as MemoryFileType, input.content);
          return { ok: true, fileType: input.fileType, message: `Entry appended to "${input.fileType}".` };
        }

        case "log_decision": {
          if (!input.title || !input.decision) {
            return { ok: false, error: "title and decision are required for log_decision." };
          }
          const entry = [
            `**Date**: ${new Date().toISOString().split("T")[0]}`,
            `**Status**: Accepted`,
            input.context ? `**Context**: ${input.context}` : null,
            `**Decision**: ${input.decision}`,
            input.reasoning ? `**Reasoning**: ${input.reasoning}` : null,
          ].filter(Boolean).join("\n");

          await updateMemorySection(vm, "decisions", input.title, entry);
          return { ok: true, message: `Decision "${input.title}" recorded.` };
        }

        case "log_issue": {
          if (!input.issue || !input.solution) {
            return { ok: false, error: "issue and solution are required for log_issue." };
          }
          const issueEntry = [
            `**Issue**: ${input.issue}`,
            input.rootCause ? `**Root Cause**: ${input.rootCause}` : null,
            `**Solution**: ${input.solution}`,
            input.prevention ? `**Prevention**: ${input.prevention}` : null,
          ].filter(Boolean).join("\n");

          await appendToMemoryFile(vm, "issues-resolved", issueEntry);
          return { ok: true, message: "Issue resolution logged." };
        }

        default:
          return { ok: false, error: `Unknown action: ${input.action}` };
      }
    },
  }),
});
