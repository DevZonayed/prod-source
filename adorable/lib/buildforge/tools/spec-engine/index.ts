// =============================================================================
// Spec Engine Tools (Category 2)
// Tools for parsing requirements into structured specifications.
// The LLM does the actual NL→structure extraction; these tools store results.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "freestyle-sandboxes";
import type { BuildForgeContext, Entity, Screen, ApiEndpoint, Role, BusinessRule, AppSpec } from "../../types";
import { matchProjectPattern, getPatternDefaults } from "../../spec/pattern-matcher";
import { parseSpecFromEntities, mergeWithPattern } from "../../spec/parser";
import { validateSpec } from "../../spec/validator";
import { writeSpec } from "../../memory/level2-project";
import { writeMemoryFile, updateMemorySection } from "../../memory/level2-project";
import {
  entityExtractionSchema,
  screenExtractionSchema,
  apiExtractionSchema,
  roleExtractionSchema,
  businessRuleExtractionSchema,
} from "../../spec/types";

export const createSpecEngineTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "spec.parse": tool({
    description:
      "Parse a natural language project description into a full structured specification. This is the main entry point — call this when the user describes what they want to build. It matches patterns, extracts entities/screens/APIs, and stores the spec in project memory.",
    inputSchema: z.object({
      projectName: z.string().min(1).describe("Project name."),
      description: z.string().min(10).describe("Natural language description of the application."),
      entities: entityExtractionSchema.shape.entities.describe("Extracted entities with fields, relationships, and rules."),
      screens: screenExtractionSchema.shape.screens.describe("Extracted screens with routes, layouts, and data requirements."),
      apiEndpoints: apiExtractionSchema.shape.endpoints.describe("Extracted API endpoints."),
      roles: roleExtractionSchema.shape.roles.describe("Extracted user roles with permissions."),
      businessRules: businessRuleExtractionSchema.shape.rules.describe("Extracted business rules."),
      database: z.enum(["mongodb", "mysql", "postgresql"]).default("postgresql"),
    }),
    execute: async ({ projectName, description, entities, screens, apiEndpoints, roles, businessRules, database }) => {
      // Match against patterns
      const patternMatch = matchProjectPattern(description);
      let finalEntities = entities as Entity[];

      // Merge with pattern defaults if matched
      if (patternMatch.matchedPattern) {
        const defaults = getPatternDefaults(patternMatch.matchedPattern);
        finalEntities = mergeWithPattern(defaults.entities, entities as Entity[]);
      }

      // Build the spec
      const spec = parseSpecFromEntities({
        projectName,
        description,
        patternId: patternMatch.matchedPattern,
        entities: finalEntities,
        screens: screens as Screen[],
        apiEndpoints: apiEndpoints as ApiEndpoint[],
        roles: roles as Role[],
        businessRules: businessRules as BusinessRule[],
        techStack: { database },
      });

      // Validate
      const validation = validateSpec(spec);

      // Store spec
      await writeSpec(vm, spec);

      // Update memory files with extracted info
      await updateEntitiesMemory(vm, spec);
      await updateApiEndpointsMemory(vm, spec);
      await updateBusinessRulesMemory(vm, spec);

      return {
        ok: true,
        specStored: true,
        patternMatched: patternMatch.matchedPattern,
        patternConfidence: patternMatch.confidence,
        entityCount: spec.entities.length,
        screenCount: spec.screens.length,
        endpointCount: spec.apiEndpoints.length,
        roleCount: spec.roles.length,
        ruleCount: spec.businessRules.length,
        validation: {
          isValid: validation.isValid,
          issueCount: validation.issues.length,
          issues: validation.issues.slice(0, 5),
          suggestions: validation.suggestions.slice(0, 3),
        },
      };
    },
  }),

  "spec.pattern_match": tool({
    description:
      "Match a project description against known application patterns (e-commerce, SaaS, marketplace, CRM, CMS, booking, social, LMS). Returns the best match with suggested entities and screens.",
    inputSchema: z.object({
      description: z.string().min(5).describe("Project description to match against patterns."),
    }),
    execute: async ({ description }) => {
      const result = matchProjectPattern(description);
      return {
        ok: true,
        ...result,
      };
    },
  }),

  "spec.validate": tool({
    description:
      "Validate the current project specification for completeness and consistency. Checks for orphan entities, missing CRUD ops, undefined references, etc.",
    inputSchema: z.object({}),
    execute: async () => {
      const spec = ctx.currentSpec;
      if (!spec) {
        return { ok: false, error: "No spec found. Run spec.parse first." };
      }
      const result = validateSpec(spec);
      return { ok: true, ...result };
    },
  }),

  "spec.read": tool({
    description: "Read the current project specification.",
    inputSchema: z.object({}),
    execute: async () => {
      const spec = await import("../../memory/level2-project").then((m) => m.readSpec(vm));
      if (!spec) {
        return { ok: false, error: "No spec found. Run spec.parse first." };
      }
      return { ok: true, spec };
    },
  }),

  "spec.update_entity": tool({
    description: "Add or update a single entity in the specification.",
    inputSchema: z.object({
      entity: entityExtractionSchema.shape.entities.element.describe("Entity to add/update."),
    }),
    execute: async ({ entity }) => {
      const spec = await import("../../memory/level2-project").then((m) => m.readSpec(vm));
      if (!spec) {
        return { ok: false, error: "No spec found. Run spec.parse first." };
      }

      const idx = spec.entities.findIndex(
        (e) => e.name.toLowerCase() === entity.name.toLowerCase(),
      );
      if (idx >= 0) {
        spec.entities[idx] = entity as Entity;
      } else {
        spec.entities.push(entity as Entity);
      }
      spec.updatedAt = new Date().toISOString();

      await writeSpec(vm, spec);
      await updateEntitiesMemory(vm, spec);
      return { ok: true, action: idx >= 0 ? "updated" : "added", entity: entity.name };
    },
  }),

  "spec.add_screen": tool({
    description: "Add a new screen to the specification.",
    inputSchema: z.object({
      screen: screenExtractionSchema.shape.screens.element.describe("Screen to add."),
    }),
    execute: async ({ screen }) => {
      const spec = await import("../../memory/level2-project").then((m) => m.readSpec(vm));
      if (!spec) {
        return { ok: false, error: "No spec found. Run spec.parse first." };
      }

      spec.screens.push(screen as Screen);
      spec.updatedAt = new Date().toISOString();
      await writeSpec(vm, spec);
      return { ok: true, screen: screen.name };
    },
  }),
});

// Helpers to sync spec with memory files

async function updateEntitiesMemory(vm: Vm, spec: AppSpec) {
  const lines: string[] = [`# Entities — ${spec.name}\n> Last updated: ${new Date().toISOString().split("T")[0]}\n`];
  for (const entity of spec.entities) {
    lines.push(`## ${entity.name}`);
    lines.push(`**Description**: ${entity.description}`);
    const fields = entity.fields.map((f) => `${f.name}(${f.type}${f.required ? "" : "?"})`).join(", ");
    lines.push(`**Fields**: ${fields}`);
    const rels = entity.relationships.map((r) => `${r.type} ${r.targetEntity}`).join(", ");
    if (rels) lines.push(`**Relationships**: ${rels}`);
    if (entity.businessRules.length > 0) {
      lines.push(`**Business Rules**: ${entity.businessRules.join("; ")}`);
    }
    lines.push("");
  }
  await writeMemoryFile(vm, "entities", lines.join("\n"));
}

async function updateApiEndpointsMemory(vm: Vm, spec: AppSpec) {
  const lines: string[] = [`# API Endpoints — ${spec.name}\n> Last updated: ${new Date().toISOString().split("T")[0]}\n`];
  const byEntity = new Map<string, typeof spec.apiEndpoints>();
  for (const ep of spec.apiEndpoints) {
    const list = byEntity.get(ep.entity) ?? [];
    list.push(ep);
    byEntity.set(ep.entity, list);
  }
  for (const [entity, endpoints] of byEntity) {
    lines.push(`## ${entity}`);
    for (const ep of endpoints) {
      const auth = ep.authRequired ? (ep.roles?.length ? `[auth: ${ep.roles.join(", ")}]` : "[auth]") : "[public]";
      lines.push(`- ${ep.method} ${ep.path} — ${ep.description} ${auth}`);
    }
    lines.push("");
  }
  await writeMemoryFile(vm, "api-endpoints", lines.join("\n"));
}

async function updateBusinessRulesMemory(vm: Vm, spec: AppSpec) {
  const lines: string[] = [`# Business Rules — ${spec.name}\n> Last updated: ${new Date().toISOString().split("T")[0]}\n`];
  const byEntity = new Map<string, typeof spec.businessRules>();
  for (const rule of spec.businessRules) {
    const list = byEntity.get(rule.entity) ?? [];
    list.push(rule);
    byEntity.set(rule.entity, list);
  }
  for (const [entity, rules] of byEntity) {
    lines.push(`## ${entity}`);
    for (const rule of rules) {
      lines.push(`- ${rule.type.toUpperCase()}: ${rule.rule}`);
    }
    lines.push("");
  }
  await writeMemoryFile(vm, "business-rules", lines.join("\n"));
}
