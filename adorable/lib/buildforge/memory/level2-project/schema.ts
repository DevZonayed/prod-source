// =============================================================================
// Memory File Validation Schemas
// Zod schemas for structured memory content validation.
// =============================================================================

import { z } from "zod";

/**
 * Entity definition as stored in entities.md (structured JSON section).
 */
export const entityMemorySchema = z.object({
  name: z.string(),
  description: z.string(),
  fields: z.array(
    z.object({
      name: z.string(),
      type: z.string(),
      required: z.boolean(),
      unique: z.boolean().optional(),
      description: z.string().optional(),
    }),
  ),
  relationships: z.array(
    z.object({
      type: z.enum(["has_one", "has_many", "belongs_to", "many_to_many"]),
      target: z.string(),
    }),
  ),
  businessRules: z.array(z.string()),
});

/**
 * Component definition as stored in components.md.
 */
export const componentMemorySchema = z.object({
  name: z.string(),
  path: z.string(),
  props: z.record(z.string(), z.string()),
  usedIn: z.array(z.string()),
  pattern: z.string().optional(),
});

/**
 * API endpoint definition as stored in api-endpoints.md.
 */
export const apiEndpointMemorySchema = z.object({
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  path: z.string(),
  description: z.string(),
  entity: z.string(),
  authRequired: z.boolean(),
  roles: z.array(z.string()).optional(),
});

/**
 * Decision record as stored in decisions.md.
 */
export const decisionMemorySchema = z.object({
  title: z.string(),
  date: z.string(),
  status: z.enum(["accepted", "superseded", "deprecated"]),
  context: z.string(),
  options: z.array(z.string()),
  decision: z.string(),
  reasoning: z.string(),
  consequences: z.string(),
});

/**
 * Issue resolved record as stored in issues-resolved.md.
 */
export const issueMemorySchema = z.object({
  issue: z.string(),
  rootCause: z.string(),
  solution: z.string(),
  prevention: z.string(),
});
