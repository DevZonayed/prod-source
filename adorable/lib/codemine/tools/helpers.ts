import type { Vm } from "@/lib/local-vm";
import type { LocalVm } from "@/lib/local-vm";

/**
 * Get the effective WORKDIR for a VM.
 * In local mode, this is the project directory.
 * Falls back to "/workspace" for compatibility with system prompts.
 */
function getWorkdir(vm: Vm): string {
  if ("getProjectDir" in vm && typeof (vm as LocalVm).getProjectDir === "function") {
    return (vm as LocalVm).getProjectDir();
  }
  return "/workspace";
}

// Legacy WORKDIR constant — the AI's system prompt references /workspace
const LEGACY_WORKDIR = "/workspace";

/**
 * Validates and normalizes a relative path. Returns null for invalid paths.
 * Prevents directory traversal, absolute paths, and null bytes.
 */
export function normalizeRelativePath(rawPath: string): string | null {
  const value = rawPath.trim();
  if (!value || value.includes("\0")) return null;

  // Strip leading ./ but allow just "."
  const normalized = value.replace(/^\.\//, "");
  const segments = normalized.split("/");
  if (segments.some((seg) => seg === "..")) return null;

  return normalized || ".";
}

/**
 * Resolves an absolute path within the VM workspace.
 * Accepts both real project paths and legacy /workspace paths.
 * If relative, prepends the VM's workdir.
 * Returns null for paths escaping the workspace.
 */
export function resolveAbsPath(path: string, vm?: Vm): string | null {
  const trimmed = path.trim();
  if (!trimmed || trimmed.includes("\0")) return null;

  const workdir = vm ? getWorkdir(vm) : LEGACY_WORKDIR;

  // Already absolute
  if (trimmed.startsWith("/")) {
    // Translate legacy /workspace paths to the real project dir
    if (trimmed.startsWith(LEGACY_WORKDIR + "/") || trimmed === LEGACY_WORKDIR) {
      const relative = trimmed === LEGACY_WORKDIR ? "" : trimmed.slice(LEGACY_WORKDIR.length + 1);
      if (trimmed.includes("/../") || trimmed.endsWith("/..")) return null;
      return relative ? `${workdir}/${relative}` : workdir;
    }

    // Real project directory paths
    if (trimmed.startsWith(workdir + "/") || trimmed === workdir) {
      if (trimmed.includes("/../") || trimmed.endsWith("/..")) return null;
      return trimmed;
    }

    // Unknown absolute path — reject
    return null;
  }

  // Relative path
  const rel = normalizeRelativePath(trimmed);
  if (!rel) return null;
  return rel === "." ? workdir : `${workdir}/${rel}`;
}

/**
 * Escapes a string for safe shell interpolation using single quotes.
 */
export function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

/**
 * Executes a command on the VM and returns a structured result.
 */
export async function runVmCommand(
  vm: Vm,
  command: string,
): Promise<{
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}> {
  const execResult = await vm.exec({ command });

  if (typeof execResult === "string") {
    return { ok: true, stdout: execResult, stderr: "", exitCode: 0 };
  }

  if (execResult && typeof execResult === "object") {
    const cast = execResult as Record<string, unknown>;
    return {
      ok:
        typeof cast.ok === "boolean"
          ? cast.ok
          : typeof cast.exitCode === "number"
            ? cast.exitCode === 0
            : true,
      stdout: typeof cast.stdout === "string" ? cast.stdout : "",
      stderr: typeof cast.stderr === "string" ? cast.stderr : "",
      exitCode: typeof cast.exitCode === "number" ? cast.exitCode : null,
    };
  }

  return {
    ok: true,
    stdout: execResult == null ? "" : String(execResult),
    stderr: "",
    exitCode: null,
  };
}

/**
 * Reads a file from the VM workspace. Returns null if not found or on error.
 */
export async function readVmFile(
  vm: Vm,
  absolutePath: string,
): Promise<string | null> {
  try {
    const content = await vm.fs.readTextFile(absolutePath);
    return typeof content === "string" ? content : null;
  } catch {
    return null;
  }
}

/**
 * Writes a file on the VM. Returns true on success.
 * Includes deduplication: skips write if content matches existing.
 */
export async function writeVmFile(
  vm: Vm,
  absolutePath: string,
  content: string,
): Promise<{ written: boolean; skipped: boolean }> {
  try {
    // Check existing content for dedup
    const existing = await readVmFile(vm, absolutePath);
    if (existing === content) {
      return { written: false, skipped: true };
    }

    await vm.fs.writeTextFile(absolutePath, content);
    return { written: true, skipped: false };
  } catch {
    // If read failed (file doesn't exist), write anyway
    try {
      await vm.fs.writeTextFile(absolutePath, content);
      return { written: true, skipped: false };
    } catch {
      return { written: false, skipped: false };
    }
  }
}

/**
 * Extracts dev server logs and parses for errors/warnings.
 */
export async function getDevServerLogs(
  vm: Vm,
): Promise<{ logs: string; errors: string[] }> {
  try {
    const devServer = (vm as { devServer?: { getLogs?: () => unknown } })
      .devServer;
    if (!devServer?.getLogs) {
      return { logs: "", errors: [] };
    }
    const raw = await devServer.getLogs();
    const logs = typeof raw === "string" ? raw : "";

    const errorPattern =
      /(error -|failed to compile|module not found|unhandled runtime error|referenceerror|typeerror|syntaxerror|cannot find module)/i;
    const lines = logs.split("\n");
    const errors = lines.filter((line) => errorPattern.test(line)).slice(-20);

    return { logs, errors };
  } catch {
    return { logs: "", errors: [] };
  }
}

/**
 * Ensures a directory exists on the VM.
 */
export async function ensureDir(vm: Vm, absolutePath: string): Promise<void> {
  await vm.exec({ command: `mkdir -p ${shellQuote(absolutePath)}` });
}
