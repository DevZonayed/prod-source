// =============================================================================
// Skills Loader
// Dynamically loads agent skill files based on task context.
// Skills are markdown files in ../.agents/skills/ that provide expert knowledge
// for code generation, design, and architecture decisions.
// =============================================================================

import { readFile, readdir } from "fs/promises";
import { join } from "path";

const SKILLS_DIR = join(process.cwd(), "..", ".agents", "skills");

// Skill definitions with their file paths and trigger keywords
const SKILL_REGISTRY: {
  id: string;
  file: string;
  keywords: string[];
  /** Always include this skill (e.g., frontend-design for all UI work) */
  alwaysForUI?: boolean;
  /** Only include for full-stack / backend work */
  backendOnly?: boolean;
  /** Load all .md files in the skill directory (for skills with sub-files) */
  loadSubFiles?: boolean;
  /** Max sub-files to load (to prevent prompt bloat) */
  maxSubFiles?: number;
}[] = [
  {
    id: "frontend-design",
    file: "frontend-design/SKILL.md",
    keywords: [
      "landing", "page", "website", "ui", "design", "component", "layout",
      "dashboard", "portfolio", "blog", "beautiful", "attractive", "stunning",
      "modern", "elegant", "hero", "navbar", "footer", "card", "modal",
      "interface", "frontend", "style", "theme", "aesthetic",
    ],
    alwaysForUI: true,
  },
  {
    id: "ui-ux-pro-max",
    file: "ui-ux-pro-max/SKILL.md",
    keywords: [
      "landing", "page", "website", "ui", "ux", "design", "accessibility",
      "responsive", "mobile", "color", "palette", "font", "typography",
      "animation", "dark mode", "light mode", "glassmorphism", "minimalism",
      "brutalism", "gradient", "shadow", "hover", "chart", "dashboard",
    ],
    alwaysForUI: true,
  },
  {
    id: "next-best-practices",
    file: "next-best-practices/SKILL.md",
    keywords: [
      "next", "nextjs", "react", "server component", "client component",
      "app router", "route", "page", "layout", "loading", "error",
      "metadata", "seo", "image", "font", "ssr", "ssg", "isr",
      "middleware", "api route", "server action",
    ],
    alwaysForUI: true,
    // Sub-files are too large (~80KB) — only load the main SKILL.md index
    loadSubFiles: false,
  },
  {
    id: "typescript-advanced-types",
    file: "typescript-advanced-types/SKILL.md",
    keywords: [
      "typescript", "type", "generic", "interface", "enum", "utility type",
      "conditional type", "mapped type", "infer", "template literal",
      "type guard", "type safe", "strict",
    ],
  },
  {
    id: "nestjs-expert",
    file: "nestjs-expert/SKILL.md",
    keywords: [
      "nest", "nestjs", "backend", "api", "rest", "graphql", "controller",
      "service", "module", "guard", "interceptor", "middleware", "pipe",
      "database", "orm", "typeorm", "mongoose", "prisma", "auth",
      "authentication", "authorization", "jwt", "passport",
      "full-stack", "fullstack", "server", "crud",
    ],
    backendOnly: true,
  },
  {
    id: "nestjs-best-practices",
    file: "nestjs-best-practices/SKILL.md",
    keywords: [
      "nest", "nestjs", "backend", "architecture", "dependency injection",
      "security", "performance", "testing", "microservice",
      "full-stack", "fullstack",
    ],
    backendOnly: true,
  },
  {
    id: "javascript-typescript-jest",
    file: "javascript-typescript-jest/SKILL.md",
    keywords: [
      "test", "jest", "testing", "mock", "spy", "snapshot", "coverage",
      "unit test", "integration test", "e2e",
    ],
  },
];

// Keywords that indicate a full-stack (NestJS backend) requirement
const FULLSTACK_KEYWORDS = [
  "full-stack", "fullstack", "full stack", "backend", "api", "rest",
  "database", "db", "auth", "authentication", "login", "signup", "register",
  "crud", "admin panel", "admin dashboard", "user management", "role",
  "payment", "stripe", "webhook", "email", "notification", "real-time",
  "websocket", "socket", "chat app", "e-commerce", "ecommerce", "shop",
  "cart", "checkout", "order", "inventory", "crm", "saas", "multi-tenant",
  "microservice", "graphql", "mongodb", "postgresql", "mysql", "redis",
  "queue", "job", "cron", "upload", "file storage", "s3",
];

// Keywords that indicate Next.js-only is sufficient
const NEXTJS_ONLY_KEYWORDS = [
  "landing page", "landing", "portfolio", "blog", "static", "marketing",
  "brochure", "showcase", "personal site", "resume", "cv",
  "single page", "one page", "simple", "ui only", "frontend only",
  "no backend", "static site", "informational",
];

export type StackDecision = "nextjs-only" | "fullstack";

/**
 * Determine whether a task needs full-stack (NestJS + Next.js) or Next.js only.
 */
export function detectStackRequirement(userMessage: string): StackDecision {
  const lower = userMessage.toLowerCase();

  // Check for explicit full-stack indicators
  const hasFullstackSignal = FULLSTACK_KEYWORDS.some((kw) => lower.includes(kw));
  const hasNextjsOnlySignal = NEXTJS_ONLY_KEYWORDS.some((kw) => lower.includes(kw));

  // If both signals present, full-stack wins (more complex requirement)
  if (hasFullstackSignal && !hasNextjsOnlySignal) return "fullstack";
  if (hasNextjsOnlySignal && !hasFullstackSignal) return "nextjs-only";

  // If both or neither, default to Next.js only (simpler)
  if (hasFullstackSignal && hasNextjsOnlySignal) return "fullstack";
  return "nextjs-only";
}

/**
 * Load relevant skill content based on user message and stack decision.
 * Returns a formatted string to append to the system prompt.
 */
export async function loadRelevantSkills(
  userMessage: string,
  stack: StackDecision,
): Promise<string> {
  const lower = userMessage.toLowerCase();
  const isUIWork = hasUISignals(lower);

  const relevantSkills: { id: string; content: string }[] = [];

  for (const skill of SKILL_REGISTRY) {
    // Skip backend skills for Next.js-only tasks
    if (skill.backendOnly && stack !== "fullstack") continue;

    // Include if: always-for-UI and this is UI work, OR keywords match
    const keywordMatch = skill.keywords.some((kw) => lower.includes(kw));
    const uiMatch = skill.alwaysForUI && isUIWork;

    if (keywordMatch || uiMatch) {
      try {
        const filePath = join(SKILLS_DIR, skill.file);
        let content = await readFile(filePath, "utf-8");
        // Strip YAML frontmatter
        content = content.replace(/^---[\s\S]*?---\s*/, "").trim();

        // Load sub-files if configured
        if (skill.loadSubFiles) {
          const skillDir = join(SKILLS_DIR, skill.file.replace("/SKILL.md", ""));
          try {
            const entries = await readdir(skillDir);
            const mdFiles = entries
              .filter((f) => f.endsWith(".md") && f !== "SKILL.md" && f !== "README.md" && f !== "LICENSE.md")
              .slice(0, skill.maxSubFiles ?? 5);

            const subContents = await Promise.all(
              mdFiles.map(async (f) => {
                try {
                  const sub = await readFile(join(skillDir, f), "utf-8");
                  return `\n#### ${f.replace(".md", "")}\n${sub.replace(/^---[\s\S]*?---\s*/, "").trim()}`;
                } catch {
                  return "";
                }
              }),
            );
            content += subContents.filter(Boolean).join("\n");
          } catch {
            // Sub-directory not found, continue with main file only
          }
        }

        relevantSkills.push({ id: skill.id, content });
      } catch {
        // Skill file not found, skip silently
      }
    }
  }

  if (relevantSkills.length === 0) return "";

  // Cap each skill to ~4000 chars to prevent prompt bloat
  const MAX_SKILL_CHARS = 4000;
  const sections = relevantSkills.map((s) => {
    const trimmed = s.content.length > MAX_SKILL_CHARS
      ? s.content.slice(0, MAX_SKILL_CHARS) + "\n\n[... truncated for brevity]"
      : s.content;
    return `### Skill: ${s.id}\n${trimmed}`;
  });

  // Cap total skills content to ~20000 chars
  const MAX_TOTAL_CHARS = 20000;
  let total = "";
  const includedSections: string[] = [];
  for (const section of sections) {
    if (total.length + section.length > MAX_TOTAL_CHARS) break;
    includedSections.push(section);
    total += section;
  }

  if (includedSections.length === 0) return "";

  return `\n\n## Expert Skills (APPLY THESE WHEN GENERATING CODE)\n\n${includedSections.join("\n\n---\n\n")}`;
}

function hasUISignals(lower: string): boolean {
  const uiKeywords = [
    "page", "landing", "website", "ui", "design", "component", "dashboard",
    "layout", "navbar", "footer", "hero", "card", "form", "button", "modal",
    "sidebar", "table", "list", "portfolio", "blog", "interface", "frontend",
    "style", "theme", "beautiful", "attractive", "modern", "app",
  ];
  return uiKeywords.some((kw) => lower.includes(kw));
}
