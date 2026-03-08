// =============================================================================
// Self-Correction Engine
// Analyzes validation failures and generates fix strategies.
// =============================================================================

import type { ValidationIssue } from "../types";
import { MAX_RETRIES } from "../constants";

export type CorrectionStrategy = {
  canAutoFix: boolean;
  strategy: string;
  suggestedActions: string[];
  shouldRetry: boolean;
};

/**
 * Analyze a validation failure and suggest a correction strategy.
 */
export const selfCorrect = (
  error: string,
  issues: ValidationIssue[],
  attemptNumber: number,
): CorrectionStrategy => {
  if (attemptNumber > MAX_RETRIES) {
    return {
      canAutoFix: false,
      strategy: "Maximum retry attempts reached. Escalating to user.",
      suggestedActions: [
        "Report the error to the user with full context",
        "Suggest manual investigation paths",
        "Create a checkpoint of current state before the failure",
      ],
      shouldRetry: false,
    };
  }

  const actions: string[] = [];
  let strategy = "";
  let canAutoFix = true;

  // Categorize the issues
  const tsErrors = issues.filter((i) => i.category === "typescript");
  const runtimeErrors = issues.filter((i) => i.category === "runtime");
  const lintErrors = issues.filter((i) => i.category === "lint");
  const buildErrors = issues.filter((i) => i.category === "build");

  if (tsErrors.length > 0) {
    strategy = "TypeScript compilation errors detected.";
    for (const err of tsErrors.slice(0, 5)) {
      if (err.message.includes("Cannot find module")) {
        actions.push(`Install missing dependency or fix import path in ${err.file ?? "affected file"}`);
      } else if (err.message.includes("Property") && err.message.includes("does not exist")) {
        actions.push(`Fix property access error in ${err.file ?? "affected file"}: ${err.message}`);
      } else if (err.message.includes("Type") && err.message.includes("is not assignable")) {
        actions.push(`Fix type mismatch in ${err.file ?? "affected file"}: ${err.message}`);
      } else {
        actions.push(`Fix TypeScript error in ${err.file ?? "affected file"}: ${err.message}`);
      }
    }
  }

  if (runtimeErrors.length > 0) {
    strategy += " Runtime errors detected.";
    actions.push("Check dev server logs for error details");
    actions.push("Verify all imports resolve correctly");
    actions.push("Check for missing environment variables");

    if (runtimeErrors.some((e) => e.message.includes("not responding"))) {
      actions.push("Dev server may have crashed — check for syntax errors in recently modified files");
    }
  }

  if (buildErrors.length > 0) {
    strategy += " Build errors detected.";
    actions.push("Review build output for the specific error");
    actions.push("Check for circular dependencies");
    actions.push("Verify all dynamic imports exist");
  }

  if (lintErrors.length > 0) {
    strategy += " Lint warnings found.";
    actions.push("Run lint auto-fix where possible");
  }

  // If error string contains common patterns
  if (error.includes("ENOENT") || error.includes("no such file")) {
    actions.push("A file or directory is missing — create it or fix the path reference");
    canAutoFix = true;
  }

  if (error.includes("EACCES") || error.includes("permission denied")) {
    actions.push("Permission issue — check file permissions");
    canAutoFix = false;
  }

  if (!strategy) {
    strategy = "Unknown error pattern.";
    actions.push(`Read the error carefully: ${error.slice(0, 200)}`);
    actions.push("Check dev server logs for more context");
    actions.push("Review recently modified files for issues");
  }

  return {
    canAutoFix,
    strategy: strategy.trim(),
    suggestedActions: actions,
    shouldRetry: canAutoFix && attemptNumber <= MAX_RETRIES,
  };
};
