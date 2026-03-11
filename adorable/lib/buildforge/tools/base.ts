// =============================================================================
// Base Tools — Shared Utilities
// Common helpers for creating BuildForge tools.
// =============================================================================

import type { Vm } from "freestyle-sandboxes";
import { WORKDIR } from "../../vars";

/**
 * Normalize a relative path, preventing directory traversal.
 */
export const normalizeRelativePath = (rawPath: string): string | null => {
  const value = rawPath.trim();
  if (!value || value.includes("\0") || value.startsWith("/")) return null;
  const normalized = value.replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (segments.some((segment) => segment === "..")) return null;
  return normalized || ".";
};

/**
 * Shell-safe quoting.
 */
export const shellQuote = (value: string): string => {
  return `'${value.replace(/'/g, `'\\''`)}'`;
};

/**
 * Run a command in the VM and return structured output.
 */
export const runVmCommand = async (
  vm: Vm,
  command: string,
): Promise<{ ok: boolean; stdout: string; stderr: string; exitCode: number | null }> => {
  const result = await vm.exec({ command });

  if (typeof result === "string") {
    return { ok: true, stdout: result, stderr: "", exitCode: 0 };
  }

  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    return {
      ok: typeof r.exitCode === "number" ? r.exitCode === 0 : true,
      stdout: typeof r.stdout === "string" ? r.stdout : "",
      stderr: typeof r.stderr === "string" ? r.stderr : "",
      exitCode: typeof r.exitCode === "number" ? r.exitCode : null,
    };
  }

  return { ok: true, stdout: String(result ?? ""), stderr: "", exitCode: null };
};

/**
 * Read a file from the VM workspace.
 */
export const readVmFile = async (
  vm: Vm,
  relativePath: string,
): Promise<string | null> => {
  const safePath = normalizeRelativePath(relativePath);
  if (!safePath) return null;
  try {
    const content = await vm.fs.readTextFile(safePath);
    return typeof content === "string" ? content : String(content);
  } catch {
    return null;
  }
};

/**
 * Write a file to the VM workspace.
 * Skips the write if the file already has identical content (deduplication).
 */
export const writeVmFile = async (
  vm: Vm,
  relativePath: string,
  content: string,
): Promise<boolean> => {
  const safePath = normalizeRelativePath(relativePath);
  if (!safePath) return false;
  try {
    // Deduplication: skip write if content is identical
    try {
      const existing = await vm.fs.readTextFile(safePath);
      if (typeof existing === "string" && existing === content) {
        return true; // File already has this exact content, skip write
      }
    } catch {
      // File doesn't exist yet, proceed with write
    }
    await vm.fs.writeTextFile(safePath, content);
    return true;
  } catch {
    return false;
  }
};

export { WORKDIR };
