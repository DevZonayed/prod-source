// =============================================================================
// Repository Analysis Tools (Category 9)
// Tools for scanning existing codebases, extracting patterns, generating memory.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "freestyle-sandboxes";
import type { BuildForgeContext } from "../../types";
import { runVmCommand, WORKDIR } from "../base";

export const createRepoAnalysisTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "repo.scan": tool({
    description:
      "Full repository scan: identifies tech stack, folder structure, file count, dependencies. Creates a project fingerprint.",
    inputSchema: z.object({}),
    execute: async () => {
      const [pkgJson, structure, fileCount, gitLog] = await Promise.all([
        runVmCommand(vm, `cat ${WORKDIR}/package.json 2>/dev/null`),
        runVmCommand(vm, `cd ${WORKDIR} && find . -maxdepth 3 -type f -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' | head -100`),
        runVmCommand(vm, `cd ${WORKDIR} && find . -type f -not -path '*/node_modules/*' -not -path '*/.next/*' -not -path '*/.git/*' | wc -l`),
        runVmCommand(vm, `cd ${WORKDIR} && git log --oneline -10 2>/dev/null`),
      ]);

      let dependencies: Record<string, string> = {};
      let devDependencies: Record<string, string> = {};
      try {
        const pkg = JSON.parse(pkgJson.stdout);
        dependencies = pkg.dependencies ?? {};
        devDependencies = pkg.devDependencies ?? {};
      } catch {}

      // Detect tech stack
      const stack: string[] = [];
      if (dependencies["next"]) stack.push(`Next.js ${dependencies["next"]}`);
      if (dependencies["react"]) stack.push("React");
      if (dependencies["tailwindcss"] || devDependencies["tailwindcss"]) stack.push("Tailwind CSS");
      if (dependencies["prisma"] || devDependencies["prisma"]) stack.push("Prisma");
      if (dependencies["mongoose"]) stack.push("Mongoose");
      if (dependencies["zustand"]) stack.push("Zustand");
      if (dependencies["zod"]) stack.push("Zod");

      return {
        ok: true,
        techStack: stack,
        fileCount: parseInt(fileCount.stdout.trim()) || 0,
        structure: structure.stdout.trim().split("\n").slice(0, 50),
        dependencyCount: Object.keys(dependencies).length,
        devDependencyCount: Object.keys(devDependencies).length,
        recentCommits: gitLog.stdout.trim().split("\n").slice(0, 5),
      };
    },
  }),

  "repo.analyze_routes": tool({
    description:
      "Analyze the Next.js App Router structure: discover all routes, pages, layouts, and API routes.",
    inputSchema: z.object({}),
    execute: async () => {
      const [pages, apiRoutes, layouts] = await Promise.all([
        runVmCommand(vm, `cd ${WORKDIR} && find app -name 'page.tsx' -o -name 'page.ts' 2>/dev/null`),
        runVmCommand(vm, `cd ${WORKDIR} && find app -path '*/api/*' -name 'route.ts' 2>/dev/null`),
        runVmCommand(vm, `cd ${WORKDIR} && find app -name 'layout.tsx' -o -name 'layout.ts' 2>/dev/null`),
      ]);

      return {
        ok: true,
        pages: pages.stdout.trim().split("\n").filter(Boolean),
        apiRoutes: apiRoutes.stdout.trim().split("\n").filter(Boolean),
        layouts: layouts.stdout.trim().split("\n").filter(Boolean),
      };
    },
  }),

  "repo.extract_components": tool({
    description:
      "Extract all React components from the codebase: find exported components, their props, and file paths.",
    inputSchema: z.object({
      directory: z.string().default("components").describe("Directory to scan for components."),
    }),
    execute: async ({ directory }) => {
      const result = await runVmCommand(
        vm,
        `cd ${WORKDIR} && grep -rn 'export.*function\\|export.*const.*=.*(' ${directory}/ --include='*.tsx' --include='*.ts' 2>/dev/null | head -50`,
      );

      const components = result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const [filePath, ...rest] = line.split(":");
          return { file: filePath, export: rest.join(":").trim().slice(0, 100) };
        });

      return { ok: true, componentCount: components.length, components };
    },
  }),

  "repo.dependency_map": tool({
    description:
      "Analyze import dependencies between files to understand module coupling.",
    inputSchema: z.object({
      filePath: z.string().describe("File to analyze imports for."),
    }),
    execute: async ({ filePath }) => {
      const result = await runVmCommand(
        vm,
        `cd ${WORKDIR} && grep -n "^import" ${filePath} 2>/dev/null`,
      );

      const imports = result.stdout
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const fromMatch = line.match(/from\s+['"](.+?)['"]/);
          return fromMatch ? fromMatch[1] : null;
        })
        .filter(Boolean);

      return { ok: true, file: filePath, imports, importCount: imports.length };
    },
  }),
});
