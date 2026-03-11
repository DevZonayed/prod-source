// =============================================================================
// Frontend Generation Tools (Category 4)
// Tools for generating Next.js pages, components, state, and hooks.
// The LLM generates the actual code; these tools provide structure and memory.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "freestyle-sandboxes";
import type { BuildForgeContext } from "../../types";
import { writeVmFile, runVmCommand, WORKDIR } from "../base";
import { updateMemorySection } from "../../memory/level2-project";

export const createFrontendGenTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "frontend_page": tool({
    description:
      "Generate a complete Next.js App Router page. Creates page.tsx and optionally loading.tsx, error.tsx. Updates components memory.",
    inputSchema: z.object({
      route: z.string().describe("App Router route path (e.g., 'app/dashboard/orders/page.tsx')."),
      pageCode: z.string().describe("Complete page.tsx file content."),
      loadingCode: z.string().optional().describe("Optional loading.tsx content."),
      errorCode: z.string().optional().describe("Optional error.tsx content."),
      componentName: z.string().describe("Name of the page component."),
      entities: z.array(z.string()).optional().describe("Entities this page works with."),
    }),
    execute: async ({ route, pageCode, loadingCode, errorCode, componentName, entities }) => {
      const files: string[] = [];

      await writeVmFile(vm, route, pageCode);
      files.push(route);

      if (loadingCode) {
        const loadingPath = route.replace("page.tsx", "loading.tsx");
        await writeVmFile(vm, loadingPath, loadingCode);
        files.push(loadingPath);
      }

      if (errorCode) {
        const errorPath = route.replace("page.tsx", "error.tsx");
        await writeVmFile(vm, errorPath, errorCode);
        files.push(errorPath);
      }

      // Update components memory
      const memEntry = `**Path**: ${route}\n**Type**: Page\n**Entities**: ${entities?.join(", ") ?? "none"}\n**Pattern**: Page`;
      await updateMemorySection(vm, "components", componentName, memEntry);

      return { ok: true, filesCreated: files, component: componentName };
    },
  }),

  "frontend_component": tool({
    description:
      "Generate a reusable React component. Creates the component file with TypeScript props. Updates components memory.",
    inputSchema: z.object({
      filePath: z.string().describe("File path relative to workspace (e.g., 'components/ui/data-table.tsx')."),
      code: z.string().describe("Complete component file content with imports, props interface, and component."),
      componentName: z.string().describe("PascalCase component name."),
      pattern: z.string().optional().describe("UI pattern this component follows (DataTable, Form, Card, Modal, etc.)."),
      usedIn: z.array(z.string()).optional().describe("Pages/components that use this component."),
    }),
    execute: async ({ filePath, code, componentName, pattern, usedIn }) => {
      await writeVmFile(vm, filePath, code);

      const memEntry = `**Path**: ${filePath}\n**Type**: Component\n**Pattern**: ${pattern ?? "custom"}\n**Used in**: ${usedIn?.join(", ") ?? "TBD"}`;
      await updateMemorySection(vm, "components", componentName, memEntry);

      return { ok: true, file: filePath, component: componentName };
    },
  }),

  "frontend_layout": tool({
    description:
      "Generate a Next.js layout component (layout.tsx). Creates root, group, or nested layouts.",
    inputSchema: z.object({
      filePath: z.string().describe("Layout file path (e.g., 'app/(dashboard)/layout.tsx')."),
      code: z.string().describe("Complete layout.tsx content."),
      layoutName: z.string().describe("Descriptive layout name (e.g., 'DashboardLayout')."),
    }),
    execute: async ({ filePath, code, layoutName }) => {
      await writeVmFile(vm, filePath, code);

      const memEntry = `**Path**: ${filePath}\n**Type**: Layout`;
      await updateMemorySection(vm, "components", layoutName, memEntry);

      return { ok: true, file: filePath, layout: layoutName };
    },
  }),

  "frontend_store": tool({
    description:
      "Generate a Zustand store with typed state, actions, and selectors.",
    inputSchema: z.object({
      filePath: z.string().describe("Store file path (e.g., 'lib/stores/cart-store.ts')."),
      code: z.string().describe("Complete Zustand store code."),
      storeName: z.string().describe("Store name (e.g., 'useCartStore')."),
      entity: z.string().optional().describe("Primary entity this store manages."),
    }),
    execute: async ({ filePath, code, storeName, entity }) => {
      await writeVmFile(vm, filePath, code);

      const memEntry = `**Path**: ${filePath}\n**Type**: Store\n**Entity**: ${entity ?? "none"}`;
      await updateMemorySection(vm, "components", storeName, memEntry);

      return { ok: true, file: filePath, store: storeName };
    },
  }),

  "frontend_hook": tool({
    description:
      "Generate a custom React hook (API hook, utility hook, etc.).",
    inputSchema: z.object({
      filePath: z.string().describe("Hook file path (e.g., 'hooks/use-orders.ts')."),
      code: z.string().describe("Complete hook code."),
      hookName: z.string().describe("Hook name (e.g., 'useOrders')."),
    }),
    execute: async ({ filePath, code, hookName }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath, hook: hookName };
    },
  }),

  "frontend_types": tool({
    description:
      "Generate TypeScript type definitions file for entities, DTOs, API responses.",
    inputSchema: z.object({
      filePath: z.string().describe("Types file path (e.g., 'types/order.ts')."),
      code: z.string().describe("TypeScript interfaces and types."),
    }),
    execute: async ({ filePath, code }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath };
    },
  }),

  "frontend_api_client": tool({
    description:
      "Generate an API client module for communicating with backend endpoints.",
    inputSchema: z.object({
      filePath: z.string().describe("API client file path (e.g., 'lib/api/orders.ts')."),
      code: z.string().describe("Complete API client code with typed functions."),
      entity: z.string().describe("Entity this client handles."),
    }),
    execute: async ({ filePath, code, entity }) => {
      await writeVmFile(vm, filePath, code);

      const memEntry = `**Path**: ${filePath}\n**Type**: API Client\n**Entity**: ${entity}`;
      await updateMemorySection(vm, "components", `${entity}ApiClient`, memEntry);

      return { ok: true, file: filePath, entity };
    },
  }),

  "frontend_design_system": tool({
    description:
      "Initialize or update the design system configuration (tailwind config, CSS variables, theme).",
    inputSchema: z.object({
      filePath: z.string().describe("Config file path."),
      code: z.string().describe("Configuration content."),
      designTokens: z.string().optional().describe("Design token summary to store in memory."),
    }),
    execute: async ({ filePath, code, designTokens }) => {
      await writeVmFile(vm, filePath, code);

      if (designTokens) {
        await updateMemorySection(vm, "ui-patterns", "Design Tokens", designTokens);
      }

      return { ok: true, file: filePath };
    },
  }),
});
