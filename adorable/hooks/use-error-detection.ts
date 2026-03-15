"use client";

import { useState, useEffect, useCallback } from "react";

export type DetectedError = {
  id: string;
  type: "terminal" | "runtime" | "build" | "visual";
  message: string;
  details: string;
  timestamp: number;
  dismissed: boolean;
};

export function useErrorDetection() {
  const [errors, setErrors] = useState<DetectedError[]>([]);
  const [latestError, setLatestError] = useState<DetectedError | null>(null);

  // Listen for errors from tool results (checkAppTool, devServerLogsTool, bashTool)
  useEffect(() => {
    const handleToolError = (event: Event) => {
      const { toolName, result } = (event as CustomEvent).detail ?? {};
      if (!toolName || !result) return;

      const r = typeof result === "object" ? result : {};
      let errorMessage: string | null = null;
      let errorDetails = "";
      let errorType: DetectedError["type"] = "runtime";

      // checkAppTool errors
      if (toolName === "checkAppTool" && r.ok === false) {
        const statusCode = typeof r.statusCode === "number" ? r.statusCode : null;
        const issues = Array.isArray(r.issues) ? r.issues : [];
        const raw = typeof r.raw === "string" ? r.raw : "";
        const logsError = typeof r.logsError === "string" ? r.logsError : "";
        const errorStr = typeof r.error === "string" ? r.error : "";

        if (issues.length > 0) {
          errorType = "runtime";
          errorMessage = `${issues.length} runtime error(s) detected`;
          errorDetails = [
            statusCode ? `HTTP ${statusCode}` : null,
            ...issues.slice(0, 15),
          ].filter(Boolean).join("\n");
        } else if (statusCode && statusCode >= 400) {
          errorType = "build";
          errorMessage = `App returned HTTP ${statusCode}`;
          errorDetails = [errorStr, raw, logsError].filter(Boolean).join("\n").slice(0, 800);
        } else {
          errorType = "build";
          errorMessage = "Dev server is not reachable";
          errorDetails = [
            "The dev server may have crashed or failed to start.",
            errorStr ? `Error: ${errorStr}` : null,
            raw ? `Raw response: ${raw}` : null,
            logsError ? `Log error: ${logsError}` : null,
            "Possible causes: syntax error in code, missing dependency, port conflict, or crashed process.",
          ].filter(Boolean).join("\n");
        }
      }

      // devServerLogsTool errors
      if (toolName === "devServerLogsTool" && typeof r.logs === "string") {
        const errorLines = (r.logs as string)
          .split("\n")
          .filter((line: string) =>
            /(error|failed to compile|module not found|unhandled runtime|typeerror|syntaxerror|referenceerror)/i.test(
              line,
            ),
          );
        if (errorLines.length > 0) {
          errorType = "build";
          errorMessage = `${errorLines.length} error(s) in dev server logs`;
          errorDetails = errorLines.slice(0, 15).join("\n");
        }
      }

      // bashTool errors (non-zero exit)
      if (toolName === "bashTool" && r.ok === false) {
        const stderr = typeof r.stderr === "string" ? r.stderr : "";
        const stdout = typeof r.stdout === "string" ? r.stdout : "";
        const command = typeof r.command === "string" ? r.command : "";
        const exitCode = typeof r.exitCode === "number" ? r.exitCode : null;
        if (
          (stderr || stdout) &&
          /(error|failed|cannot find|module not found|ENOENT|permission denied|command not found)/i.test(stderr || stdout)
        ) {
          errorType = "terminal";
          errorMessage = command
            ? `Command failed: ${command.slice(0, 80)}`
            : "Command failed with errors";
          errorDetails = [
            exitCode !== null ? `Exit code: ${exitCode}` : null,
            stderr ? `stderr:\n${stderr.slice(0, 600)}` : null,
            stdout && !stderr ? `stdout:\n${stdout.slice(0, 600)}` : null,
          ].filter(Boolean).join("\n");
        }
      }

      if (errorMessage) {
        const error: DetectedError = {
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          type: errorType,
          message: errorMessage,
          details: errorDetails,
          timestamp: Date.now(),
          dismissed: false,
        };
        setErrors((prev) => [...prev.slice(-9), error]);
        setLatestError(error);
      }
    };

    window.addEventListener(
      "voxel:tool-error",
      handleToolError as EventListener,
    );
    return () =>
      window.removeEventListener(
        "voxel:tool-error",
        handleToolError as EventListener,
      );
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) =>
      prev.map((e) => (e.id === id ? { ...e, dismissed: true } : e)),
    );
    setLatestError((prev) => (prev?.id === id ? null : prev));
  }, []);

  const dismissAll = useCallback(() => {
    setErrors((prev) => prev.map((e) => ({ ...e, dismissed: true })));
    setLatestError(null);
  }, []);

  const fixError = useCallback(
    (error: DetectedError) => {
      // Build an actionable fix prompt with full context
      const instructions: Record<DetectedError["type"], string> = {
        build: [
          `The app has a build error and needs to be fixed.`,
          ``,
          `**Error:** ${error.message}`,
          ``,
          `**Details:**`,
          "```",
          error.details,
          "```",
          ``,
          `Please:`,
          `1. Read the dev server logs with devServerLogsTool to get the full error trace`,
          `2. Identify the file and line causing the error`,
          `3. Read the problematic file and fix the issue`,
          `4. Verify with checkAppTool that the app is healthy again`,
        ].join("\n"),
        runtime: [
          `The app has runtime errors that need to be fixed.`,
          ``,
          `**Error:** ${error.message}`,
          ``,
          `**Error output:**`,
          "```",
          error.details,
          "```",
          ``,
          `Please:`,
          `1. Read the dev server logs to get the full error context`,
          `2. Identify the root cause from the error messages above`,
          `3. Fix the affected files`,
          `4. Verify with checkAppTool that the errors are resolved`,
        ].join("\n"),
        terminal: [
          `A terminal command failed and needs attention.`,
          ``,
          `**Error:** ${error.message}`,
          ``,
          `**Output:**`,
          "```",
          error.details,
          "```",
          ``,
          `Please diagnose what went wrong and fix it. Common causes: missing dependencies (run npm install), incorrect file paths, or syntax errors in config files.`,
        ].join("\n"),
        visual: [
          `A visual issue was detected in the app preview.`,
          ``,
          `**Error:** ${error.message}`,
          ``,
          `**Details:**`,
          "```",
          error.details,
          "```",
          ``,
          `Please check the relevant components and fix the visual issue.`,
        ].join("\n"),
      };

      window.dispatchEvent(
        new CustomEvent("voxel:auto-prompt", {
          detail: { text: instructions[error.type] },
        }),
      );
      dismissError(error.id);
    },
    [dismissError],
  );

  return { errors, latestError, dismissError, dismissAll, fixError };
}
