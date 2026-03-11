import { tool } from "ai";
import type { Vm } from "freestyle-sandboxes";
import { z } from "zod";
import { WORKDIR } from "../../vars";
import type { AgentMode, AgenticLoopState } from "../types";
import { BRAIN_DIR } from "../constants";
import { ensureDir, writeVmFile, readVmFile } from "./helpers";

/**
 * Creates the 2 task management tools: task_boundary, notify_user
 */
export function createTaskManagementTools(vm: Vm, state: AgenticLoopState) {
  const brainPath = `${WORKDIR}/${BRAIN_DIR}/${state.conversationId}`;

  return {
    task_boundary: tool({
      description:
        "Enter or update task view mode. Controls the structured progress UI visible to the user. Use this for complex tasks to show your PLANNING, EXECUTION, or VERIFICATION progress. Skip for simple work (quick answers, single-file edits).",
      inputSchema: z.object({
        TaskName: z
          .string()
          .describe("Header of the task UI block. Keep the same name to update within a task; change it for a new task."),
        TaskSummary: z
          .string()
          .describe("Cumulative goal description — what you are building or doing"),
        TaskStatus: z
          .string()
          .describe("What you will do NEXT (not what you already did)"),
        Mode: z
          .enum(["PLANNING", "EXECUTION", "VERIFICATION"])
          .describe("Current work mode"),
      }),
      execute: async ({ TaskName, TaskSummary, TaskStatus, Mode }) => {
        // Update shared state
        state.taskState = {
          taskName: TaskName,
          taskSummary: TaskSummary,
          taskStatus: TaskStatus,
          mode: Mode as AgentMode,
          active: true,
        };

        // Write/update task.md artifact
        try {
          await ensureDir(vm, brainPath);
          const taskMdPath = `${brainPath}/task.md`;
          const existing = await readVmFile(vm, taskMdPath);

          const timestamp = new Date().toISOString();
          const entry = `\n## [${Mode}] ${TaskName} — ${timestamp}\n**Summary:** ${TaskSummary}\n**Next:** ${TaskStatus}\n`;

          if (existing) {
            await writeVmFile(vm, taskMdPath, existing + entry);
          } else {
            const header = `# Task Log — ${state.conversationId}\n`;
            await writeVmFile(vm, taskMdPath, header + entry);
          }
        } catch {
          // Non-critical: artifact write failure shouldn't block task
        }

        return {
          ok: true,
          taskName: TaskName,
          taskSummary: TaskSummary,
          taskStatus: TaskStatus,
          mode: Mode,
          active: true,
        };
      },
    }),

    notify_user: tool({
      description:
        "The ONLY way to communicate with users during task view mode. Regular messages are invisible in task mode. Batch all independent questions into one call. Set BlockedOnUser to true ONLY if you cannot proceed without user approval.",
      inputSchema: z.object({
        Message: z.string().describe("Message to show the user"),
        PathsToReview: z
          .array(z.string())
          .optional()
          .describe("File paths the user should review"),
        ConfidenceScore: z
          .number()
          .min(0)
          .max(1)
          .optional()
          .describe("Your confidence in the work done (0-1)"),
        ConfidenceJustification: z
          .string()
          .optional()
          .describe("Why you gave this confidence score"),
        BlockedOnUser: z
          .boolean()
          .default(false)
          .describe("Set to true ONLY if you cannot proceed without user response"),
      }),
      execute: async ({
        Message,
        PathsToReview,
        ConfidenceScore,
        ConfidenceJustification,
        BlockedOnUser,
      }) => {
        // Exit task mode when notifying user
        if (state.taskState) {
          state.taskState.active = false;
        }

        // If blocked on user, set the pause flag
        if (BlockedOnUser) {
          state.pauseForUser = true;
        }

        return {
          ok: true,
          message: Message,
          pathsToReview: PathsToReview ?? [],
          confidenceScore: ConfidenceScore ?? null,
          confidenceJustification: ConfidenceJustification ?? null,
          blockedOnUser: BlockedOnUser,
          type: "notify_user",
        };
      },
    }),
  };
}
