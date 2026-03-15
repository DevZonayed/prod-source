// =============================================================================
// BuildForge Constants
// Token budgets, retry limits, file paths, and configuration defaults.
// =============================================================================

import type { ContextLayerId } from "./types";

// -----------------------------------------------------------------------------
// Token Budgets (per context layer)
// -----------------------------------------------------------------------------

export const TOKEN_BUDGETS: Record<ContextLayerId, { min: number; max: number }> = {
  layer0: { min: 400, max: 600 },
  layer1: { min: 800, max: 2000 },
  layer2: { min: 400, max: 1000 },
  layer3: { min: 80, max: 200 },
};

export const CONTEXT_BUDGET_BY_TASK: Record<string, { target: number; max: number }> = {
  simple_component: { target: 2000, max: 3000 },
  complex_page: { target: 3500, max: 5000 },
  backend_module: { target: 3000, max: 4500 },
  full_feature: { target: 5000, max: 8000 },
  architecture_decision: { target: 4000, max: 6000 },
  default: { target: 3000, max: 4500 },
};

// -----------------------------------------------------------------------------
// Memory System
// -----------------------------------------------------------------------------

export const BUILDFORGE_DIR = ".buildforge";
export const MEMORY_DIR = `${BUILDFORGE_DIR}/memory`;
export const SPEC_FILE = `${BUILDFORGE_DIR}/spec.json`;
export const PLAN_FILE = `${BUILDFORGE_DIR}/current-plan.json`;

export const MEMORY_FILES = {
  architecture: `${MEMORY_DIR}/architecture.md`,
  entities: `${MEMORY_DIR}/entities.md`,
  components: `${MEMORY_DIR}/components.md`,
  "api-endpoints": `${MEMORY_DIR}/api-endpoints.md`,
  "business-rules": `${MEMORY_DIR}/business-rules.md`,
  "ui-patterns": `${MEMORY_DIR}/ui-patterns.md`,
  "issues-resolved": `${MEMORY_DIR}/issues-resolved.md`,
  changelog: `${MEMORY_DIR}/changelog.md`,
  decisions: `${MEMORY_DIR}/decisions.md`,
} as const;

// -----------------------------------------------------------------------------
// Orchestrator Limits
// -----------------------------------------------------------------------------

export const MAX_RETRIES = 3;
export const MAX_TASKS_PER_PLAN = 50;
export const MAX_STEPS_PER_EXECUTION = 100;
export const CHECKPOINT_INTERVAL = 5; // Create checkpoint every N tasks

// -----------------------------------------------------------------------------
// Pattern Keywords (for quick matching)
// -----------------------------------------------------------------------------

export const PATTERN_KEYWORDS: Record<string, string[]> = {
  ecommerce: [
    "shop", "store", "product", "cart", "checkout", "order", "payment",
    "inventory", "catalog", "e-commerce", "ecommerce", "buy", "sell",
    "shipping", "wishlist", "review",
  ],
  saas: [
    "saas", "subscription", "plan", "billing", "tenant", "organization",
    "team", "workspace", "dashboard", "analytics", "multi-tenant", "pricing",
  ],
  marketplace: [
    "marketplace", "vendor", "seller", "buyer", "listing", "commission",
    "payout", "dispute", "multi-vendor", "two-sided",
  ],
  crm: [
    "crm", "contact", "lead", "pipeline", "deal", "opportunity",
    "customer relationship", "sales", "funnel",
  ],
  cms: [
    "cms", "blog", "post", "article", "content", "editor", "publish",
    "draft", "category", "tag", "media", "author",
  ],
  booking: [
    "booking", "appointment", "schedule", "calendar", "slot", "reservation",
    "availability", "service", "provider",
  ],
  social: [
    "social", "feed", "post", "follow", "like", "comment", "notification",
    "message", "profile", "friend", "group", "community",
  ],
  lms: [
    "lms", "course", "lesson", "quiz", "student", "instructor", "learning",
    "education", "certificate", "progress", "enrollment",
  ],
};

// -----------------------------------------------------------------------------
// Deduplication Rules (Global)
// -----------------------------------------------------------------------------

export const DEDUPLICATION_RULES = [
  "Category-filtered pages are ONE dynamic route with query parameters, not separate pages.",
  "Role-based dashboards share a layout with conditional content blocks, not separate dashboard pages.",
  "CRUD operations for similar entities share a generic component (DataTable, EntityForm) with configuration, not custom components per entity.",
  "List/Detail/Edit screens follow the same structural pattern — generate a pattern once, instantiate per entity.",
  "Authentication (login/register/reset) is generated once as a module, never duplicated.",
  "API error handling is centralized in an interceptor, not repeated in every controller.",
  "Form validation schemas derive from entity definitions, not written independently.",
] as const;
