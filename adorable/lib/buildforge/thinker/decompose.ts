// =============================================================================
// Task Decomposition
// Breaks feature descriptions into atomic, ordered tasks.
// =============================================================================

import type { Task, TaskType, AppSpec } from "../types";

/**
 * Generate a deterministic task ID from feature + index.
 */
const taskId = (prefix: string, index: number): string =>
  `${prefix}-${String(index).padStart(3, "0")}`;

/**
 * Decompose a feature description into ordered tasks.
 * This provides a structural decomposition. The LLM enriches it
 * with specific details via the think_decompose tool.
 */
export const decompose = (
  featureDescription: string,
  scope: string,
  spec: AppSpec | null,
): {
  tasks: Task[];
  executionOrder: string[][];
  summary: string;
} => {
  const descLower = featureDescription.toLowerCase();
  const tasks: Task[] = [];
  const prefix = "task";
  let idx = 0;

  // Detect entities involved
  const involvedEntities: string[] = [];
  if (spec) {
    for (const entity of spec.entities) {
      if (descLower.includes(entity.name.toLowerCase())) {
        involvedEntities.push(entity.name);
      }
    }
  }

  // Detect screens involved
  const involvedScreens: string[] = [];
  if (spec) {
    for (const screen of spec.screens) {
      if (
        descLower.includes(screen.name.toLowerCase()) ||
        descLower.includes(screen.route)
      ) {
        involvedScreens.push(screen.name);
      }
    }
  }

  // Generate tasks based on scope
  if (scope === "full-feature" || scope === "single-page") {
    // 1. Memory check/update
    tasks.push(createTask(taskId(prefix, idx++), "general", "Read project memory for relevant context", "memory_read", involvedEntities, []));

    // 2. Entity/model tasks
    for (const entity of involvedEntities) {
      tasks.push(
        createTask(
          taskId(prefix, idx++),
          "backend_model",
          `Create/update data model for ${entity}`,
          "backend_model",
          [entity],
          [],
          [tasks[0]?.id].filter(Boolean),
        ),
      );
    }

    // 3. API endpoint tasks
    for (const entity of involvedEntities) {
      const modelTask = tasks.find(
        (t) =>
          t.type === "backend_model" &&
          t.contextRequirements.entities.includes(entity),
      );
      tasks.push(
        createTask(
          taskId(prefix, idx++),
          "backend_api",
          `Create API endpoints for ${entity}`,
          "backend_api_route",
          [entity],
          [],
          modelTask ? [modelTask.id] : [],
        ),
      );
    }

    // 4. Frontend page/component tasks
    for (const screen of involvedScreens) {
      const relatedApiTasks = tasks.filter((t) => t.type === "backend_api");
      tasks.push(
        createTask(
          taskId(prefix, idx++),
          "frontend_page",
          `Build ${screen} page`,
          "frontend_page",
          involvedEntities,
          [screen],
          relatedApiTasks.map((t) => t.id),
        ),
      );
    }

    // If no specific screens detected, add generic tasks
    if (involvedScreens.length === 0 && involvedEntities.length > 0) {
      const relatedApiTasks = tasks.filter((t) => t.type === "backend_api");
      tasks.push(
        createTask(
          taskId(prefix, idx++),
          "frontend_page",
          `Build UI for ${featureDescription}`,
          "frontend_page",
          involvedEntities,
          [],
          relatedApiTasks.map((t) => t.id),
        ),
      );
    }

    // 5. Validation task
    tasks.push(
      createTask(
        taskId(prefix, idx++),
        "general",
        "Validate all generated code (TypeScript + runtime check)",
        "think_validate",
        [],
        [],
        tasks.filter((t) => t.type !== "general").map((t) => t.id),
      ),
    );

    // 6. Memory update task
    tasks.push(
      createTask(
        taskId(prefix, idx++),
        "general",
        "Update project memory with new components, endpoints, and patterns",
        "memory_write",
        involvedEntities,
        involvedScreens,
        [tasks[tasks.length - 1].id],
      ),
    );
  } else if (scope === "component") {
    tasks.push(createTask(taskId(prefix, idx++), "general", "Read component patterns from memory", "memory_read", involvedEntities, []));
    tasks.push(
      createTask(taskId(prefix, idx++), "frontend_component", `Build component: ${featureDescription}`, "frontend_component", involvedEntities, [], [tasks[0].id]),
    );
    tasks.push(
      createTask(taskId(prefix, idx++), "general", "Validate component", "think_validate", [], [], [tasks[1].id]),
    );
  } else if (scope === "api-endpoint") {
    tasks.push(createTask(taskId(prefix, idx++), "general", "Read API patterns from memory", "memory_read", involvedEntities, []));
    tasks.push(
      createTask(taskId(prefix, idx++), "backend_api", `Build API: ${featureDescription}`, "backend_api_route", involvedEntities, [], [tasks[0].id]),
    );
    tasks.push(
      createTask(taskId(prefix, idx++), "general", "Validate API endpoint", "think_validate", [], [], [tasks[1].id]),
    );
  } else if (scope === "bug-fix") {
    tasks.push(createTask(taskId(prefix, idx++), "general", "Read issues-resolved memory", "memory_read", [], []));
    tasks.push(
      createTask(taskId(prefix, idx++), "general", `Diagnose and fix: ${featureDescription}`, "bashTool", [], [], [tasks[0].id]),
    );
    tasks.push(
      createTask(taskId(prefix, idx++), "general", "Validate fix", "think_validate", [], [], [tasks[1].id]),
    );
    tasks.push(
      createTask(taskId(prefix, idx++), "general", "Log resolution to issues-resolved memory", "memory_write", [], [], [tasks[2].id]),
    );
  }

  // Build execution order (groups of parallel tasks)
  const executionOrder = buildExecutionOrder(tasks);

  return {
    tasks,
    executionOrder,
    summary: `Decomposed into ${tasks.length} tasks across ${executionOrder.length} execution groups. Entities: [${involvedEntities.join(", ")}]. Screens: [${involvedScreens.join(", ")}].`,
  };
};

function createTask(
  id: string,
  type: TaskType,
  description: string,
  toolName: string,
  entities: string[],
  screens: string[],
  dependencies: string[] = [],
): Task {
  return {
    id,
    type,
    description,
    dependencies,
    status: "pending",
    toolName,
    contextRequirements: { entities, screens, patterns: [] },
    retryCount: 0,
    maxRetries: 3,
  };
}

function buildExecutionOrder(tasks: Task[]): string[][] {
  const completed = new Set<string>();
  const remaining = new Set(tasks.map((t) => t.id));
  const order: string[][] = [];

  while (remaining.size > 0) {
    const group: string[] = [];

    for (const task of tasks) {
      if (!remaining.has(task.id)) continue;
      const depsResolved = task.dependencies.every((d) => completed.has(d));
      if (depsResolved) {
        group.push(task.id);
      }
    }

    if (group.length === 0) {
      // Circular dependency or error — just push remaining
      group.push(...remaining);
      remaining.clear();
    } else {
      for (const id of group) {
        remaining.delete(id);
        completed.add(id);
      }
    }

    order.push(group);
  }

  return order;
}
