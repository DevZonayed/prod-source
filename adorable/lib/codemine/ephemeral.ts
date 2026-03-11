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
    `CRITICAL INSTRUCTION 1: Always prioritize the most specific tool available for any task.`,
    `  (a) NEVER run 'cat' inside a bash command to create or append to files — use create_file or edit_file.`,
    `  (b) ALWAYS use grep_search instead of running grep in bash unless absolutely needed.`,
    `  (c) DO NOT use ls for listing, cat for viewing, grep for finding, sed for replacing when dedicated tools exist.`,
    ``,
    `CRITICAL INSTRUCTION 2: Before making tool calls T, think and explicitly list out all related tools for the task at hand.`,
    `  Only execute tool T if all other candidate tools are either more generic or cannot accomplish the task.`,
  ].join("\n");
}
