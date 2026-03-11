// =============================================================================
// Testing & QA Tools (Category 7)
// Tools for running tests, linting, type-checking, and quality validation.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "freestyle-sandboxes";
import type { BuildForgeContext } from "../../types";
import { writeVmFile, runVmCommand, WORKDIR } from "../base";

export const createTestingQaTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "test_unit": tool({
    description:
      "Generate and optionally run a unit test file for a component or utility.",
    inputSchema: z.object({
      testFilePath: z.string().describe("Test file path (e.g., '__tests__/utils.test.ts')."),
      testCode: z.string().describe("Complete test file content."),
      run: z.boolean().default(false).describe("Whether to run the test immediately."),
    }),
    execute: async ({ testFilePath, testCode, run }) => {
      await writeVmFile(vm, testFilePath, testCode);

      if (run) {
        const result = await runVmCommand(
          vm,
          `cd ${WORKDIR} && npx vitest run ${testFilePath} 2>&1 | tail -30`,
        );
        return { ok: result.ok, file: testFilePath, testOutput: result.stdout.slice(-1000) };
      }

      return { ok: true, file: testFilePath, run: false };
    },
  }),

  "quality_type_check": tool({
    description:
      "Run TypeScript type checking (tsc --noEmit) on the project.",
    inputSchema: z.object({}),
    execute: async () => {
      const result = await runVmCommand(
        vm,
        `cd ${WORKDIR} && npx tsc --noEmit --pretty 2>&1 | tail -40`,
      );
      const hasErrors = !result.ok || result.stdout.includes("error TS");
      return {
        ok: !hasErrors,
        errors: hasErrors ? result.stdout.slice(-1000) : null,
        message: hasErrors ? "TypeScript errors found." : "No type errors.",
      };
    },
  }),

  "quality_lint": tool({
    description:
      "Run ESLint/Next lint on the project.",
    inputSchema: z.object({
      fix: z.boolean().default(false).describe("Auto-fix lint issues."),
    }),
    execute: async ({ fix }) => {
      const cmd = fix
        ? `cd ${WORKDIR} && npx next lint --fix 2>&1 | tail -30`
        : `cd ${WORKDIR} && npx next lint 2>&1 | tail -30`;
      const result = await runVmCommand(vm, cmd);
      return { ok: result.ok, output: result.stdout.slice(-1000) };
    },
  }),

  "quality_build_check": tool({
    description:
      "Run a production build (next build) to catch build-time errors.",
    inputSchema: z.object({}),
    execute: async () => {
      const result = await runVmCommand(
        vm,
        `cd ${WORKDIR} && npx next build 2>&1 | tail -30`,
      );
      return {
        ok: result.ok,
        output: result.stdout.slice(-1000),
        message: result.ok ? "Build successful." : "Build failed.",
      };
    },
  }),

  "quality_code_review": tool({
    description:
      "Review a file for common issues: unused imports, console.logs, hardcoded values, missing error handling.",
    inputSchema: z.object({
      filePath: z.string().describe("File to review."),
    }),
    execute: async ({ filePath }) => {
      const checks = [
        { name: "console.log", cmd: `grep -n 'console\\.log' ${WORKDIR}/${filePath} | head -5` },
        { name: "any type", cmd: `grep -n ': any' ${WORKDIR}/${filePath} | head -5` },
        { name: "TODO", cmd: `grep -n 'TODO\\|FIXME\\|HACK' ${WORKDIR}/${filePath} | head -5` },
        { name: "hardcoded URLs", cmd: `grep -n 'http://\\|https://' ${WORKDIR}/${filePath} | head -5` },
      ];

      const findings: Array<{ check: string; matches: string }> = [];
      for (const check of checks) {
        const result = await runVmCommand(vm, check.cmd);
        if (result.stdout.trim()) {
          findings.push({ check: check.name, matches: result.stdout.trim() });
        }
      }

      return { ok: findings.length === 0, findings, reviewedFile: filePath };
    },
  }),
});
