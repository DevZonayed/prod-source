// ─── CodeMine Agentic Architecture Types ───

/** Agent mode for task management (PLANNING → EXECUTION → VERIFICATION) */
export type AgentMode = "PLANNING" | "EXECUTION" | "VERIFICATION";

/** Current task state visible to the user via task_boundary tool */
export type TaskState = {
  taskName: string;
  taskSummary: string;
  taskStatus: string;
  mode: AgentMode;
  active: boolean;
};

/** Sandbox/VM state captured for ephemeral messages */
export type SandboxState = {
  previewUrl: string;
  devServerRunning: boolean;
  devServerErrors: string[];
};

/** Context assembled for each ephemeral message injection */
export type EphemeralContext = {
  stepId: number;
  sandboxState: SandboxState;
  diagnostics: string[];
  kiSummaries: string[];
  warnings: string[];
  recentConversations?: { id: string; title: string; updatedAt: string }[];
};

/** Actions returned by the loop detector */
export type LoopAction =
  | "CONTINUE"
  | "WARN_DUPLICATE"
  | "WARN_ERRORS"
  | "WARN_LIMIT"
  | "FORCE_BREAK"
  | "FORCE_STOP"
  | "FORCE_BREAK_STUCK";

/** Record of a tool call for loop detection tracking */
export type ToolCallRecord = {
  toolName: string;
  argsHash: string;
  timestamp: number;
  isError: boolean;
};

/** Configuration for the agentic loop controller */
export type AgenticLoopConfig = {
  /** Soft step limit — triggers warning (default: 50) */
  softLimit: number;
  /** Hard step limit — forces stop (default: 100) */
  hardLimit: number;
  /** Per-tool execution timeout in ms (default: 30000) */
  perToolTimeout: number;
  /** Total task timeout in ms (default: 1800000 = 30 min) */
  totalTaskTimeout: number;
  /** Idle timeout — no tool calls or output (default: 300000 = 5 min) */
  idleTimeout: number;
};

/** Background process tracked by terminal tools */
export type BackgroundProcess = {
  pid: number;
  command: string;
  logFile: string;
  startedAt: number;
};

/** Shared mutable state for the agentic loop */
export type AgenticLoopState = {
  stepCount: number;
  taskState: TaskState | null;
  /** Files recently accessed via view_file (for get_open_files) */
  recentFiles: string[];
  /** Background processes started via run_in_background */
  backgroundProcesses: Map<string, BackgroundProcess>;
  /** Conversation ID for artifact path resolution */
  conversationId: string;
  /** Flag set by notify_user to pause the loop */
  pauseForUser: boolean;
  /** Start time for total task timeout */
  startedAt: number;
};

/** Parameters for the agentic loop */
export type AgenticLoopParams = {
  system: string;
  messages: import("ai").UIMessage[];
  tools: import("ai").ToolSet;
  config: AgenticLoopConfig;
  conversationId: string;
  repoId: string;
  previewUrl: string;
  /** LLM options passed through */
  apiKey?: string;
  providerOverride?: string;
};

/** Result from the agentic loop */
export type AgenticLoopResult = {
  stream: ReadableStream;
  loopState: AgenticLoopState;
};

/** Knowledge Item metadata */
export type KnowledgeItemMeta = {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  artifacts: string[];
};

/** Conversation artifact paths */
export type ConversationArtifacts = {
  taskMd: string;
  implementationPlan: string;
  walkthrough: string;
  logsDir: string;
};
