// =============================================================================
// Memory & Context Tools (Category 3)
// 18 tools for reading, writing, searching, and assembling project memory.
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
  readMemorySection,
  searchMemory,
  readSpec,
  writeSpec,
  isInitialized,
  getProjectMemoryState,
} from "../../memory/level2-project";

const VALID_FILE_TYPES: MemoryFileType[] = [
  "architecture", "entities", "components", "api-endpoints",
  "business-rules", "ui-patterns", "issues-resolved", "changelog", "decisions",
];

export const createMemoryContextTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "memory_init": tool({
    description:
      "Initialize BuildForge project memory system. Creates .buildforge/memory/ with all template files. Call this first for new projects.",
    inputSchema: z.object({
      projectName: z.string().min(1).describe("Name of the project."),
      techStack: z.string().optional().describe("Tech stack summary (e.g., 'Next.js + Tailwind + shadcn/ui')."),
    }),
    execute: async ({ projectName, techStack }) => {
      const already = await isInitialized(vm);
      if (already) {
        return { ok: true, message: "BuildForge memory already initialized.", alreadyInitialized: true };
      }
      await initializeMemory(vm, projectName, techStack);
      return { ok: true, message: `BuildForge memory initialized for "${projectName}".` };
    },
  }),

  "memory_read": tool({
    description:
      "Read a specific project memory file. Returns the full content of the memory file.",
    inputSchema: z.object({
      fileType: z.enum(VALID_FILE_TYPES as [string, ...string[]]).describe(
        "Which memory file to read: architecture, entities, components, api-endpoints, business-rules, ui-patterns, issues-resolved, changelog, decisions.",
      ),
    }),
    execute: async ({ fileType }) => {
      const content = await readMemoryFile(vm, fileType as MemoryFileType);
      return { ok: !!content, fileType, content: content ?? "File not found or empty." };
    },
  }),

  "memory_read_section": tool({
    description:
      "Read a specific section from a memory file by its heading. More precise than reading the full file.",
    inputSchema: z.object({
      fileType: z.enum(VALID_FILE_TYPES as [string, ...string[]]),
      sectionHeading: z.string().describe("The ## heading of the section to read."),
    }),
    execute: async ({ fileType, sectionHeading }) => {
      const content = await readMemorySection(vm, fileType as MemoryFileType, sectionHeading);
      return { ok: !!content, fileType, section: sectionHeading, content: content ?? "Section not found." };
    },
  }),

  "memory_write": tool({
    description:
      "Write/replace the full content of a project memory file. Use for major updates.",
    inputSchema: z.object({
      fileType: z.enum(VALID_FILE_TYPES as [string, ...string[]]),
      content: z.string().describe("The full content to write to the memory file."),
    }),
    execute: async ({ fileType, content }) => {
      await writeMemoryFile(vm, fileType as MemoryFileType, content);
      return { ok: true, fileType, message: `Memory file "${fileType}" updated.` };
    },
  }),

  "memory_update_section": tool({
    description:
      "Update a specific section within a memory file. If the section doesn't exist, it's appended.",
    inputSchema: z.object({
      fileType: z.enum(VALID_FILE_TYPES as [string, ...string[]]),
      sectionHeading: z.string().describe("The ## heading of the section to update."),
      content: z.string().describe("New content for this section."),
    }),
    execute: async ({ fileType, sectionHeading, content }) => {
      const updated = await updateMemorySection(vm, fileType as MemoryFileType, sectionHeading, content);
      return { ok: updated, fileType, section: sectionHeading };
    },
  }),

  "memory_append": tool({
    description:
      "Append an entry to a memory file (useful for changelog, issues-resolved). Adds timestamp automatically.",
    inputSchema: z.object({
      fileType: z.enum(VALID_FILE_TYPES as [string, ...string[]]),
      entry: z.string().describe("The content to append."),
    }),
    execute: async ({ fileType, entry }) => {
      await appendToMemoryFile(vm, fileType as MemoryFileType, entry);
      return { ok: true, fileType, message: `Entry appended to "${fileType}".` };
    },
  }),

  "memory_search": tool({
    description:
      "Search across all project memory files for a keyword or phrase. Returns matching sections with context.",
    inputSchema: z.object({
      query: z.string().min(1).describe("Search query — keyword, entity name, or phrase."),
    }),
    execute: async ({ query }) => {
      const results = await searchMemory(vm, query);
      return {
        ok: true,
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

  "memory_status": tool({
    description:
      "Get the current status of the project memory system. Shows which files exist and if spec is loaded.",
    inputSchema: z.object({}),
    execute: async () => {
      const state = await getProjectMemoryState(vm);
      return {
        ok: true,
        initialized: state.initialized,
        hasSpec: !!state.spec,
        specName: state.spec?.name ?? null,
        files: Object.fromEntries(
          Object.entries(state.files).map(([k, v]) => [
            k,
            v ? { exists: true, length: v.content.length } : { exists: false },
          ]),
        ),
      };
    },
  }),

  "memory_log_decision": tool({
    description:
      "Record an architectural decision in the decisions memory. Important for maintaining consistency across sessions.",
    inputSchema: z.object({
      title: z.string().describe("Decision title (e.g., 'Use Zustand for state management')."),
      context: z.string().describe("Why this decision was needed."),
      optionsConsidered: z.string().describe("Options that were evaluated."),
      decision: z.string().describe("What was chosen."),
      reasoning: z.string().describe("Why this option was selected."),
    }),
    execute: async ({ title, context, optionsConsidered, decision, reasoning }) => {
      const entry = [
        `**Date**: ${new Date().toISOString().split("T")[0]}`,
        `**Status**: Accepted`,
        `**Context**: ${context}`,
        `**Options Considered**: ${optionsConsidered}`,
        `**Decision**: ${decision}`,
        `**Reasoning**: ${reasoning}`,
      ].join("\n");

      await updateMemorySection(vm, "decisions", title, entry);
      return { ok: true, message: `Decision "${title}" recorded.` };
    },
  }),

  "memory_log_issue": tool({
    description:
      "Record a resolved issue in the issues-resolved memory. Helps prevent the same mistake in future.",
    inputSchema: z.object({
      issue: z.string().describe("Description of the problem encountered."),
      rootCause: z.string().describe("What caused the issue."),
      solution: z.string().describe("How it was fixed."),
      prevention: z.string().describe("How to prevent it in future."),
    }),
    execute: async ({ issue, rootCause, solution, prevention }) => {
      const entry = [
        `**Issue**: ${issue}`,
        `**Root Cause**: ${rootCause}`,
        `**Solution**: ${solution}`,
        `**Prevention**: ${prevention}`,
      ].join("\n");

      await appendToMemoryFile(vm, "issues-resolved", entry);
      return { ok: true, message: "Issue resolution logged." };
    },
  }),
});
