import type { Vm } from "freestyle-sandboxes";
import { WORKDIR } from "../vars";
import { BRAIN_DIR } from "./constants";
import { ensureDir, writeVmFile, readVmFile } from "./tools/helpers";

/**
 * Get the brain directory path for a conversation.
 */
function brainPath(conversationId: string): string {
  return `${WORKDIR}/${BRAIN_DIR}/${conversationId}`;
}

/**
 * Ensures the brain directory structure exists for a conversation.
 */
export async function ensureBrainDir(
  vm: Vm,
  conversationId: string,
): Promise<string> {
  const path = brainPath(conversationId);
  await ensureDir(vm, path);
  await ensureDir(vm, `${path}/.system_generated/logs`);
  return path;
}

/**
 * Writes or creates the task.md checklist artifact.
 */
export async function writeTaskMd(
  vm: Vm,
  conversationId: string,
  tasks: Array<{ id: string; description: string; status: "pending" | "in-progress" | "done" }>,
): Promise<void> {
  const path = `${brainPath(conversationId)}/task.md`;
  await ensureBrainDir(vm, conversationId);

  const content = [
    `# Task Checklist`,
    ``,
    ...tasks.map((t) => {
      const checkbox =
        t.status === "done"
          ? "[x]"
          : t.status === "in-progress"
            ? "[/]"
            : "[ ]";
      return `- ${checkbox} ${t.id}: ${t.description}`;
    }),
    ``,
    `_Last updated: ${new Date().toISOString()}_`,
  ].join("\n");

  await writeVmFile(vm, path, content);
}

/**
 * Updates a single task item's status in task.md.
 */
export async function updateTaskItem(
  vm: Vm,
  conversationId: string,
  taskId: string,
  status: "pending" | "in-progress" | "done",
): Promise<void> {
  const path = `${brainPath(conversationId)}/task.md`;
  const content = await readVmFile(vm, path);
  if (!content) return;

  const checkbox =
    status === "done" ? "[x]" : status === "in-progress" ? "[/]" : "[ ]";

  // Find the line with this task ID and replace the checkbox
  const updated = content.replace(
    new RegExp(`- \\[.\\] ${taskId}:`),
    `- ${checkbox} ${taskId}:`,
  );

  await writeVmFile(vm, path, updated);
}

/**
 * Writes the implementation_plan.md artifact (PLANNING phase).
 */
export async function writeImplementationPlan(
  vm: Vm,
  conversationId: string,
  content: string,
): Promise<void> {
  const path = `${brainPath(conversationId)}/implementation_plan.md`;
  await ensureBrainDir(vm, conversationId);
  await writeVmFile(vm, path, content);
}

/**
 * Writes the walkthrough.md artifact (VERIFICATION phase).
 */
export async function writeWalkthrough(
  vm: Vm,
  conversationId: string,
  content: string,
): Promise<void> {
  const path = `${brainPath(conversationId)}/walkthrough.md`;
  await ensureBrainDir(vm, conversationId);
  await writeVmFile(vm, path, content);
}

/**
 * Writes a conversation log entry.
 */
export async function writeConversationLog(
  vm: Vm,
  conversationId: string,
  logName: string,
  content: string,
): Promise<void> {
  const path = `${brainPath(conversationId)}/.system_generated/logs/${logName}.txt`;
  await ensureBrainDir(vm, conversationId);
  await writeVmFile(vm, path, content);
}
