// =============================================================================
// BuildForge — Main Entry Point
// AI-Powered Full-Stack Application Builder Engine
// =============================================================================

// Types
export type {
  AppSpec,
  Entity,
  Screen,
  ApiEndpoint,
  Role,
  BusinessRule,
  Task,
  ExecutionPlan,
  BuildForgeContext,
  ToolCategory,
  MemoryFileType,
  PatternId,
  ValidationResult,
  AssembledContext,
  ContextAssemblyRequest,
  ProjectMemoryState,
} from "./types";

// Constants
export {
  BUILDFORGE_DIR,
  MEMORY_DIR,
  MEMORY_FILES,
  SPEC_FILE,
} from "./constants";

// Memory System
export {
  isInitialized,
  initializeMemory,
  readMemoryFile,
  writeMemoryFile,
  searchMemory,
  readSpec,
  writeSpec,
  getProjectMemoryState,
  assembleContext,
  assembleGeneralContext,
  matchPatterns,
  getBestPattern,
  getPatternSummary,
} from "./memory";

// Spec Engine
export {
  matchProjectPattern,
  validateSpec,
  parseSpecFromEntities,
} from "./spec";

// Thinker
export {
  decompose,
  createPlan,
  validateTask,
  selfCorrect,
  createCheckpoint,
} from "./thinker";

// Tools
export {
  getBuildForgeTools,
  detectPhase,
} from "./tools";
