// =============================================================================
// Context Layer Builders
// Each function builds one of the four context layers.
// =============================================================================

import type { Vm } from "@/lib/local-vm";
import type {
  ContextLayer,
  ContextAssemblyRequest,
  AppSpec,
  MemoryFileType,
} from "../../types";
import { TOKEN_BUDGETS } from "../../constants";
import { readMemoryFile, readMemorySection } from "../level2-project";
import { getPatternSummary } from "../level1-patterns";
import { truncateToTokenBudget, estimateTokens } from "./tokenizer";

/**
 * Layer 0: Global Rules
 * Project identity, tech stack, conventions, design tokens.
 * Always present. ~500 tokens. Never changes per task.
 */
export const buildLayer0 = async (
  vm: Vm,
  spec: AppSpec | null,
): Promise<ContextLayer> => {
  const budget = TOKEN_BUDGETS.layer0;

  const architectureContent = await readMemoryFile(vm, "architecture");
  const designTokens = await readMemorySection(vm, "ui-patterns", "Design Tokens");

  const parts: string[] = [];

  if (spec) {
    parts.push(`PROJECT: ${spec.name}`);
    parts.push(`DESCRIPTION: ${spec.description}`);
    parts.push(
      `STACK: ${spec.techStack.frontend} + ${spec.techStack.backend} + ${spec.techStack.database}`,
    );
    if (spec.patternId) {
      parts.push(`PATTERN: ${spec.patternId}`);
    }
  }

  if (architectureContent) {
    // Extract just the conventions and structure sections
    const conventionsMatch = architectureContent.match(
      /## Coding Conventions\n([\s\S]*?)(?=\n## |$)/,
    );
    if (conventionsMatch) {
      parts.push(`CONVENTIONS:\n${conventionsMatch[1].trim()}`);
    }
  }

  if (designTokens) {
    parts.push(`DESIGN TOKENS:\n${designTokens}`);
  }

  // Add global rules
  parts.push(`RULES:
- TypeScript strict mode, no 'any' types
- Functional React components with hooks
- File naming: kebab-case for files, PascalCase for components
- API responses: { success: boolean, data: T, message: string }
- Use existing components/patterns from memory before creating new ones
- Update project memory after generating code`);

  const content = parts.join("\n\n");
  const { text, tokenCount } = truncateToTokenBudget(content, budget.max);

  return {
    id: "layer0",
    name: "Global Rules",
    content: text,
    tokenCount,
    maxTokens: budget.max,
  };
};

/**
 * Layer 1: Domain Context
 * Relevant entity schemas, relationships, business rules, existing endpoints.
 * Changes when switching feature domains. ~1000-2000 tokens.
 */
export const buildLayer1 = async (
  vm: Vm,
  request: ContextAssemblyRequest,
  spec: AppSpec | null,
): Promise<ContextLayer> => {
  const budget = TOKEN_BUDGETS.layer1;
  const parts: string[] = [];

  // Determine relevant entities
  const entityNames: string[] = [];
  if (request.primaryEntity) entityNames.push(request.primaryEntity);
  if (request.relatedEntities) entityNames.push(...request.relatedEntities);

  // If no entities specified, try to detect from task description
  if (entityNames.length === 0 && spec) {
    const descLower = request.taskDescription.toLowerCase();
    for (const entity of spec.entities) {
      if (descLower.includes(entity.name.toLowerCase())) {
        entityNames.push(entity.name);
      }
    }
  }

  // Load entity schemas from spec
  if (spec && entityNames.length > 0) {
    parts.push("ENTITIES:");
    for (const name of entityNames.slice(0, 5)) {
      // Max 5 entities
      const entity = spec.entities.find(
        (e) => e.name.toLowerCase() === name.toLowerCase(),
      );
      if (entity) {
        const fieldsSummary = entity.fields
          .map((f) => `${f.name}(${f.type}${f.required ? "" : "?"})`)
          .join(", ");
        const relsSummary = entity.relationships
          .map((r) => `${r.type} ${r.targetEntity}`)
          .join(", ");

        parts.push(
          `  ${entity.name}: ${fieldsSummary}` +
            (relsSummary ? `\n    Relations: ${relsSummary}` : ""),
        );

        if (entity.businessRules.length > 0) {
          parts.push(
            `    Rules: ${entity.businessRules.join("; ")}`,
          );
        }
      }
    }
  }

  // Load entity memory (may have more recent info)
  const entityMemory = await readMemoryFile(vm, "entities");
  if (entityMemory && entityNames.length > 0) {
    for (const name of entityNames.slice(0, 3)) {
      const section = extractSection(entityMemory, name);
      if (section) {
        parts.push(`MEMORY[entities/${name}]:\n${section}`);
      }
    }
  }

  // Load relevant business rules
  const rulesMemory = await readMemoryFile(vm, "business-rules");
  if (rulesMemory && entityNames.length > 0) {
    for (const name of entityNames.slice(0, 3)) {
      const section = extractSection(rulesMemory, name);
      if (section) {
        parts.push(`BUSINESS RULES[${name}]:\n${section}`);
      }
    }
  }

  // Load relevant API endpoints
  const apiMemory = await readMemoryFile(vm, "api-endpoints");
  if (apiMemory && entityNames.length > 0) {
    const relevantEndpoints = entityNames
      .map((name) => extractSection(apiMemory, name))
      .filter(Boolean)
      .join("\n");
    if (relevantEndpoints) {
      parts.push(`EXISTING ENDPOINTS:\n${relevantEndpoints}`);
    }
  }

  // Load decisions relevant to this domain
  const decisionsMemory = await readMemoryFile(vm, "decisions");
  if (decisionsMemory) {
    const descLower = request.taskDescription.toLowerCase();
    const sections = decisionsMemory.split(/(?=^## )/m);
    const relevantDecisions = sections
      .filter((s) => {
        const sLower = s.toLowerCase();
        return (
          entityNames.some((n) => sLower.includes(n.toLowerCase())) ||
          sLower.includes(descLower.slice(0, 30))
        );
      })
      .slice(0, 2);
    if (relevantDecisions.length > 0) {
      parts.push(`DECISIONS:\n${relevantDecisions.join("\n")}`);
    }
  }

  // Load pattern info if available
  if (spec?.patternId && request.pattern) {
    const patternSummary = getPatternSummary(spec.patternId);
    if (patternSummary) {
      parts.push(`PATTERN CONTEXT:\n${patternSummary}`);
    }
  }

  const content = parts.join("\n\n");
  const { text, tokenCount } = truncateToTokenBudget(content, budget.max);

  return {
    id: "layer1",
    name: "Domain Context",
    content: text,
    tokenCount,
    maxTokens: budget.max,
  };
};

/**
 * Layer 2: Screen Specification
 * Exact screen description, data requirements, interactions, states.
 * Changes per task. ~500-1000 tokens.
 */
export const buildLayer2 = async (
  vm: Vm,
  request: ContextAssemblyRequest,
  spec: AppSpec | null,
): Promise<ContextLayer> => {
  const budget = TOKEN_BUDGETS.layer2;
  const parts: string[] = [];

  // Find relevant screen from spec
  if (spec && request.screenName) {
    const screen = spec.screens.find(
      (s) => s.name.toLowerCase() === request.screenName!.toLowerCase(),
    );
    if (screen) {
      parts.push(`SCREEN: ${screen.name}`);
      parts.push(`ROUTE: ${screen.route}`);
      parts.push(`LAYOUT: ${screen.layout}`);
      parts.push(`ACCESS: ${screen.accessRoles.join(", ")}`);
      parts.push(`DESCRIPTION: ${screen.description}`);

      if (screen.dataRequirements.length > 0) {
        parts.push("DATA REQUIREMENTS:");
        for (const req of screen.dataRequirements) {
          parts.push(`  - ${req.entity}: ${req.fields.join(", ")}`);
        }
      }

      if (screen.interactions.length > 0) {
        parts.push("INTERACTIONS:");
        for (const interaction of screen.interactions) {
          parts.push(`  - ${interaction.trigger}: ${interaction.action}`);
        }
      }

      if (screen.states.length > 0) {
        parts.push("STATES:");
        for (const state of screen.states) {
          parts.push(`  - ${state.name}: ${state.description}`);
        }
      }

      if (screen.acceptanceCriteria.length > 0) {
        parts.push("ACCEPTANCE CRITERIA:");
        for (const criteria of screen.acceptanceCriteria) {
          parts.push(`  - ${criteria}`);
        }
      }
    }
  }

  // Load component memory for related components
  const componentsMemory = await readMemoryFile(vm, "components");
  if (componentsMemory && request.primaryEntity) {
    const section = extractSection(componentsMemory, request.primaryEntity);
    if (section) {
      parts.push(`EXISTING COMPONENTS:\n${section}`);
    }
  }

  // Load UI patterns
  const patternsMemory = await readMemoryFile(vm, "ui-patterns");
  if (patternsMemory) {
    const layoutSection = extractSection(patternsMemory, "Layout Patterns");
    const componentSection = extractSection(patternsMemory, "Component Patterns");
    if (layoutSection) parts.push(`LAYOUT PATTERNS:\n${layoutSection}`);
    if (componentSection) parts.push(`COMPONENT PATTERNS:\n${componentSection}`);
  }

  const content = parts.join("\n\n");
  const { text, tokenCount } = truncateToTokenBudget(content, budget.max);

  return {
    id: "layer2",
    name: "Screen Specification",
    content: text,
    tokenCount,
    maxTokens: budget.max,
  };
};

/**
 * Layer 3: Task Instruction
 * The minimal trigger telling the AI exactly what to produce.
 * Changes per atomic task. ~100-200 tokens.
 */
export const buildLayer3 = (
  request: ContextAssemblyRequest,
): ContextLayer => {
  const budget = TOKEN_BUDGETS.layer3;

  const parts: string[] = [];
  parts.push(`TASK: ${request.taskDescription}`);
  parts.push(`TYPE: ${request.taskType}`);

  if (request.filePath) {
    parts.push(`TARGET FILE: ${request.filePath}`);
  }

  if (request.pattern) {
    parts.push(`PATTERN: ${request.pattern}`);
  }

  if (request.primaryEntity) {
    parts.push(`PRIMARY ENTITY: ${request.primaryEntity}`);
  }

  parts.push("INSTRUCTIONS:");
  parts.push("- Reference entity schemas from Layer 1, do not reinvent");
  parts.push("- Follow conventions from Layer 0");
  parts.push("- Match existing patterns from project memory");
  parts.push("- Update project memory after generating code");

  const content = parts.join("\n");
  const tokenCount = estimateTokens(content);

  return {
    id: "layer3",
    name: "Task Instruction",
    content,
    tokenCount,
    maxTokens: budget.max,
  };
};

// Helpers

function extractSection(content: string, heading: string): string | null {
  const pattern = new RegExp(
    `## ${heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
    "i",
  );
  const match = content.match(pattern);
  return match ? match[1].trim() : null;
}
