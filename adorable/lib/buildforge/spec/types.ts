// =============================================================================
// Spec Engine Types
// Types specific to the specification parsing pipeline.
// =============================================================================

import { z } from "zod";

/**
 * Input for spec parsing — what the user provides.
 */
export const specParseInputSchema = z.object({
  description: z
    .string()
    .min(10)
    .describe(
      "Natural language description of the application to build. Include business domain, key features, user types, and any specific requirements.",
    ),
  projectName: z
    .string()
    .min(1)
    .describe("Name of the project."),
  preferences: z
    .object({
      database: z.enum(["mongodb", "mysql", "postgresql"]).optional(),
      auth: z.enum(["jwt", "session", "oauth", "nextauth"]).optional(),
      apiStyle: z.enum(["rest", "graphql", "trpc"]).optional(),
    })
    .optional()
    .describe("Optional tech stack preferences."),
});

export type SpecParseInput = z.infer<typeof specParseInputSchema>;

/**
 * Output of entity extraction.
 */
export const entityExtractionSchema = z.object({
  entities: z.array(
    z.object({
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
          targetEntity: z.string(),
          foreignKey: z.string().optional(),
        }),
      ),
      businessRules: z.array(z.string()),
    }),
  ),
});

/**
 * Output of screen extraction.
 */
export const screenExtractionSchema = z.object({
  screens: z.array(
    z.object({
      name: z.string(),
      route: z.string(),
      description: z.string(),
      layout: z.string(),
      accessRoles: z.array(z.string()),
      entities: z.array(z.string()),
      dataRequirements: z
        .array(
          z.object({
            entity: z.string(),
            fields: z.array(z.string()),
            filters: z.array(z.string()).optional(),
            pagination: z.boolean().optional(),
          }),
        )
        .optional()
        .default([]),
      interactions: z
        .array(
          z.object({
            trigger: z.string(),
            action: z.string(),
            description: z.string(),
          }),
        )
        .optional()
        .default([]),
      states: z
        .array(
          z.object({
            name: z.string(),
            description: z.string(),
          }),
        )
        .optional()
        .default([]),
      acceptanceCriteria: z.array(z.string()).optional().default([]),
    }),
  ),
});

/**
 * Output of API extraction.
 */
export const apiExtractionSchema = z.object({
  endpoints: z.array(
    z.object({
      method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
      path: z.string(),
      description: z.string(),
      entity: z.string(),
      authRequired: z.boolean(),
      roles: z.array(z.string()).optional(),
    }),
  ),
});

/**
 * Output of role extraction.
 */
export const roleExtractionSchema = z.object({
  roles: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      permissions: z.array(z.string()),
      inheritsFrom: z.string().optional(),
    }),
  ),
});

/**
 * Output of business rule extraction.
 */
export const businessRuleExtractionSchema = z.object({
  rules: z.array(
    z.object({
      entity: z.string(),
      rule: z.string(),
      type: z.enum(["validation", "workflow", "constraint", "computation"]),
    }),
  ),
});

/**
 * Pattern match result.
 */
export const patternMatchSchema = z.object({
  matchedPattern: z.string().nullable(),
  confidence: z.number(),
  matchedKeywords: z.array(z.string()),
  suggestedEntities: z.array(z.string()),
  suggestedScreens: z.array(z.string()),
});

/**
 * Spec validation result.
 */
export const specValidationSchema = z.object({
  isValid: z.boolean(),
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warning", "info"]),
      category: z.string(),
      message: z.string(),
    }),
  ),
  suggestions: z.array(z.string()),
});
