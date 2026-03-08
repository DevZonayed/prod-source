// =============================================================================
// Thinker Engine Types
// Types specific to the orchestrator pipeline.
// =============================================================================

import { z } from "zod";

/**
 * Task decomposition input schema.
 */
export const decomposeInputSchema = z.object({
  featureDescription: z.string().min(5).describe(
    "Description of the feature to build. E.g., 'Build the product listing page with filters and pagination'.",
  ),
  scope: z.enum(["full-feature", "single-page", "component", "api-endpoint", "bug-fix"]).default("full-feature").describe(
    "Scope of the work to decompose.",
  ),
});

export type DecomposeInput = z.infer<typeof decomposeInputSchema>;

/**
 * Task decomposition output schema.
 */
export const decomposeOutputSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
      dependencies: z.array(z.string()),
      toolName: z.string(),
      entities: z.array(z.string()),
      screens: z.array(z.string()),
      estimatedComplexity: z.enum(["low", "medium", "high"]),
    }),
  ),
  executionOrder: z.array(z.array(z.string())).describe(
    "Groups of task IDs that can run in parallel. Execute groups sequentially.",
  ),
  summary: z.string(),
});

/**
 * Execution plan input (from think.plan).
 */
export const planInputSchema = z.object({
  tasks: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      description: z.string(),
      dependencies: z.array(z.string()),
      toolName: z.string(),
    }),
  ),
});

/**
 * Validation input (from think.validate).
 */
export const validateInputSchema = z.object({
  taskId: z.string().describe("ID of the task to validate."),
  filesGenerated: z.array(z.string()).describe("Files created/modified by this task."),
  checkTypes: z.array(z.enum(["typescript", "lint", "build", "runtime", "design"])).default(["typescript", "runtime"]).describe(
    "Types of validation to run.",
  ),
});

/**
 * Self-correction input.
 */
export const selfCorrectInputSchema = z.object({
  taskId: z.string(),
  error: z.string().describe("The error or validation failure to fix."),
  filesAffected: z.array(z.string()),
  attemptNumber: z.number().int().min(1).max(3).describe(
    "Which retry attempt this is (max 3).",
  ),
});

/**
 * Checkpoint input.
 */
export const checkpointInputSchema = z.object({
  taskId: z.string(),
  description: z.string().describe("What this checkpoint captures."),
});
