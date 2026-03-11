// =============================================================================
// Dependency Upgrader
// Upgrades Next.js (and optionally NestJS) to the target versions after
// the VM is created from the template repo.
// =============================================================================

import type { Vm } from "freestyle-sandboxes";
import { WORKDIR, TARGET_NEXTJS_VERSION, TARGET_NESTJS_VERSION } from "./vars";

const shellQuote = (value: string): string =>
  `'${value.replace(/'/g, `'\\''`)}'`;

const runVmCommand = async (
  vm: Vm,
  command: string,
): Promise<{ ok: boolean; stdout: string; stderr: string }> => {
  const result = await vm.exec({ command });
  if (typeof result === "string") {
    return { ok: true, stdout: result, stderr: "" };
  }
  if (result && typeof result === "object") {
    const r = result as Record<string, unknown>;
    return {
      ok: typeof r.exitCode === "number" ? r.exitCode === 0 : true,
      stdout: typeof r.stdout === "string" ? r.stdout : "",
      stderr: typeof r.stderr === "string" ? r.stderr : "",
    };
  }
  return { ok: true, stdout: String(result ?? ""), stderr: "" };
};

/**
 * Upgrade Next.js and its core dependencies to the target version.
 * Runs inside the VM after template clone.
 */
export async function upgradeNextjs(vm: Vm): Promise<{
  ok: boolean;
  upgradedFrom?: string;
  upgradedTo?: string;
  error?: string;
}> {
  try {
    // Get current version
    const currentResult = await runVmCommand(
      vm,
      `cd ${shellQuote(WORKDIR)} && node -e "console.log(require('./node_modules/next/package.json').version)" 2>/dev/null || echo "unknown"`,
    );
    const currentVersion = currentResult.stdout.trim();

    // Determine target version string
    const versionSpec =
      TARGET_NEXTJS_VERSION === "latest" ? "@latest" : `@${TARGET_NEXTJS_VERSION}`;

    // Upgrade next + react + react-dom together to ensure compatibility
    const upgradeCmd = `cd ${shellQuote(WORKDIR)} && npm install next${versionSpec} react@latest react-dom@latest @types/react@latest @types/react-dom@latest --save 2>&1`;
    const upgradeResult = await runVmCommand(vm, upgradeCmd);

    if (!upgradeResult.ok) {
      return {
        ok: false,
        error: `Upgrade failed: ${upgradeResult.stderr || upgradeResult.stdout}`.slice(0, 500),
      };
    }

    // Get new version
    const newResult = await runVmCommand(
      vm,
      `cd ${shellQuote(WORKDIR)} && node -e "console.log(require('./node_modules/next/package.json').version)" 2>/dev/null || echo "unknown"`,
    );
    const newVersion = newResult.stdout.trim();

    return {
      ok: true,
      upgradedFrom: currentVersion,
      upgradedTo: newVersion,
    };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Unknown upgrade error",
    };
  }
}

/**
 * Upgrade NestJS core packages to the target version.
 * Only runs if NestJS is already in the project's dependencies.
 */
export async function upgradeNestjs(vm: Vm): Promise<{
  ok: boolean;
  upgraded: boolean;
  upgradedTo?: string;
  error?: string;
}> {
  try {
    // Check if NestJS is in the project
    const checkResult = await runVmCommand(
      vm,
      `cd ${shellQuote(WORKDIR)} && grep -q "@nestjs/core" package.json && echo "yes" || echo "no"`,
    );

    if (checkResult.stdout.trim() !== "yes") {
      return { ok: true, upgraded: false }; // No NestJS in project, skip
    }

    const versionSpec =
      TARGET_NESTJS_VERSION === "latest" ? "@latest" : `@${TARGET_NESTJS_VERSION}`;

    // Upgrade all NestJS core packages together
    const upgradeCmd = `cd ${shellQuote(WORKDIR)} && npm install @nestjs/core${versionSpec} @nestjs/common${versionSpec} @nestjs/platform-express${versionSpec} --save 2>&1`;
    const upgradeResult = await runVmCommand(vm, upgradeCmd);

    if (!upgradeResult.ok) {
      return {
        ok: false,
        upgraded: false,
        error: `NestJS upgrade failed: ${upgradeResult.stderr || upgradeResult.stdout}`.slice(0, 500),
      };
    }

    // Get new version
    const newResult = await runVmCommand(
      vm,
      `cd ${shellQuote(WORKDIR)} && node -e "console.log(require('./node_modules/@nestjs/core/package.json').version)" 2>/dev/null || echo "unknown"`,
    );

    return {
      ok: true,
      upgraded: true,
      upgradedTo: newResult.stdout.trim(),
    };
  } catch (e) {
    return {
      ok: false,
      upgraded: false,
      error: e instanceof Error ? e.message : "Unknown upgrade error",
    };
  }
}
