// =============================================================================
// Project Initialization Tools (Category 1)
// Tools for scaffolding new projects, configuring environments.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "@/lib/local-vm";
import type { BuildForgeContext } from "../../types";
import { runVmCommand, WORKDIR } from "../base";
import { upgradeNextjs, upgradeNestjs } from "../../../upgrade-dependencies";

export const createProjectInitTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "project_scaffold": tool({
    description:
      "Scaffold the project folder structure based on the specification. Creates directories for pages, components, lib, api routes, types, etc.",
    inputSchema: z.object({
      structure: z.array(z.string()).describe("List of directory paths to create (relative to workspace root)."),
    }),
    execute: async ({ structure }) => {
      const commands = structure.map(
        (dir) => `mkdir -p ${WORKDIR}/${dir}`,
      );
      const result = await runVmCommand(vm, commands.join(" && "));
      return { ok: result.ok, directoriesCreated: structure.length, structure };
    },
  }),

  "project_install_deps": tool({
    description:
      "Install npm dependencies in the workspace. Can install specific packages or run npm install.",
    inputSchema: z.object({
      packages: z.array(z.string()).optional().describe("Specific packages to install. Leave empty for npm install."),
      dev: z.boolean().default(false).describe("Install as dev dependencies."),
    }),
    execute: async ({ packages, dev }) => {
      const cmd = packages && packages.length > 0
        ? `cd ${WORKDIR} && npm install ${dev ? "-D" : ""} ${packages.join(" ")}`
        : `cd ${WORKDIR} && npm install`;
      const result = await runVmCommand(vm, cmd);
      return { ok: result.ok, stdout: result.stdout.slice(-500), stderr: result.stderr.slice(-300) };
    },
  }),

  "project_configure_env": tool({
    description:
      "Create or update environment files (.env, .env.local, .env.example) with configuration values.",
    inputSchema: z.object({
      fileName: z.string().default(".env.local").describe("Environment file name."),
      variables: z.record(z.string(), z.string()).describe("Key-value pairs for environment variables."),
    }),
    execute: async ({ fileName, variables }) => {
      const content = Object.entries(variables)
        .map(([key, value]) => `${key}=${value}`)
        .join("\n") + "\n";
      await vm.fs.writeTextFile(fileName, content);
      return { ok: true, file: fileName, variableCount: Object.keys(variables).length };
    },
  }),

  "project_validate_structure": tool({
    description:
      "Validate the project folder structure against the expected pattern. Checks for missing required files.",
    inputSchema: z.object({
      requiredFiles: z.array(z.string()).optional().describe("Files that should exist."),
    }),
    execute: async ({ requiredFiles }) => {
      const filesToCheck = requiredFiles ?? [
        "package.json", "tsconfig.json", "next.config.ts",
        "app/layout.tsx", "app/page.tsx",
      ];

      const results: Array<{ file: string; exists: boolean }> = [];
      for (const file of filesToCheck) {
        const checkResult = await runVmCommand(vm, `test -f ${WORKDIR}/${file} && echo "yes" || echo "no"`);
        results.push({ file, exists: checkResult.stdout.trim() === "yes" });
      }

      const missing = results.filter((r) => !r.exists);
      return {
        ok: missing.length === 0,
        checked: results.length,
        missing: missing.map((r) => r.file),
        message: missing.length === 0 ? "All required files present." : `Missing: ${missing.map((r) => r.file).join(", ")}`,
      };
    },
  }),

  "project_upgrade_deps": tool({
    description:
      "Upgrade Next.js (and NestJS if present) to the latest versions. Call this if the project is using outdated framework versions. Upgrades next, react, react-dom and their types together for compatibility.",
    inputSchema: z.object({
      upgradeNest: z.boolean().default(false).describe("Also upgrade NestJS packages if they exist in the project."),
    }),
    execute: async ({ upgradeNest }) => {
      const nextResult = await upgradeNextjs(vm);
      let nestResult = null;
      if (upgradeNest) {
        nestResult = await upgradeNestjs(vm);
      }
      return {
        ok: nextResult.ok,
        nextjs: nextResult,
        nestjs: nestResult,
      };
    },
  }),

  "project_add_nestjs": tool({
    description:
      "Add NestJS backend to the project. Creates a NestJS app alongside the existing Next.js frontend. Only use this when the project requires a dedicated backend (auth, database, complex APIs). Installs latest NestJS packages.",
    inputSchema: z.object({
      features: z.array(z.string()).optional().describe("Additional NestJS packages to install (e.g., '@nestjs/typeorm', '@nestjs/jwt', '@nestjs/passport')."),
    }),
    execute: async ({ features }) => {
      // Install NestJS core packages at latest
      const corePackages = [
        "@nestjs/core@latest",
        "@nestjs/common@latest",
        "@nestjs/platform-express@latest",
        "@nestjs/cli@latest",
        "reflect-metadata",
        "rxjs",
      ];
      const devPackages = [
        "@nestjs/testing@latest",
        "@nestjs/schematics@latest",
      ];
      const featurePackages = (features ?? []).map((f) =>
        f.includes("@") && !f.includes("@latest") && !f.includes("@^") ? `${f}@latest` : f
      );

      const installCmd = `cd ${WORKDIR} && npm install ${[...corePackages, ...featurePackages].join(" ")} && npm install -D ${devPackages.join(" ")}`;
      const result = await runVmCommand(vm, installCmd);

      return {
        ok: result.ok,
        installed: [...corePackages, ...featurePackages, ...devPackages],
        stdout: result.stdout.slice(-300),
        stderr: result.stderr.slice(-200),
      };
    },
  }),

  "project_status": tool({
    description:
      "Get comprehensive project status: git status, running processes, dependency state.",
    inputSchema: z.object({}),
    execute: async () => {
      const [gitStatus, nodeModules, devServer] = await Promise.all([
        runVmCommand(vm, `cd ${WORKDIR} && git status --short`),
        runVmCommand(vm, `test -d ${WORKDIR}/node_modules && echo "installed" || echo "missing"`),
        runVmCommand(vm, `curl -s -o /dev/null -w '%{http_code}' http://localhost:3000/ 2>/dev/null || echo "000"`),
      ]);

      return {
        ok: true,
        git: { changedFiles: gitStatus.stdout.trim().split("\n").filter(Boolean).length },
        dependencies: nodeModules.stdout.trim() === "installed" ? "installed" : "missing",
        devServer: parseInt(devServer.stdout.trim()) >= 200 ? "running" : "not running",
      };
    },
  }),
});
