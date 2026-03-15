import * as path from "path";

export const TEMPLATE_REPO =
  "https://github.com/DevZonayed/freestyle-base-nextjs-shadcn";

export const PROJECTS_DIR =
  process.env.VOXEL_PROJECTS_DIR ||
  path.join(process.env.HOME || "/root", ".voxel", "projects");

export const HOST_PROJECTS_DIR =
  process.env.VOXEL_HOST_PROJECTS_DIR || "/host-projects";

export const VM_PORT = 3000;
export const MODEL = "gpt-5-mini";
export const APP_PORT = parseInt(process.env.PORT || "4000", 10);

// Target versions for scaffolded projects.
// Set to "latest" to always pull the newest version from npm.
export const TARGET_NEXTJS_VERSION = "latest";
export const TARGET_NESTJS_VERSION = "latest";

/**
 * Get the absolute path to a project's working directory.
 * For new/github projects: /projects/<id>
 * For existing projects: the user-specified path
 */
export function getProjectDir(projectId: string, projectPath?: string): string {
  if (projectPath) return projectPath;
  return path.join(PROJECTS_DIR, projectId);
}

/**
 * Legacy WORKDIR — the system prompt tells the AI to use /workspace as the
 * working directory. In local mode, the LocalVm's exec() already runs with
 * cwd=projectDir, so `cd /workspace` in shell commands is a no-op.
 * The codemine helpers translate /workspace paths to the real project dir.
 */
export const WORKDIR = "/workspace";
