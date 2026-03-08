// =============================================================================
// Checkpoint System
// Git-based rollback points using the existing commit infrastructure.
// =============================================================================

import type { Vm } from "freestyle-sandboxes";
import type { Checkpoint } from "../types";
import { WORKDIR } from "../../vars";

/**
 * Create a checkpoint (git commit) at the current state.
 */
export const createCheckpoint = async (
  vm: Vm,
  taskId: string,
  description: string,
): Promise<Checkpoint | null> => {
  try {
    // Stage and commit
    const commitMessage = `[buildforge-checkpoint] ${description}`;
    const result = await vm.exec({
      command: [
        `cd ${WORKDIR}`,
        `git add -A`,
        `git diff --cached --quiet && echo "NO_CHANGES" || git commit -m '${commitMessage.replace(/'/g, "'\\''")}'`,
      ].join(" && "),
    });

    const output = typeof result === "string" ? result : String(result ?? "");

    if (output.includes("NO_CHANGES")) {
      return null; // Nothing to checkpoint
    }

    // Get the commit SHA
    const shaResult = await vm.exec({
      command: `git -C ${WORKDIR} rev-parse HEAD`,
    });
    const sha = (typeof shaResult === "string" ? shaResult : String(shaResult ?? "")).trim();

    if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) {
      return null;
    }

    return {
      id: `cp-${sha.slice(0, 8)}`,
      taskId,
      commitSha: sha,
      description,
      createdAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
};

/**
 * Rollback to a checkpoint.
 */
export const rollbackToCheckpoint = async (
  vm: Vm,
  checkpoint: Checkpoint,
): Promise<boolean> => {
  try {
    const result = await vm.exec({
      command: `cd ${WORKDIR} && git reset --hard ${checkpoint.commitSha}`,
    });
    const output = typeof result === "string" ? result : String(result ?? "");
    return output.includes("HEAD is now at");
  } catch {
    return false;
  }
};

/**
 * List all BuildForge checkpoints.
 */
export const listCheckpoints = async (
  vm: Vm,
): Promise<Array<{ sha: string; message: string; date: string }>> => {
  try {
    const result = await vm.exec({
      command: `git -C ${WORKDIR} log --oneline --grep="\\[buildforge-checkpoint\\]" --format="%H|%s|%ci" -20`,
    });
    const output = typeof result === "string" ? result : String(result ?? "");

    return output
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, message, date] = line.split("|");
        return { sha: sha ?? "", message: message ?? "", date: date ?? "" };
      });
  } catch {
    return [];
  }
};
