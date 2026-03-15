// =============================================================================
// Backend Generation Tools (Category 5)
// Tools for generating API routes, models, services, auth, middleware.
// =============================================================================

import { tool, type ToolSet } from "ai";
import { z } from "zod";
import type { Vm } from "@/lib/local-vm";
import type { BuildForgeContext } from "../../types";
import { writeVmFile } from "../base";
import { updateMemorySection } from "../../memory/level2-project";

export const createBackendGenTools = (
  vm: Vm,
  ctx: BuildForgeContext,
): ToolSet => ({
  "backend_api_route": tool({
    description:
      "Generate a Next.js API route handler (route.ts). Creates typed request handling with validation.",
    inputSchema: z.object({
      filePath: z.string().describe("API route file path (e.g., 'app/api/products/route.ts')."),
      code: z.string().describe("Complete route handler code."),
      entity: z.string().describe("Primary entity this endpoint handles."),
      methods: z.array(z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"])).describe("HTTP methods implemented."),
      authRequired: z.boolean().default(false),
    }),
    execute: async ({ filePath, code, entity, methods, authRequired }) => {
      await writeVmFile(vm, filePath, code);

      const auth = authRequired ? "[auth]" : "[public]";
      const routePath = filePath.replace("app/api/", "/api/").replace("/route.ts", "");
      const memEntry = methods.map((m) => `- ${m} ${routePath} ${auth}`).join("\n");
      await updateMemorySection(vm, "api-endpoints", entity, memEntry);

      return { ok: true, file: filePath, entity, methods };
    },
  }),

  "backend_model": tool({
    description:
      "Generate a data model/schema file (Prisma schema, Mongoose model, or TypeScript interface).",
    inputSchema: z.object({
      filePath: z.string().describe("Model file path."),
      code: z.string().describe("Complete model/schema code."),
      entity: z.string().describe("Entity name."),
      fields: z.array(z.string()).optional().describe("Field names for quick reference."),
    }),
    execute: async ({ filePath, code, entity, fields }) => {
      await writeVmFile(vm, filePath, code);

      const memEntry = `**Path**: ${filePath}\n**Fields**: ${fields?.join(", ") ?? "see file"}`;
      await updateMemorySection(vm, "entities", entity, memEntry);

      return { ok: true, file: filePath, entity };
    },
  }),

  "backend_service": tool({
    description:
      "Generate a service/business logic module. Contains CRUD operations, validations, and domain logic.",
    inputSchema: z.object({
      filePath: z.string().describe("Service file path."),
      code: z.string().describe("Complete service code."),
      entity: z.string().describe("Primary entity this service manages."),
    }),
    execute: async ({ filePath, code, entity }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath, entity };
    },
  }),

  "backend_auth": tool({
    description:
      "Generate authentication-related code (auth config, middleware, helpers).",
    inputSchema: z.object({
      filePath: z.string().describe("Auth file path."),
      code: z.string().describe("Complete auth code."),
      authType: z.enum(["nextauth", "jwt", "session", "middleware"]).describe("Type of auth code."),
    }),
    execute: async ({ filePath, code, authType }) => {
      await writeVmFile(vm, filePath, code);

      await updateMemorySection(vm, "architecture", "Authentication", `**Type**: ${authType}\n**File**: ${filePath}`);

      return { ok: true, file: filePath, authType };
    },
  }),

  "backend_middleware": tool({
    description:
      "Generate middleware (Next.js middleware, API middleware, validation, etc.).",
    inputSchema: z.object({
      filePath: z.string().describe("Middleware file path."),
      code: z.string().describe("Complete middleware code."),
      purpose: z.string().describe("What this middleware does."),
    }),
    execute: async ({ filePath, code, purpose }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath, purpose };
    },
  }),

  "backend_validation": tool({
    description:
      "Generate validation schemas (Zod schemas for API request/response validation).",
    inputSchema: z.object({
      filePath: z.string().describe("Validation file path."),
      code: z.string().describe("Zod schemas code."),
      entity: z.string().describe("Entity these schemas validate."),
    }),
    execute: async ({ filePath, code, entity }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath, entity };
    },
  }),

  "backend_database": tool({
    description:
      "Generate database configuration or migration files.",
    inputSchema: z.object({
      filePath: z.string().describe("Database config file path."),
      code: z.string().describe("Database configuration code."),
      dbType: z.string().optional().describe("Database type (postgresql, mongodb, etc.)."),
    }),
    execute: async ({ filePath, code, dbType }) => {
      await writeVmFile(vm, filePath, code);

      if (dbType) {
        await updateMemorySection(vm, "architecture", "Database", `**Type**: ${dbType}\n**Config**: ${filePath}`);
      }

      return { ok: true, file: filePath, dbType };
    },
  }),

  "backend_seed": tool({
    description:
      "Generate database seed/sample data files.",
    inputSchema: z.object({
      filePath: z.string().describe("Seed file path."),
      code: z.string().describe("Seed data code."),
      entities: z.array(z.string()).describe("Entities being seeded."),
    }),
    execute: async ({ filePath, code, entities }) => {
      await writeVmFile(vm, filePath, code);
      return { ok: true, file: filePath, entities };
    },
  }),
});
