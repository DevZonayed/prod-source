import type { ToolSet } from "ai";
import type { Vm } from "freestyle-sandboxes";
import type { AgenticLoopState } from "../types";
import { createFilesystemTools } from "./filesystem";
import { createSearchTools } from "./search";
import { createTerminalTools } from "./terminal";
import { createTaskManagementTools } from "./task-management";
import { createBrowserTools } from "./browser";
import { createGitTools } from "./git";
import { createWebTools } from "./web";
import { createMediaTools } from "./media";
import { createIdeContextTools } from "./ide-context";

type CreateToolsOptions = {
  sourceRepoId?: string;
  metadataRepoId?: string;
  previewUrl: string;
};

/**
 * Creates all 29 CodeMine tools.
 *
 * Tool categories (per PRD):
 * - Filesystem (5): view_file, edit_file, create_file, delete_file, list_dir
 * - Search (3): grep_search, codebase_search, find_by_name
 * - Terminal (4): run_command, run_in_background, read_terminal_output, kill_process
 * - Task Management (2): task_boundary, notify_user
 * - Browser (1): browser_action
 * - Git (6): git_diff, git_log, git_status, git_commit, git_checkout, git_stash
 * - Web (2): web_search, web_fetch
 * - Media (1): generate_image
 * - IDE Context (5): get_diagnostics, get_open_files, rename_symbol, read_clipboard, open_in_editor
 */
export function createCodeMineTools(
  vm: Vm,
  state: AgenticLoopState,
  options: CreateToolsOptions,
): ToolSet {
  // Track file access for get_open_files
  const trackFile = (path: string) => {
    state.recentFiles.push(path);
    // Keep only last 50
    if (state.recentFiles.length > 50) {
      state.recentFiles = state.recentFiles.slice(-50);
    }
  };

  const filesystem = createFilesystemTools(vm, trackFile);
  const search = createSearchTools(vm);
  const terminal = createTerminalTools(vm, state);
  const taskMgmt = createTaskManagementTools(vm, state);
  const browser = createBrowserTools(vm, options.previewUrl);
  const git = createGitTools(vm, {
    sourceRepoId: options.sourceRepoId,
    metadataRepoId: options.metadataRepoId,
  });
  const web = createWebTools();
  const media = createMediaTools(vm);
  const ideContext = createIdeContextTools(vm, state);

  return {
    ...filesystem,
    ...search,
    ...terminal,
    ...taskMgmt,
    ...browser,
    ...git,
    ...web,
    ...media,
    ...ideContext,
  };
}
