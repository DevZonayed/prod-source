// =============================================================================
// Spec Validator
// Validates a parsed spec for completeness and consistency.
// =============================================================================

import type { AppSpec, ValidationIssue } from "../types";

export type SpecValidationResult = {
  isValid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
};

/**
 * Validate an AppSpec for completeness and consistency.
 */
export const validateSpec = (spec: AppSpec): SpecValidationResult => {
  const issues: ValidationIssue[] = [];
  const suggestions: string[] = [];

  const entityNames = new Set(spec.entities.map((e) => e.name));

  // Check entities
  if (spec.entities.length === 0) {
    issues.push({
      severity: "error",
      category: "entities",
      message: "No entities defined. A spec needs at least one entity.",
    });
  }

  for (const entity of spec.entities) {
    // Check for id field
    const hasId = entity.fields.some((f) => f.name === "id");
    if (!hasId) {
      issues.push({
        severity: "warning",
        category: "entities",
        message: `Entity "${entity.name}" has no 'id' field.`,
        suggestion: "Add an 'id' field with type 'string' and unique: true.",
      });
    }

    // Check relationships reference existing entities
    for (const rel of entity.relationships) {
      if (!entityNames.has(rel.targetEntity)) {
        issues.push({
          severity: "error",
          category: "entities",
          message: `Entity "${entity.name}" has relationship to undefined entity "${rel.targetEntity}".`,
          suggestion: `Either add entity "${rel.targetEntity}" or remove this relationship.`,
        });
      }
    }

    // Check ref fields point to existing entities
    for (const field of entity.fields) {
      if (field.type === "ref" && field.refEntity && !entityNames.has(field.refEntity)) {
        issues.push({
          severity: "error",
          category: "entities",
          message: `Entity "${entity.name}" field "${field.name}" references undefined entity "${field.refEntity}".`,
        });
      }
    }
  }

  // Check screens reference existing entities
  for (const screen of spec.screens) {
    for (const entityRef of screen.entities) {
      if (!entityNames.has(entityRef)) {
        issues.push({
          severity: "warning",
          category: "screens",
          message: `Screen "${screen.name}" references undefined entity "${entityRef}".`,
        });
      }
    }

    // Check route format
    if (!screen.route.startsWith("/")) {
      issues.push({
        severity: "error",
        category: "screens",
        message: `Screen "${screen.name}" has invalid route "${screen.route}" (must start with /).`,
      });
    }
  }

  // Check API endpoints reference existing entities
  for (const endpoint of spec.apiEndpoints) {
    if (!entityNames.has(endpoint.entity)) {
      issues.push({
        severity: "warning",
        category: "api",
        message: `Endpoint "${endpoint.method} ${endpoint.path}" references undefined entity "${endpoint.entity}".`,
      });
    }
  }

  // Check for orphan entities (no screens reference them)
  const referencedEntities = new Set(spec.screens.flatMap((s) => s.entities));
  for (const entity of spec.entities) {
    if (entity.name !== "User" && !referencedEntities.has(entity.name)) {
      issues.push({
        severity: "info",
        category: "entities",
        message: `Entity "${entity.name}" is not referenced by any screen.`,
        suggestion: "Consider adding a screen for this entity or removing it if unused.",
      });
    }
  }

  // Check for CRUD completeness
  for (const entity of spec.entities) {
    const entityEndpoints = spec.apiEndpoints.filter(
      (e) => e.entity === entity.name,
    );
    const methods = new Set(entityEndpoints.map((e) => e.method));

    if (entityEndpoints.length > 0 && !methods.has("GET")) {
      suggestions.push(
        `Entity "${entity.name}" has API endpoints but no GET endpoint for listing/reading.`,
      );
    }
  }

  // Check roles
  if (spec.roles.length === 0 && spec.screens.some((s) => !s.accessRoles.includes("*"))) {
    issues.push({
      severity: "warning",
      category: "roles",
      message: "Screens have role-based access but no roles are defined.",
    });
  }

  // Check for a User entity (most apps need one)
  if (!entityNames.has("User")) {
    suggestions.push("No User entity found. Most applications need a User entity for authentication.");
  }

  const errorCount = issues.filter((i) => i.severity === "error").length;

  return {
    isValid: errorCount === 0,
    issues,
    suggestions,
  };
};
