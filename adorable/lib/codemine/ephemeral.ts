import type { EphemeralContext } from "./types";

/**
 * Builds a rich ephemeral message for the initial turn of a conversation.
 * Contains KI summaries, recent conversations, sandbox state, and critical instructions.
 */
export function buildInitialEphemeral(ctx: EphemeralContext): string {
  const parts: string[] = [
    `<EPHEMERAL_MESSAGE>`,
    `Step Id: ${ctx.stepId}`,
    ``,
  ];

  // Sandbox / Preview State
  parts.push(`[Sandbox State]`);
  parts.push(`Preview URL: ${ctx.sandboxState.previewUrl}`);
  parts.push(
    `Dev Server: ${ctx.sandboxState.devServerRunning ? "Running" : "Not Running"}`,
  );
  if (ctx.sandboxState.devServerErrors.length > 0) {
    parts.push(`Dev Server Errors:`);
    for (const err of ctx.sandboxState.devServerErrors.slice(0, 10)) {
      parts.push(`  - ${err}`);
    }
  }
  parts.push(``);

  // Diagnostics
  if (ctx.diagnostics.length > 0) {
    parts.push(`[Diagnostics]`);
    for (const diag of ctx.diagnostics.slice(0, 15)) {
      parts.push(`  ${diag}`);
    }
    parts.push(``);
  }

  // Knowledge Item Summaries
  if (ctx.kiSummaries.length > 0) {
    parts.push(`[Knowledge Item Summaries]`);
    for (const ki of ctx.kiSummaries) {
      parts.push(`  ${ki}`);
    }
    parts.push(``);
  }

  // Recent Conversation Summaries
  if (ctx.recentConversations && ctx.recentConversations.length > 0) {
    parts.push(`[Recent Conversation Summaries]`);
    for (const conv of ctx.recentConversations.slice(0, 5)) {
      parts.push(`  ${conv.id}: "${conv.title}" (${conv.updatedAt})`);
    }
    parts.push(``);
  }

  // Loop detector warnings
  if (ctx.warnings.length > 0) {
    parts.push(`[Loop Safeguard Warnings]`);
    for (const w of ctx.warnings) {
      parts.push(`  ${w}`);
    }
    parts.push(``);
  }

  // Critical Instructions (always appended)
  parts.push(buildCriticalInstructions());

  parts.push(`</EPHEMERAL_MESSAGE>`);
  return parts.join("\n");
}

/**
 * Builds a compact ephemeral message for injection between tool call steps.
 * Lighter than the initial ephemeral — omits KI summaries to save tokens.
 */
export function buildStepEphemeral(ctx: EphemeralContext): string {
  const parts: string[] = [
    `<EPHEMERAL_MESSAGE>`,
    `Step Id: ${ctx.stepId}`,
    ``,
  ];

  // Compact sandbox state
  parts.push(`[Sandbox State]`);
  parts.push(
    `Dev Server: ${ctx.sandboxState.devServerRunning ? "Running" : "Stopped"}`,
  );
  if (ctx.sandboxState.devServerErrors.length > 0) {
    parts.push(
      `Recent Errors: ${ctx.sandboxState.devServerErrors.slice(0, 5).join("; ")}`,
    );
  }
  parts.push(``);

  // Diagnostics (compact)
  if (ctx.diagnostics.length > 0) {
    parts.push(`[Diagnostics]`);
    for (const diag of ctx.diagnostics.slice(0, 10)) {
      parts.push(`  ${diag}`);
    }
    parts.push(``);
  }

  // Loop detector warnings
  if (ctx.warnings.length > 0) {
    parts.push(`[Loop Safeguard Warnings]`);
    for (const w of ctx.warnings) {
      parts.push(`  ⚠ ${w}`);
    }
    parts.push(``);
  }

  parts.push(buildCriticalInstructions());
  parts.push(`</EPHEMERAL_MESSAGE>`);
  return parts.join("\n");
}

/**
 * Critical Instructions recitation — appended to every ephemeral message.
 * Per PRD Section 6.2: forces the agent to recall constraints before every tool call.
 */
function buildCriticalInstructions(): string {
  return [
    `MANDATORY TOOL ROUTING — Using run_command for these tasks is a VIOLATION:`,
    `  view_file (NOT cat/head/tail), create_file (NOT echo/heredoc/tee),`,
    `  edit_file (NOT sed/awk), delete_file (NOT rm), list_dir (NOT ls/tree),`,
    `  grep_search (NOT grep/rg), find_by_name (NOT find),`,
    `  check_app (NOT curl), git_status/git_diff/git_log/git_commit (NOT git),`,
    `  shadcn_install (NOT manually writing component files or npx shadcn in run_command).`,
    `  run_command is ONLY for: npm install, builds, test scripts, dev server.`,
    ``,
    `VERIFICATION — After EVERY batch of file changes:`,
    `  1. Run check_app to verify the app compiles and runs.`,
    `  2. If errors: run_command "cat /tmp/dev-server.log | tail -80", fix, re-check.`,
    `  3. NEVER tell the user "it's ready" without check_app confirming success.`,
  ].join("\n");
}
