// =============================================================================
// DevOps Tools (Category 8)
// Tools for build, deploy, environment management.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "@/lib/local-vm";
import type { BuildForgeContext } from "../../types";
import { writeVmFile, runVmCommand, WORKDIR } from "../base";

export const createDevopsTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "devops_health_check": tool({
    description:
      "Check the health of the running application (dev server status, response time).",
    inputSchema: z.object({
      path: z.string().default("/").describe("URL path to check."),
    }),
    execute: async ({ path }) => {
      const urlPath = path.startsWith("/") ? path : `/${path}`;
      const result = await runVmCommand(
        vm,
        `curl -s -o /dev/null -w '{"statusCode":%{http_code},"totalTime":%{time_total}}' http://localhost:3000${urlPath} 2>/dev/null`,
      );

      try {
        const info = JSON.parse(result.stdout);
        return {
          ok: info.statusCode >= 200 && info.statusCode < 400,
          statusCode: info.statusCode,
          responseTime: info.totalTime,
          path: urlPath,
        };
      } catch {
        return { ok: false, error: "Dev server not responding." };
      }
    },
  }),

  "devops_bundle_analyze": tool({
    description:
      "Analyze the production bundle size to identify large dependencies.",
    inputSchema: z.object({}),
    execute: async () => {
      const result = await runVmCommand(
        vm,
        `cd ${WORKDIR} && npx next build 2>&1 | grep -E '(Route|Size|First)' | tail -20`,
      );
      return { ok: result.ok, analysis: result.stdout.slice(-1000) };
    },
  }),

  "devops_generate_dockerfile": tool({
    description:
      "Generate a Dockerfile for the application.",
    inputSchema: z.object({
      filePath: z.string().default("Dockerfile"),
      code: z.string().describe("Dockerfile content."),
    }),
    execute: async ({ filePath, code }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath };
    },
  }),

  "devops_generate_ci": tool({
    description:
      "Generate a CI/CD pipeline configuration (GitHub Actions).",
    inputSchema: z.object({
      filePath: z.string().default(".github/workflows/ci.yml"),
      code: z.string().describe("CI pipeline YAML content."),
    }),
    execute: async ({ filePath, code }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath };
    },
  }),
});
