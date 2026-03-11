import type { LoopAction, ToolCallRecord, AgenticLoopConfig } from "./types";
import {
  DUPLICATE_WINDOW_SIZE,
  DUPLICATE_WARN_THRESHOLD,
  DUPLICATE_FORCE_THRESHOLD,
  SIMILARITY_THRESHOLD,
  ERROR_CASCADE_THRESHOLD,
  ERROR_FORCE_THRESHOLD,
  OUTPUT_SIMILARITY_WINDOW,
} from "./constants";

/**
 * Computes bigram similarity between two strings (0..1).
 * Used for output similarity detection without embedding dependencies.
 */
function bigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;

  const getBigrams = (s: string): Set<string> => {
    const normalized = s.toLowerCase().replace(/\s+/g, " ").trim();
    const bigrams = new Set<string>();
    for (let i = 0; i < normalized.length - 1; i++) {
      bigrams.add(normalized.slice(i, i + 2));
    }
    return bigrams;
  };

  const bigramsA = getBigrams(a);
  const bigramsB = getBigrams(b);
  let intersection = 0;
  for (const bigram of bigramsA) {
    if (bigramsB.has(bigram)) intersection++;
  }
  const union = bigramsA.size + bigramsB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

/**
 * Hashes tool call arguments for duplicate detection.
 */
function hashArgs(args: Record<string, unknown>): string {
  try {
    return JSON.stringify(args, Object.keys(args).sort());
  } catch {
    return String(args);
  }
}

/**
 * Loop detector implementing PRD Section 9 safeguards:
 * - Step counter with soft/hard limits
 * - Duplicate action detection (rolling window)
 * - Output similarity detection
 * - Error cascade detection
 */
export class LoopDetector {
  private stepCount = 0;
  private recentCalls: ToolCallRecord[] = [];
  private recentOutputs: string[] = [];
  private consecutiveErrors = 0;
  private warnings: string[] = [];
  private config: AgenticLoopConfig;

  constructor(config: AgenticLoopConfig) {
    this.config = config;
  }

  /**
   * Called after each tool call. Returns the recommended action.
   */
  onToolCall(
    toolName: string,
    args: Record<string, unknown>,
    isError: boolean,
  ): LoopAction {
    this.stepCount++;
    this.warnings = [];

    const argsHash = hashArgs(args);
    const record: ToolCallRecord = {
      toolName,
      argsHash,
      timestamp: Date.now(),
      isError,
    };

    this.recentCalls.push(record);
    if (this.recentCalls.length > DUPLICATE_WINDOW_SIZE) {
      this.recentCalls.shift();
    }

    // ── Error cascade detection ──
    if (isError) {
      this.consecutiveErrors++;
    } else {
      this.consecutiveErrors = 0;
    }

    if (this.consecutiveErrors >= ERROR_FORCE_THRESHOLD) {
      this.warnings.push(
        `CRITICAL: ${this.consecutiveErrors} consecutive tool errors. The loop will be paused. Re-read relevant files and fundamentally change your approach.`,
      );
      return "FORCE_BREAK";
    }
    if (this.consecutiveErrors >= ERROR_CASCADE_THRESHOLD) {
      this.warnings.push(
        `WARNING: ${this.consecutiveErrors} consecutive errors detected. Consider stepping back, re-reading the relevant files, and adjusting your approach.`,
      );
      return "WARN_ERRORS";
    }

    // ── Duplicate action detection ──
    const duplicates = this.recentCalls.filter(
      (c) => c.toolName === toolName && c.argsHash === argsHash,
    ).length;

    if (duplicates >= DUPLICATE_FORCE_THRESHOLD) {
      this.warnings.push(
        `CRITICAL: You have called ${toolName} with identical arguments ${duplicates} times. This is a loop. Stopping execution.`,
      );
      return "FORCE_BREAK";
    }
    if (duplicates >= DUPLICATE_WARN_THRESHOLD) {
      this.warnings.push(
        `WARNING: You have called ${toolName} with identical arguments ${duplicates} times. This appears to be a loop. Change your approach.`,
      );
      return "WARN_DUPLICATE";
    }

    // ── Step limit checks ──
    if (this.stepCount >= this.config.hardLimit) {
      this.warnings.push(
        `HARD LIMIT REACHED: ${this.stepCount} steps executed. Maximum is ${this.config.hardLimit}. Loop forcibly terminated. Notify the user of your progress.`,
      );
      return "FORCE_STOP";
    }
    if (this.stepCount >= this.config.softLimit) {
      this.warnings.push(
        `WARNING: You are at step ${this.stepCount}/${this.config.hardLimit}. Please wrap up or checkpoint your work soon.`,
      );
      return "WARN_LIMIT";
    }

    return "CONTINUE";
  }

  /**
   * Called after each LLM text output. Checks for stuck generation patterns.
   */
  onLlmOutput(output: string): LoopAction {
    this.recentOutputs.push(output);
    if (this.recentOutputs.length > OUTPUT_SIMILARITY_WINDOW + 2) {
      this.recentOutputs.shift();
    }

    if (this.recentOutputs.length >= OUTPUT_SIMILARITY_WINDOW) {
      const last = this.recentOutputs.slice(-OUTPUT_SIMILARITY_WINDOW);
      let allSimilar = true;
      for (let i = 1; i < last.length; i++) {
        if (bigramSimilarity(last[i - 1]!, last[i]!) < SIMILARITY_THRESHOLD) {
          allSimilar = false;
          break;
        }
      }
      if (allSimilar) {
        this.warnings.push(
          `CRITICAL: Last ${OUTPUT_SIMILARITY_WINDOW} outputs are >90% similar. You appear to be stuck generating the same response. Change approach.`,
        );
        return "FORCE_BREAK_STUCK";
      }
    }

    return "CONTINUE";
  }

  /** Returns accumulated warnings for ephemeral message injection. */
  getWarnings(): string[] {
    return [...this.warnings];
  }

  /** Current step count. */
  getStepCount(): number {
    return this.stepCount;
  }

  /** Whether we've exceeded the soft limit. */
  isOverSoftLimit(): boolean {
    return this.stepCount >= this.config.softLimit;
  }

  /** Whether we've exceeded the hard limit. */
  isOverHardLimit(): boolean {
    return this.stepCount >= this.config.hardLimit;
  }

  /** Whether the loop should be forcibly stopped. */
  shouldForceStop(action: LoopAction): boolean {
    return (
      action === "FORCE_STOP" ||
      action === "FORCE_BREAK" ||
      action === "FORCE_BREAK_STUCK"
    );
  }

  /** Reset for a new task (keeps step count for conversation-level tracking). */
  resetForNewTask(): void {
    this.recentCalls = [];
    this.recentOutputs = [];
    this.consecutiveErrors = 0;
    this.warnings = [];
  }

  /** Full reset. */
  reset(): void {
    this.stepCount = 0;
    this.resetForNewTask();
  }
}
