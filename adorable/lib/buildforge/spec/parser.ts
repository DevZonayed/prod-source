// =============================================================================
// Spec Parser
// Constructs AppSpec from extracted components.
// The actual NL→structured extraction is done by the LLM via tool calls.
// This module provides the assembly logic.
// =============================================================================

import type {
  AppSpec,
  Entity,
  Screen,
  ApiEndpoint,
  Role,
  BusinessRule,
  TechStack,
  PatternId,
} from "../types";

/**
 * Build an AppSpec from extracted components.
 * Called after the LLM has extracted entities, screens, APIs, etc. via tools.
 */
export const parseSpecFromEntities = (params: {
  projectName: string;
  description: string;
  patternId: PatternId | null;
  entities: Entity[];
  screens: Screen[];
  apiEndpoints: ApiEndpoint[];
  roles: Role[];
  businessRules: BusinessRule[];
  techStack?: Partial<TechStack>;
}): AppSpec => {
  const now = new Date().toISOString();

  const defaultStack: TechStack = {
    frontend: "nextjs",
    backend: "nextjs-api",
    database: "postgresql",
    orm: "prisma",
    cache: "none",
    auth: "nextauth",
    apiStyle: "rest",
    stateManagement: "zustand",
    styling: "tailwind",
    uiLibrary: "shadcn",
    testing: {
      unit: "vitest",
      e2e: "playwright",
    },
  };

  return {
    name: params.projectName,
    description: params.description,
    patternId: params.patternId,
    techStack: { ...defaultStack, ...params.techStack },
    entities: params.entities,
    screens: params.screens,
    apiEndpoints: params.apiEndpoints,
    roles: params.roles,
    businessRules: params.businessRules,
    createdAt: now,
    updatedAt: now,
  };
};

/**
 * Merge pattern-provided entities/screens with user-extracted ones.
 * Pattern entities serve as a base; user-specific ones are added or merged.
 */
export const mergeWithPattern = (
  patternEntities: Entity[],
  userEntities: Entity[],
): Entity[] => {
  const merged = [...patternEntities];

  for (const userEntity of userEntities) {
    const existing = merged.findIndex(
      (e) => e.name.toLowerCase() === userEntity.name.toLowerCase(),
    );

    if (existing >= 0) {
      // Merge: keep pattern base, add user-specific fields and rules
      const base = merged[existing];
      const existingFieldNames = new Set(base.fields.map((f) => f.name));
      const newFields = userEntity.fields.filter(
        (f) => !existingFieldNames.has(f.name),
      );

      merged[existing] = {
        ...base,
        description: userEntity.description || base.description,
        fields: [...base.fields, ...newFields],
        relationships: [
          ...base.relationships,
          ...userEntity.relationships.filter(
            (r) =>
              !base.relationships.some(
                (br) =>
                  br.type === r.type && br.targetEntity === r.targetEntity,
              ),
          ),
        ],
        businessRules: [
          ...new Set([...base.businessRules, ...userEntity.businessRules]),
        ],
      };
    } else {
      merged.push(userEntity);
    }
  }

  return merged;
};
