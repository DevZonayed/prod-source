import type { AgenticLoopConfig } from "./types";

// ─── Agentic Loop Defaults ───

export const DEFAULT_LOOP_CONFIG: AgenticLoopConfig = {
  softLimit: 50,
  hardLimit: 100,
  perToolTimeout: 30_000,
  totalTaskTimeout: 30 * 60_000,
  idleTimeout: 5 * 60_000,
};

// ─── Directory Paths (inside VM workspace) ───

export const BRAIN_DIR = ".adorable/brain";
export const KNOWLEDGE_DIR = ".adorable/knowledge";

// ─── Loop Detection Thresholds ───

export const DUPLICATE_WINDOW_SIZE = 10;
export const DUPLICATE_WARN_THRESHOLD = 3;
export const DUPLICATE_FORCE_THRESHOLD = 5;
export const SIMILARITY_THRESHOLD = 0.9;
export const ERROR_CASCADE_THRESHOLD = 3;
export const ERROR_FORCE_THRESHOLD = 5;
export const OUTPUT_SIMILARITY_WINDOW = 3;

// ─── Background Process Limits ───

export const MAX_BACKGROUND_PROCESSES = 5;
export const BACKGROUND_LOG_PREFIX = "/tmp/codemine-bg";

// ─── Tool Timeouts (ms) ───

export const TOOL_TIMEOUTS: Record<string, number> = {
  run_command: 30_000,
  browser_action: 120_000,
  generate_image: 60_000,
  get_diagnostics: 60_000,
  codebase_search: 30_000,
  web_fetch: 30_000,
  web_search: 15_000,
  default: 30_000,
};

// ─── Max Results ───

export const MAX_GREP_RESULTS = 200;
export const MAX_LIST_DEPTH = 2;
export const MAX_VIEW_FILE_LINES = 2000;
export const MAX_TERMINAL_OUTPUT_LINES = 500;
export const MAX_WEB_FETCH_CHARS = 10_000;
