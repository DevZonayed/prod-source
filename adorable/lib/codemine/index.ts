// ─── CodeMine Agentic Architecture ───
// Central entry point — re-exports all modules

export { createCodeMineTools } from "./tools";
export { runAgenticLoop } from "./agentic-loop";
export type { AgenticLoopParams } from "./agentic-loop";
export { LoopDetector } from "./loop-detector";
export { buildInitialEphemeral, buildStepEphemeral } from "./ephemeral";
export { CODEMINE_SYSTEM_PROMPT, buildCodeMinePrompt } from "./system-prompt";
export { DEFAULT_LOOP_CONFIG, BRAIN_DIR, KNOWLEDGE_DIR } from "./constants";
export { getKiSummaries, createKi, readKiArtifact, searchKis } from "./knowledge";
export {
  ensureBrainDir,
  writeTaskMd,
  updateTaskItem,
  writeImplementationPlan,
  writeWalkthrough,
  writeConversationLog,
} from "./artifacts";

export type {
  AgentMode,
  TaskState,
  EphemeralContext,
  LoopAction,
  ToolCallRecord,
  AgenticLoopConfig,
  AgenticLoopState,
  AgenticLoopResult,
  KnowledgeItemMeta,
  ConversationArtifacts,
  BackgroundProcess,
  SandboxState,
} from "./types";
