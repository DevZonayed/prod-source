// =============================================================================
// Tool Registry
// Simplified registry — only memory tools. The LLM uses base file/bash tools
// directly for code generation.
// =============================================================================

import type { ToolSet } from "ai";
import type { Vm } from "@/lib/local-vm";
import type { BuildForgeContext } from "../types";
import { createMemoryTools } from "./memory";

/**
 * Get all BuildForge tools (memory tools only).
 */
export const getBuildForgeTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => {
  return createMemoryTools(vm, ctx);
};

/**
 * Detect the current development phase from context.
 * Simplified — always returns "generation" since phase-based tool
 * filtering was removed in the SATS reduction.
 */
export const detectPhase = (_ctx: BuildForgeContext): string => {
  return "generation";
};
