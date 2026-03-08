// =============================================================================
// Memory System — Unified Facade
// Single entry point for all memory operations across all three levels.
// =============================================================================

// Level 1: Global Patterns
export {
  getPattern,
  getAllPatterns,
  matchPatterns,
  getBestPattern,
  getPatternSummary,
} from "./level1-patterns";

// Level 2: Project Memory
export {
  isInitialized,
  initializeMemory,
  readMemoryFile,
  writeMemoryFile,
  appendToMemoryFile,
  updateMemorySection,
  readMemorySection,
  searchMemory,
  readSpec,
  writeSpec,
  getProjectMemoryState,
} from "./level2-project";

// Level 3: Context Assembly
export {
  assembleContext,
  assembleGeneralContext,
  estimateTokens,
  truncateToTokenBudget,
} from "./level3-context";
