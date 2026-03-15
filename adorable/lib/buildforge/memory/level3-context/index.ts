// =============================================================================
// Level 3: Context Assembly Engine
// The core innovation — assembles precisely the right context for each task.
// =============================================================================

import type { Vm } from "freestyle-sandboxes";
import type {
  AssembledContext,
  ContextAssemblyRequest,
  AppSpec,
  TaskType,
} from "../../types";
import { CONTEXT_BUDGET_BY_TASK } from "../../constants";

const TASK_CONTEXT_BUDGET: Record<TaskType, string> = {
  spec_parse: "full_feature",
  frontend_page: "complex_page",
  frontend_component: "simple_component",
  frontend_form: "complex_page",
  frontend_layout: "simple_component",
  frontend_store: "simple_component",
  frontend_hook: "simple_component",
  backend_module: "backend_module",
  backend_api: "backend_module",
  backend_service: "backend_module",
  backend_auth: "full_feature",
  backend_model: "simple_component",
  design_system: "architecture_decision",
  design_component: "simple_component",
  test_unit: "simple_component",
  test_e2e: "complex_page",
  devops_docker: "backend_module",
  devops_ci: "backend_module",
  repo_analysis: "full_feature",
  general: "default",
};
import { buildLayer0, buildLayer1, buildLayer2, buildLayer3 } from "./layers";
import { estimateTokens, truncateToTokenBudget } from "./tokenizer";

export { estimateTokens, truncateToTokenBudget } from "./tokenizer";

/**
 * Get the context budget for a task type.
 */
const getBudget = (taskType: TaskType) => {
  const budgetKey = TASK_CONTEXT_BUDGET[taskType] ?? "default";
  return CONTEXT_BUDGET_BY_TASK[budgetKey] ?? CONTEXT_BUDGET_BY_TASK["default"];
};

/**
 * Assemble the full context for a task.
 * This is the heart of BuildForge's intelligence — building minimal, precise
 * context that stays within token budgets while including everything needed.
 */
export const assembleContext = async (
  vm: Vm,
  request: ContextAssemblyRequest,
  spec: AppSpec | null,
): Promise<AssembledContext> => {
  const budget = getBudget(request.taskType);

  // Build all four layers
  const [layer0, layer1, layer2] = await Promise.all([
    buildLayer0(vm, spec),
    buildLayer1(vm, request, spec),
    buildLayer2(vm, request, spec),
  ]);
  const layer3 = buildLayer3(request);

  const layers = [layer0, layer1, layer2, layer3];
  let totalTokens = layers.reduce((sum, l) => sum + l.tokenCount, 0);

  // If over budget, compress layers starting from the largest
  if (totalTokens > budget.max) {
    // Sort by token count descending (but never touch layer3 — it's the instruction)
    const compressible = [layer0, layer1, layer2].sort(
      (a, b) => b.tokenCount - a.tokenCount,
    );

    for (const layer of compressible) {
      if (totalTokens <= budget.target) break;

      const excess = totalTokens - budget.target;
      const newMax = Math.max(layer.tokenCount - excess, layer.maxTokens * 0.5);
      const { text, tokenCount } = truncateToTokenBudget(
        layer.content,
        newMax,
      );
      totalTokens -= layer.tokenCount - tokenCount;
      layer.content = text;
      layer.tokenCount = tokenCount;
    }
  }

  // Assemble the system prompt
  const systemPrompt = buildSystemPrompt(layers);

  return {
    layers,
    totalTokens: layers.reduce((sum, l) => sum + l.tokenCount, 0),
    budgetUsed:
      layers.reduce((sum, l) => sum + l.tokenCount, 0) / budget.max,
    systemPrompt,
  };
};

/**
 * Build a lightweight context for general conversation.
 * Used when no specific task is detected — just includes Layer 0 + memory summary.
 */
export const assembleGeneralContext = async (
  vm: Vm,
  spec: AppSpec | null,
  latestMessage: string,
): Promise<string> => {
  const layer0 = await buildLayer0(vm, spec);

  const parts: string[] = [];
  parts.push("=== BUILDFORGE CONTEXT ===");
  parts.push(layer0.content);

  // Add project summary if spec exists
  if (spec) {
    parts.push("\n--- PROJECT SPEC SUMMARY ---");
    parts.push(`Entities: ${spec.entities.map((e) => e.name).join(", ")}`);
    parts.push(`Screens: ${spec.screens.map((s) => s.name).join(", ")}`);
    parts.push(`API Endpoints: ${spec.apiEndpoints.length} defined`);
    parts.push(`Roles: ${spec.roles.map((r) => r.name).join(", ")}`);
  }

  parts.push("\n--- AVAILABLE CAPABILITIES ---");
  parts.push("You have BuildForge tools available:");
  parts.push("- Memory tools: read/write/search project memory");
  parts.push("- Spec tools: parse requirements into structured specs");
  parts.push("- Thinker tools: decompose features, plan execution, validate");
  parts.push("- Generation tools: create pages, components, APIs, services");
  parts.push("- Base tools: file operations, bash, commit, deploy");
  parts.push("\nUse memory_init to initialize project memory if not yet done.");
  parts.push("Use spec_parse when the user describes a new project or feature.");
  parts.push("Use think_decompose to break complex features into tasks.");

  return parts.join("\n");
};

/**
 * Build the final system prompt from assembled layers.
 */
function buildSystemPrompt(
  layers: { id: string; name: string; content: string }[],
): string {
  const parts: string[] = [];

  parts.push(`You are BuildForge, an AI-powered full-stack application builder. You don't just write code — you understand business requirements, maintain project memory, and generate architecturally consistent, production-grade applications.

CORE PRINCIPLES:
1. BUSINESS-FIRST: Understand what the business needs before writing code.
2. MEMORY-DRIVEN: Always check and update project memory. Never regenerate what already exists.
3. CONTEXT-PRECISE: Use exactly the information provided in context layers. Don't hallucinate entity fields or endpoints.
4. PATTERN-AWARE: Reuse existing components and patterns. Follow deduplication rules.
5. SELF-VALIDATING: Check your work. Run the app. Fix errors before reporting done.

WORKFLOW:
- For new projects: spec_parse → memory_init → think_decompose → generate → validate
- For features: search memory → think_decompose → assemble context → generate → validate → update memory
- For bug fixes: read issues-resolved memory → diagnose → fix → log the resolution
- Always commit and push when a task is complete.`);

  for (const layer of layers) {
    if (layer.content.trim()) {
      parts.push(`\n=== ${layer.name.toUpperCase()} ===\n${layer.content}`);
    }
  }

  parts.push(`
COMMUNICATION STYLE:
- Brief, natural narrations of what you're doing and why.
- Keep summaries to one short sentence per action.
- After completing a task, give a concise summary of changes.
- Do NOT repeat tool names or arguments in narration.`);

  return parts.join("\n");
}
