// =============================================================================
// Execution Planner
// Creates execution plans from decomposed tasks.
// =============================================================================

import type { Task, ExecutionPlan } from "../types";
import { MAX_TASKS_PER_PLAN, CHECKPOINT_INTERVAL } from "../constants";

/**
 * Create an execution plan from decomposed tasks.
 */
export const createPlan = (
  featureDescription: string,
  tasks: Task[],
  executionOrder: string[][],
): ExecutionPlan => {
  // Limit task count
  const limitedTasks = tasks.slice(0, MAX_TASKS_PER_PLAN);

  return {
    id: `plan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    featureDescription,
    tasks: limitedTasks,
    executionOrder,
    estimatedSteps: limitedTasks.length * 3, // ~3 tool calls per task
    status: "planning",
    checkpoints: [],
    createdAt: new Date().toISOString(),
  };
};

/**
 * Determine if a checkpoint should be created after completing a task.
 */
export const shouldCheckpoint = (
  plan: ExecutionPlan,
  completedTaskIndex: number,
): boolean => {
  if (completedTaskIndex === 0) return false;
  return (completedTaskIndex + 1) % CHECKPOINT_INTERVAL === 0;
};

/**
 * Get the next tasks to execute from the plan.
 * Returns tasks whose dependencies are all completed.
 */
export const getNextTasks = (plan: ExecutionPlan): Task[] => {
  const completedIds = new Set(
    plan.tasks.filter((t) => t.status === "completed").map((t) => t.id),
  );

  return plan.tasks.filter(
    (t) =>
      t.status === "pending" &&
      t.dependencies.every((dep) => completedIds.has(dep)),
  );
};

/**
 * Update task status within a plan.
 */
export const updateTaskInPlan = (
  plan: ExecutionPlan,
  taskId: string,
  updates: Partial<Task>,
): ExecutionPlan => {
  return {
    ...plan,
    tasks: plan.tasks.map((t) =>
      t.id === taskId ? { ...t, ...updates } : t,
    ),
  };
};

/**
 * Check if the plan is complete.
 */
export const isPlanComplete = (plan: ExecutionPlan): boolean => {
  return plan.tasks.every(
    (t) => t.status === "completed" || t.status === "skipped",
  );
};

/**
 * Check if the plan has failed.
 */
export const isPlanFailed = (plan: ExecutionPlan): boolean => {
  return plan.tasks.some(
    (t) => t.status === "failed" && t.retryCount >= t.maxRetries,
  );
};
