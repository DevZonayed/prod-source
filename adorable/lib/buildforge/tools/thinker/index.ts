// =============================================================================
// Thinker Tools (Category 10)
// Orchestration tools: decompose, plan, validate, self-correct, checkpoint.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "@/lib/local-vm";
import type { BuildForgeContext, TaskType } from "../../types";
import { decompose } from "../../thinker/decompose";
import { createPlan, getNextTasks, isPlanComplete } from "../../thinker/planner";
import { validateTask } from "../../thinker/validator";
import { selfCorrect } from "../../thinker/self-correct";
import { createCheckpoint, rollbackToCheckpoint, listCheckpoints } from "../../thinker/checkpoint";
import { decomposeOutputSchema } from "../../thinker/types";

export const createThinkerTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "think_decompose": tool({
    description:
      "Decompose a feature request into atomic tasks with dependency ordering. Returns a task graph showing what needs to be built and in what order. Call this before starting any multi-step generation work.",
    inputSchema: z.object({
      featureDescription: z.string().min(5).describe("Description of the feature to build."),
      scope: z.enum(["full-feature", "single-page", "component", "api-endpoint", "bug-fix"]).default("full-feature"),
    }),
    execute: async ({ featureDescription, scope }) => {
      const result = decompose(featureDescription, scope, ctx.currentSpec);
      return {
        ok: true,
        taskCount: result.tasks.length,
        executionGroups: result.executionOrder.length,
        summary: result.summary,
        tasks: result.tasks.map((t) => ({
          id: t.id,
          type: t.type,
          description: t.description,
          dependencies: t.dependencies,
          tool: t.toolName,
          entities: t.contextRequirements.entities,
        })),
        executionOrder: result.executionOrder,
      };
    },
  }),

  "think_plan": tool({
    description:
      "Create a detailed execution plan from decomposed tasks. Sets up the plan for step-by-step execution.",
    inputSchema: z.object({
      featureDescription: z.string(),
      tasks: z.array(z.object({
        id: z.string(),
        type: z.string(),
        description: z.string(),
        dependencies: z.array(z.string()),
        toolName: z.string(),
      })),
      executionOrder: z.array(z.array(z.string())),
    }),
    execute: async ({ featureDescription, tasks, executionOrder }) => {
      const plan = createPlan(
        featureDescription,
        tasks.map((t) => ({
          ...t,
          type: t.type as TaskType,
          status: "pending" as const,
          contextRequirements: { entities: [], screens: [], patterns: [] },
          retryCount: 0,
          maxRetries: 3,
        })),
        executionOrder,
      );

      return {
        ok: true,
        planId: plan.id,
        taskCount: plan.tasks.length,
        estimatedSteps: plan.estimatedSteps,
        firstTasks: getNextTasks(plan).map((t) => ({
          id: t.id,
          description: t.description,
          tool: t.toolName,
        })),
      };
    },
  }),

  "think_validate": tool({
    description:
      "Validate generated code after a task. Runs TypeScript, runtime, and optionally lint/build checks. ALWAYS call this after generating code to ensure quality.",
    inputSchema: z.object({
      filesGenerated: z.array(z.string()).describe("Files created or modified."),
      checkTypes: z.array(z.enum(["typescript", "lint", "build", "runtime", "design"])).default(["typescript", "runtime"]),
    }),
    execute: async ({ filesGenerated, checkTypes }) => {
      const result = await validateTask(vm, filesGenerated, checkTypes);
      return {
        ok: result.passed,
        ...result,
      };
    },
  }),

  "think_self_correct": tool({
    description:
      "When validation fails, analyze the error and get a correction strategy. Suggests specific actions to fix the issues. Max 3 retries before escalating to user.",
    inputSchema: z.object({
      error: z.string().describe("The error or validation failure description."),
      issues: z.array(z.object({
        severity: z.enum(["error", "warning", "info"]),
        category: z.string(),
        message: z.string(),
        file: z.string().optional(),
      })).default([]),
      attemptNumber: z.number().int().min(1).max(3).default(1),
    }),
    execute: async ({ error, issues, attemptNumber }) => {
      const strategy = selfCorrect(
        error,
        issues.map((i) => ({ ...i, line: undefined, suggestion: undefined })),
        attemptNumber,
      );
      return {
        ok: true,
        ...strategy,
      };
    },
  }),

  "think_checkpoint": tool({
    description:
      "Create a checkpoint (git commit) of the current state. Use this at milestones so you can rollback if something goes wrong later.",
    inputSchema: z.object({
      description: z.string().describe("What this checkpoint captures."),
    }),
    execute: async ({ description }) => {
      const checkpoint = await createCheckpoint(vm, "manual", description);
      if (!checkpoint) {
        return { ok: true, message: "No changes to checkpoint." };
      }
      return { ok: true, checkpoint };
    },
  }),

  "think_rollback": tool({
    description:
      "Rollback to a previous checkpoint. Use when generation goes wrong and you need to start a task over.",
    inputSchema: z.object({
      commitSha: z.string().describe("The commit SHA to rollback to."),
    }),
    execute: async ({ commitSha }) => {
      const success = await rollbackToCheckpoint(vm, {
        id: "rollback",
        taskId: "manual",
        commitSha,
        description: "Manual rollback",
        createdAt: new Date().toISOString(),
      });
      return { ok: success, message: success ? "Rolled back successfully." : "Rollback failed." };
    },
  }),

  "think_list_checkpoints": tool({
    description: "List all BuildForge checkpoints (rollback points).",
    inputSchema: z.object({}),
    execute: async () => {
      const checkpoints = await listCheckpoints(vm);
      return { ok: true, checkpoints };
    },
  }),
});
