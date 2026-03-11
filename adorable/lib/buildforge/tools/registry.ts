// =============================================================================
// Tool Registry
// Central registry for all BuildForge tools with category-based selection.
// =============================================================================

import type { ToolSet } from "ai";
import type { Vm } from "freestyle-sandboxes";
import type { ToolCategory, ToolPhase, BuildForgeContext } from "../types";
import { PHASE_TOOL_CATEGORIES, MAX_TOOLS_PER_CALL } from "../constants";

import { createMemoryContextTools } from "./memory-context";
import { createSpecEngineTools } from "./spec-engine";
import { createThinkerTools } from "./thinker";
import { createFrontendGenTools } from "./frontend-gen";
import { createBackendGenTools } from "./backend-gen";
import { createDesignSystemTools } from "./design-system";
import { createTestingQaTools } from "./testing-qa";
import { createDevopsTools } from "./devops";
import { createRepoAnalysisTools } from "./repo-analysis";
import { createProjectInitTools } from "./project-init";

type CategoryToolFactory = (vm: Vm, ctx: BuildForgeContext) => ToolSet;

const TOOL_FACTORIES: Record<ToolCategory, CategoryToolFactory | null> = {
  base: null, // Base tools come from the existing create-tools.ts
  "project-init": createProjectInitTools,
  "spec-engine": createSpecEngineTools,
  "memory-context": createMemoryContextTools,
  "frontend-gen": createFrontendGenTools,
  "backend-gen": createBackendGenTools,
  "design-system": createDesignSystemTools,
  "testing-qa": createTestingQaTools,
  devops: createDevopsTools,
  "repo-analysis": createRepoAnalysisTools,
  thinker: createThinkerTools,
};

/**
 * Get all tools for a specific category.
 */
export const getToolsByCategory = (
  category: ToolCategory,
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => {
  const factory = TOOL_FACTORIES[category];
  if (!factory) return {};
  return factory(vm, ctx);
};

/**
 * Get tools for a specific phase of development.
 * Automatically selects relevant categories and respects the max tools limit.
 */
export const getToolsForPhase = (
  phase: ToolPhase,
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => {
  const categories = PHASE_TOOL_CATEGORIES[phase];
  const tools: ToolSet = {};

  // Always include project-init, spec-engine, and memory-context tools
  // so the LLM can initialize AND generate code in the same turn.
  const alwaysInclude: ToolCategory[] = ["project-init", "spec-engine", "memory-context"];
  const allCategories = new Set([...categories, ...alwaysInclude]);

  for (const category of allCategories) {
    if (category === "base") continue; // Base tools added separately
    const categoryTools = getToolsByCategory(category, vm, ctx);
    Object.assign(tools, categoryTools);
  }

  // Enforce max tools limit
  const entries = Object.entries(tools);
  if (entries.length > MAX_TOOLS_PER_CALL) {
    const limited = Object.fromEntries(entries.slice(0, MAX_TOOLS_PER_CALL));
    return limited;
  }

  return tools;
};

/**
 * Get all BuildForge tools (for cases where phase detection isn't needed).
 * Warning: may exceed max tools per call — use getToolsForPhase instead.
 */
export const getAllBuildForgeTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => {
  const tools: ToolSet = {};

  for (const [category, factory] of Object.entries(TOOL_FACTORIES)) {
    if (!factory || category === "base") continue;
    Object.assign(tools, factory(vm, ctx));
  }

  return tools;
};

/**
 * Detect the current development phase from context.
 * Always includes generation tools so the LLM can write code immediately
 * without being blocked by initialization ceremony.
 */
export const detectPhase = (ctx: BuildForgeContext): ToolPhase => {
  // Active plan with all tasks done = validation
  if (ctx.activePlan) {
    const allDone = ctx.activePlan.tasks.every(
      (t) => t.status === "completed" || t.status === "skipped",
    );
    if (allDone) return "validation";
    return "generation";
  }

  // Default to generation — always give the LLM the ability to write code.
  // Init and spec tools are still available via the merged base tools.
  // This prevents the LLM from being stuck in "initialization" phase
  // unable to write any code for simple tasks like landing pages.
  return "generation";
};
