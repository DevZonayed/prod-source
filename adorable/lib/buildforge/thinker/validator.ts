// =============================================================================
// Post-Generation Validator
// Validates generated code by running TypeScript, lint, and runtime checks.
// =============================================================================

import type { Vm } from "@/lib/local-vm";
import type { ValidationResult, ValidationIssue } from "../types";
import { WORKDIR } from "../../vars";

/**
 * Validate generated files using available checks.
 */
export const validateTask = async (
  vm: Vm,
  filesGenerated: string[],
  checkTypes: string[],
): Promise<ValidationResult> => {
  const issues: ValidationIssue[] = [];

  // TypeScript check
  if (checkTypes.includes("typescript")) {
    const tsIssues = await checkTypeScript(vm);
    issues.push(...tsIssues);
  }

  // Runtime check (is the app running?)
  if (checkTypes.includes("runtime")) {
    const runtimeIssues = await checkRuntime(vm);
    issues.push(...runtimeIssues);
  }

  // Lint check
  if (checkTypes.includes("lint")) {
    const lintIssues = await checkLint(vm);
    issues.push(...lintIssues);
  }

  // Build check
  if (checkTypes.includes("build")) {
    const buildIssues = await checkBuild(vm);
    issues.push(...buildIssues);
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;
  const warningCount = issues.filter((i) => i.severity === "warning").length;

  return {
    passed: errorCount === 0,
    issues,
    summary: errorCount === 0
      ? `Validation passed${warningCount > 0 ? ` with ${warningCount} warnings` : ""}.`
      : `Validation failed with ${errorCount} errors and ${warningCount} warnings.`,
  };
};

async function runCommand(
  vm: Vm,
  command: string,
): Promise<{ ok: boolean; stdout: string; stderr: string }> {
  try {
    const result = await vm.exec({ command });
    if (typeof result === "string") {
      return { ok: true, stdout: result, stderr: "" };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      return {
        ok: typeof r.exitCode === "number" ? r.exitCode === 0 : true,
        stdout: typeof r.stdout === "string" ? r.stdout : "",
        stderr: typeof r.stderr === "string" ? r.stderr : "",
      };
    }
    return { ok: true, stdout: String(result ?? ""), stderr: "" };
  } catch (e) {
    return { ok: false, stdout: "", stderr: String(e) };
  }
}

async function checkTypeScript(vm: Vm): Promise<ValidationIssue[]> {
  const result = await runCommand(
    vm,
    `cd ${WORKDIR} && npx tsc --noEmit --pretty 2>&1 | head -50`,
  );

  if (result.ok) return [];

  const output = result.stdout || result.stderr;
  const issues: ValidationIssue[] = [];

  // Parse TypeScript error output
  const errorLines = output.split("\n").filter((l) => /error TS\d+/.test(l));
  for (const line of errorLines.slice(0, 10)) {
    const fileMatch = line.match(/^(.+?)\((\d+),(\d+)\):\s*error\s+(TS\d+):\s*(.+)/);
    if (fileMatch) {
      issues.push({
        severity: "error",
        category: "typescript",
        message: `${fileMatch[4]}: ${fileMatch[5]}`,
        file: fileMatch[1],
        line: parseInt(fileMatch[2]),
      });
    } else {
      issues.push({
        severity: "error",
        category: "typescript",
        message: line.trim(),
      });
    }
  }

  if (issues.length === 0 && output.trim()) {
    issues.push({
      severity: "error",
      category: "typescript",
      message: output.slice(0, 500),
    });
  }

  return issues;
}

async function checkRuntime(vm: Vm): Promise<ValidationIssue[]> {
  const result = await runCommand(
    vm,
    `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo "000"`,
  );

  const statusCode = parseInt(result.stdout.trim()) || 0;
  if (statusCode >= 200 && statusCode < 400) return [];

  if (statusCode === 0) {
    return [
      {
        severity: "error",
        category: "runtime",
        message: "Dev server is not responding. It may have crashed.",
      },
    ];
  }

  return [
    {
      severity: "error",
      category: "runtime",
      message: `Dev server returned HTTP ${statusCode}.`,
    },
  ];
}

async function checkLint(vm: Vm): Promise<ValidationIssue[]> {
  const result = await runCommand(
    vm,
    `cd ${WORKDIR} && npx next lint --quiet 2>&1 | head -30`,
  );

  if (result.ok) return [];

  const output = result.stdout || result.stderr;
  if (!output.trim()) return [];

  return [
    {
      severity: "warning",
      category: "lint",
      message: output.slice(0, 500),
    },
  ];
}

async function checkBuild(vm: Vm): Promise<ValidationIssue[]> {
  const result = await runCommand(
    vm,
    `cd ${WORKDIR} && npx next build 2>&1 | tail -20`,
  );

  if (result.ok) return [];

  return [
    {
      severity: "error",
      category: "build",
      message: `Build failed: ${(result.stdout || result.stderr).slice(0, 500)}`,
    },
  ];
}
