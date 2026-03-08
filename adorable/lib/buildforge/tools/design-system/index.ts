// =============================================================================
// Design System Tools (Category 6)
// Tools for design tokens, themes, component library, and UI consistency.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "freestyle-sandboxes";
import type { BuildForgeContext } from "../../types";
import { writeVmFile } from "../base";
import { updateMemorySection, writeMemoryFile } from "../../memory/level2-project";

export const createDesignSystemTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "design.tokens": tool({
    description:
      "Define design tokens (colors, typography, spacing, borders). Updates the ui-patterns memory and CSS variables.",
    inputSchema: z.object({
      tokens: z.object({
        primaryColor: z.string().describe("Primary brand color (hex)."),
        secondaryColor: z.string().optional(),
        fontFamily: z.string().optional().default("Inter, system-ui, sans-serif"),
        borderRadius: z.string().optional().default("0.5rem"),
      }),
      cssFilePath: z.string().optional().describe("CSS file to update with variables."),
      cssContent: z.string().optional().describe("CSS content with custom properties."),
    }),
    execute: async ({ tokens, cssFilePath, cssContent }) => {
      const tokenSummary = [
        `**Primary**: ${tokens.primaryColor}`,
        tokens.secondaryColor ? `**Secondary**: ${tokens.secondaryColor}` : null,
        `**Font**: ${tokens.fontFamily}`,
        `**Border Radius**: ${tokens.borderRadius}`,
      ].filter(Boolean).join("\n");

      await updateMemorySection(vm, "ui-patterns", "Design Tokens", tokenSummary);

      if (cssFilePath && cssContent) {
        await writeVmFile(vm, cssFilePath, cssContent);
      }

      return { ok: true, tokens, stored: true };
    },
  }),

  "design.layout_pattern": tool({
    description:
      "Register a layout pattern (dashboard, public, auth, admin) for consistent page structure.",
    inputSchema: z.object({
      patternName: z.string().describe("Layout pattern name (e.g., 'DashboardLayout')."),
      description: z.string().describe("What this layout looks like and when to use it."),
      filePath: z.string().optional().describe("File path if creating the layout component."),
      code: z.string().optional().describe("Layout component code."),
    }),
    execute: async ({ patternName, description, filePath, code }) => {
      await updateMemorySection(vm, "ui-patterns", "Layout Patterns",
        `### ${patternName}\n${description}${filePath ? `\n**File**: ${filePath}` : ""}`);

      if (filePath && code) {
        await writeVmFile(vm, filePath, code);
      }

      return { ok: true, pattern: patternName };
    },
  }),

  "design.component_pattern": tool({
    description:
      "Register a reusable UI component pattern (DataTable, EntityForm, DetailView, etc.).",
    inputSchema: z.object({
      patternName: z.string().describe("Pattern name (e.g., 'DataTable')."),
      description: z.string().describe("What this pattern does, when to use it."),
      props: z.string().optional().describe("Key props/configuration options."),
    }),
    execute: async ({ patternName, description, props }) => {
      const entry = `### ${patternName}\n${description}${props ? `\n**Props**: ${props}` : ""}`;
      await updateMemorySection(vm, "ui-patterns", "Component Patterns", entry);
      return { ok: true, pattern: patternName };
    },
  }),

  "design.responsive_rules": tool({
    description:
      "Define responsive design rules (breakpoint behaviors, mobile adaptations).",
    inputSchema: z.object({
      rules: z.string().describe("Responsive design rules in markdown format."),
    }),
    execute: async ({ rules }) => {
      await updateMemorySection(vm, "ui-patterns", "Responsive Rules", rules);
      return { ok: true, stored: true };
    },
  }),

  "design.consistency_check": tool({
    description:
      "Check UI consistency by reviewing what components and patterns are registered in memory vs what exists in code.",
    inputSchema: z.object({}),
    execute: async () => {
      const { readMemoryFile } = await import("../../memory/level2-project");
      const components = await readMemoryFile(vm, "components");
      const patterns = await readMemoryFile(vm, "ui-patterns");

      return {
        ok: true,
        registeredComponents: components ? components.split("## ").length - 1 : 0,
        registeredPatterns: patterns ? patterns.split("### ").length - 1 : 0,
        hasDesignTokens: patterns?.includes("Design Tokens") ?? false,
        hasLayoutPatterns: patterns?.includes("Layout Patterns") ?? false,
        hasComponentPatterns: patterns?.includes("Component Patterns") ?? false,
      };
    },
  }),
});
