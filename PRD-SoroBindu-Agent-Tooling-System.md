# PRD: SoroBudi Agent Tooling System (SATS)

**Product:** SoroBudi Agent Tooling System v1.0
**Author:** SoroBindu OPC — Md. Jillur Rahman
**Date:** March 09, 2026
**Status:** Draft
**Codename:** SATS (pronounced "sats")

---

## 1. Executive Summary

SATS is a modular, context-aware agentic tool system for Claude Code CLI that combines 18 core tools, an async context memory engine, and a progressive-disclosure plugin architecture. The system is designed to:

- Replicate and extend Claude Code's native toolset with project-aware intelligence
- Automatically analyze PRDs, codebases, and project artifacts to build a persistent **Feature→File Graph** (context memory)
- Support installable skills/plugins that load zero tokens until needed
- Use the **CLI `--help` pattern** for progressive disclosure — each tool exposes a single entry point; the agent calls `--help` first, then subcommands as needed

The system targets SoroBindu's multi-project freelance workflow where switching between 10–15 concurrent client projects demands instant context recovery without context window bloat.

---

## 2. Problem Statement

| Pain Point | Impact |
|---|---|
| Claude Code loads all MCP tool descriptions upfront | 2–3 MCP servers max before accuracy drops; context window bloat |
| No persistent feature-to-file mapping | Every session starts cold — agent re-discovers the same files repeatedly |
| Plugin/skill quality is inconsistent | Unvetted prompts from third-party MCPs can poison the workflow |
| Multi-project context switching | Jumping between Kvanti, Seha Care, Corner Cup, etc. requires manual re-orientation every time |
| No async background analysis | Agent can't index a new PRD or codebase while you continue working |

---

## 3. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                     SATS Runtime                             │
│                                                              │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐ │
│  │  Tool Layer  │  │ Memory Layer │  │   Plugin Registry   │ │
│  │  (18 core)   │  │  (async)     │  │   (progressive)     │ │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬──────────┘ │
│         │                 │                      │            │
│  ┌──────▼─────────────────▼──────────────────────▼──────────┐│
│  │              Tool Router / Dispatcher                     ││
│  │  - Matches user intent → tool                             ││
│  │  - Loads tool descriptions on-demand (--help pattern)     ││
│  │  - Injects context memory when relevant                   ││
│  └──────────────────────────────────────────────────────────┘│
│                                                              │
│  ┌──────────────────────────────────────────────────────────┐│
│  │              .sats/ Project Config                        ││
│  │  memory.json · plugins.json · features/ · agents/         ││
│  └──────────────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
```

---

## 4. Core Tool Layer — 18 Built-in Tools

### 4.1 Tool Registry Design (Progressive Disclosure)

Every tool follows the **CLI `--help` pattern** inspired by [claude-code-router](https://github.com/musistudio/claude-code-router). The agent sees only a **one-line description** per tool at session start. When a tool is selected, the agent calls `--help` to get full parameter schema and usage examples. This keeps initial context injection under **~800 tokens** for all 18 tools combined.

```
Session Start Context (Tier 0 — always loaded):
──────────────────────────────────────────────────
Tools available (use --help for details):

  Read        — Read file contents with line numbers
  Write       — Create or overwrite files
  Edit        — Surgical string-replace edits in files
  MultiEdit   — Batch multiple edits in one file atomically
  LS          — List directory contents (2 levels deep)
  Glob        — Fast file pattern matching (e.g. **/*.ts)
  Grep        — Ripgrep-powered content search with regex
  Bash        — Execute shell commands in persistent session
  BashBg      — Run background commands, retrieve output later
  WebFetch    — Fetch URL contents (HTML, JSON, raw)
  WebSearch   — Search the web for current information
  NotebookR   — Read Jupyter notebook cells
  NotebookE   — Edit Jupyter notebook cells
  TodoRead    — Read current task checklist
  TodoWrite   — Create/update structured task lists
  Task        — Launch sub-agent for complex multi-step work
  MemoryQ     — Query the Feature→File context memory
  MemorySync  — Trigger async codebase/PRD analysis

Type: <tool> --help for full usage.
```

**Token budget at Tier 0:** ~800 tokens (18 one-liners + header)

### 4.2 Disclosure Tiers

| Tier | What Loads | When | Token Cost |
|---|---|---|---|
| **Tier 0** — Registry | Tool names + one-line descriptions | Session start | ~800 |
| **Tier 1** — Help | Full parameter schema + 2–3 usage examples | Agent calls `<tool> --help` | ~200–400 per tool |
| **Tier 2** — Execution | Tool runs, returns output | Agent invokes tool with params | Variable |
| **Tier 3** — Deep Reference | Extended docs, edge cases, patterns | Agent calls `<tool> --help --verbose` | ~500–1000 per tool |

### 4.3 Tool Specifications

#### 4.3.1 File Operations

**Read**
```yaml
name: Read
category: file-ops
description: Read file contents with line numbers, pagination for large files, image/PDF support.
params:
  - file_path: string (required) — absolute or relative path
  - offset: int (optional) — start reading from this line (1-indexed)
  - limit: int (optional) — max lines to return (default: full file)
permissions: always-allow
notes: |
  - Supports text, images (visual display), PDFs (page selection), notebooks
  - Files >2000 lines paginate automatically
  - MUST be called before Edit to ensure accurate content
```

**Write**
```yaml
name: Write
category: file-ops
description: Create new files or fully overwrite existing files.
params:
  - file_path: string (required)
  - content: string (required) — full file content
permissions: ask-once
notes: |
  - Use Edit for surgical changes (cheaper in tokens)
  - Write sends full file content; Edit sends only changed lines
  - Creates parent directories automatically
```

**Edit**
```yaml
name: Edit
category: file-ops
description: Surgical find-and-replace edits. Safer and more token-efficient than Write.
params:
  - file_path: string (required)
  - old_string: string (required) — exact text to find (must be unique in file)
  - new_string: string (required) — replacement text
  - replace_all: boolean (optional, default: false) — replace all occurrences
permissions: ask-once
notes: |
  - Fails safely if old_string not found (prevents wrong-file edits)
  - Agent MUST Read the file first before editing
  - For renames/refactors, use replace_all: true
```

**MultiEdit**
```yaml
name: MultiEdit
category: file-ops
description: Apply multiple edits to a single file in one atomic operation.
params:
  - file_path: string (required)
  - edits: array of {old_string, new_string} (required)
permissions: ask-once
notes: |
  - All edits applied atomically — if any fails, none apply
  - More efficient than sequential Edit calls for bulk changes
  - Edits are applied in order; later edits see results of earlier ones
```

**LS**
```yaml
name: LS
category: file-ops
description: List directory contents up to 2 levels deep. Ignores hidden files and node_modules.
params:
  - path: string (optional, default: cwd)
permissions: always-allow
```

#### 4.3.2 Search Tools

**Glob**
```yaml
name: Glob
category: search
description: Fast file pattern matching. Returns paths sorted by modification time.
params:
  - pattern: string (required) — e.g. "**/*.tsx", "src/**/index.ts"
  - path: string (optional, default: cwd)
permissions: always-allow
notes: |
  - Use for finding files by name/extension
  - For content search, use Grep instead
  - Supports standard glob: *, **, ?, [abc], {a,b}
```

**Grep**
```yaml
name: Grep
category: search
description: Ripgrep-powered content search. Regex support, file-type filtering, context lines.
params:
  - pattern: string (required) — regex pattern
  - path: string (optional, default: cwd)
  - output_mode: enum (optional) — "content" | "files_with_matches" | "count"
  - glob: string (optional) — filter files, e.g. "*.ts"
  - type: string (optional) — file type, e.g. "js", "py"
  - context_lines: int (optional) — lines before/after match (-A/-B/-C)
permissions: always-allow
notes: |
  - ALWAYS use Grep instead of bash grep/rg
  - output_mode "files_with_matches" is fastest for broad searches
  - Combine with Glob for targeted searches
```

#### 4.3.3 Execution

**Bash**
```yaml
name: Bash
category: execution
description: Execute shell commands in a persistent bash session. State persists across calls.
params:
  - command: string (required) — shell command(s), use && or ; to chain
  - description: string (required) — 5–10 word explanation of what this does
  - timeout: int (optional, default: 120000) — ms, max 600000
permissions: varies (pattern-matched allow/deny rules)
notes: |
  - Session is persistent — env vars, cwd, aliases carry across calls
  - NEVER use cat/head/tail/grep/find — use Read/Grep/Glob instead
  - Output truncated at 30000 chars
  - Always explain non-trivial commands before running
```

**BashBg**
```yaml
name: BashBg
category: execution
description: Run a command in background. Retrieve output later without blocking.
params:
  - command: string (required)
  - description: string (required)
returns: job_id for later retrieval
notes: |
  - Use for long-running processes (dev servers, builds, tests)
  - Poll with: BashBg --status <job_id>
  - Retrieve output with: BashBg --output <job_id>
  - Do NOT use for 'sleep' — returns immediately
```

#### 4.3.4 Web Tools

**WebFetch**
```yaml
name: WebFetch
category: web
description: Fetch URL contents. Supports HTML, JSON, raw text. No auth-protected pages.
params:
  - url: string (required) — full URL with schema
  - max_tokens: int (optional) — truncate response
permissions: ask-once
```

**WebSearch**
```yaml
name: WebSearch
category: web
description: Search the web for current information beyond knowledge cutoff.
params:
  - query: string (required) — 1–6 words for best results
  - max_results: int (optional, default: 5)
permissions: ask-once
```

#### 4.3.5 Notebook Tools

**NotebookRead**
```yaml
name: NotebookR
category: notebook
description: Read Jupyter notebook cells (code + output).
params:
  - notebook_path: string (required)
  - cell_range: string (optional) — e.g. "1-5", "3"
permissions: always-allow
```

**NotebookEdit**
```yaml
name: NotebookE
category: notebook
description: Edit Jupyter notebook cells — replace, insert, or delete.
params:
  - notebook_path: string (required)
  - cell_index: int (required)
  - action: enum — "replace" | "insert_after" | "insert_before" | "delete"
  - content: string (required for replace/insert)
  - cell_type: enum (optional) — "code" | "markdown"
permissions: ask-once
```

#### 4.3.6 Task Management

**TodoRead**
```yaml
name: TodoRead
category: task-mgmt
description: Read the current structured task checklist.
params: none
permissions: always-allow
```

**TodoWrite**
```yaml
name: TodoWrite
category: task-mgmt
description: Create/update structured task lists for tracking multi-step work.
params:
  - todos: array of {content, status, activeForm} (required)
    - status: "pending" | "in_progress" | "completed"
    - activeForm: present-tense verb phrase for status display
permissions: always-allow
notes: |
  - Keep tasks in_progress if: tests failing, implementation partial, errors unresolved
  - Use to break down complex work before starting implementation
```

#### 4.3.7 Agent Orchestration

**Task**
```yaml
name: Task
category: orchestration
description: Launch a sub-agent for complex, multi-step work. Sub-agent gets its own tool access.
params:
  - description: string (required) — what the sub-agent should do
  - prompt: string (required) — detailed instructions
  - tools: array (optional) — subset of tools the sub-agent can use
  - model: string (optional) — "sonnet" (default) | "haiku" (cheap) | "opus" (powerful)
permissions: always-allow
notes: |
  - Sub-agents are autonomous — they search, read, edit independently
  - Use for: codebase exploration, parallel research, isolated refactors
  - Results returned as a summary; sub-agent context is discarded
  - Prefer haiku model for exploration to save cost
```

---

## 5. Async Context Memory Engine

### 5.1 Problem

Every new session, the agent re-discovers which files relate to which features. For a project like Kvanti (React/Vite/TypeScript/Supabase/Stripe with auth, group buying, payments, admin), this wastes 3–5 minutes and 10–15 tool calls per session.

### 5.2 Solution: Feature→File Graph

SATS maintains a persistent `.sats/memory.json` that maps **features** to **file paths**, **dependencies**, and **architectural notes**. This graph is built asynchronously and queried on-demand.

### 5.3 Memory Tools

**MemoryQ** (Query)
```yaml
name: MemoryQ
category: memory
description: Query the Feature→File context memory. Returns file paths, deps, and notes for a feature.
params:
  - query: string (required) — feature name, keyword, or natural language question
  - scope: enum (optional) — "frontend" | "backend" | "fullstack" | "infra" | "all"
  - depth: enum (optional) — "summary" | "detailed" | "files-only"
returns: |
  {
    feature: "authentication",
    summary: "JWT-based auth with Supabase, refresh token rotation, role-based access",
    frontend: {
      entry: "src/features/auth/AuthProvider.tsx",
      files: ["src/features/auth/LoginForm.tsx", "src/features/auth/hooks/useAuth.ts", ...],
      routes: ["/login", "/register", "/forgot-password"],
      state: "src/stores/authStore.ts"
    },
    backend: {
      entry: "supabase/functions/auth/index.ts",
      files: ["supabase/migrations/001_auth_tables.sql", ...],
      rls_policies: ["profiles_rls", "user_data_rls"],
      env_vars: ["SUPABASE_JWT_SECRET", "SUPABASE_ANON_KEY"]
    },
    dependencies: ["@supabase/supabase-js", "@supabase/auth-helpers-react"],
    related_features: ["user-profile", "admin-panel", "api-middleware"],
    last_indexed: "2026-03-09T14:30:00Z"
  }
permissions: always-allow
notes: |
  - Returns from .sats/memory.json — zero file system calls
  - If no memory exists yet, suggests running MemorySync
  - Query is fuzzy-matched: "auth", "login", "authentication" all match
```

**MemorySync** (Async Analysis)
```yaml
name: MemorySync
category: memory
description: Trigger async codebase/PRD analysis. Runs in background, updates memory.json.
params:
  - source: enum (required) — "codebase" | "prd" | "both"
  - prd_path: string (optional) — path to PRD file (required if source includes "prd")
  - incremental: boolean (optional, default: true) — only analyze changed files
  - force: boolean (optional, default: false) — full re-index
returns: job_id for status polling
permissions: always-allow
```

### 5.4 Memory Schema: `.sats/memory.json`

```jsonc
{
  "project": {
    "name": "kvanti",
    "type": "fullstack",
    "stack": ["react", "vite", "typescript", "supabase", "stripe"],
    "root": "/home/user/projects/kvanti"
  },
  "features": {
    "authentication": {
      "summary": "JWT-based auth with Supabase...",
      "status": "complete",
      "prd_section": "3.1",
      "frontend": {
        "entry": "src/features/auth/AuthProvider.tsx",
        "files": [...],
        "routes": ["/login", "/register"],
        "components": ["LoginForm", "RegisterForm", "AuthGuard"],
        "hooks": ["useAuth", "useSession"],
        "state": "src/stores/authStore.ts"
      },
      "backend": {
        "entry": "supabase/functions/auth/index.ts",
        "files": [...],
        "tables": ["profiles", "user_roles"],
        "rls_policies": [...],
        "edge_functions": ["auth-callback", "refresh-token"],
        "env_vars": ["SUPABASE_JWT_SECRET"]
      },
      "tests": {
        "unit": ["src/features/auth/__tests__/useAuth.test.ts"],
        "e2e": ["e2e/auth.spec.ts"]
      },
      "dependencies": ["@supabase/supabase-js"],
      "related_features": ["user-profile", "admin-panel"],
      "last_indexed": "2026-03-09T14:30:00Z"
    },
    "group-buying": { ... },
    "payments": { ... },
    "admin-panel": { ... }
  },
  "file_index": {
    "src/features/auth/AuthProvider.tsx": {
      "features": ["authentication"],
      "type": "component",
      "exports": ["AuthProvider", "useAuthContext"],
      "imports_from": ["@supabase/supabase-js", "../stores/authStore"],
      "last_modified": "2026-03-08T10:00:00Z"
    }
  },
  "metadata": {
    "version": "1.0",
    "last_full_sync": "2026-03-09T14:30:00Z",
    "last_incremental_sync": "2026-03-09T16:45:00Z",
    "total_features": 12,
    "total_files_indexed": 247
  }
}
```

### 5.5 Async Analysis Pipeline

When `MemorySync` is triggered, it runs as a background job:

```
MemorySync Pipeline (runs async, does NOT block agent):
─────────────────────────────────────────────────────────

Step 1: Source Detection
  ├─ If source="prd" → Parse PRD markdown/docx
  │   ├─ Extract feature headings (## Feature: ...)
  │   ├─ Extract requirements, tech notes, dependencies
  │   └─ Create feature stubs in memory.json
  │
  ├─ If source="codebase" → Scan project files
  │   ├─ Glob **/*.{ts,tsx,js,jsx,py,php,vue,svelte}
  │   ├─ Parse imports/exports per file
  │   ├─ Detect route definitions (React Router, Next.js, etc.)
  │   ├─ Detect DB schemas (migrations, Prisma, Supabase types)
  │   ├─ Detect test files and map to source files
  │   └─ Cluster files into features via directory structure + import graph
  │
  └─ If source="both" → Run PRD parse first, then match codebase to PRD features

Step 2: Feature Extraction
  ├─ Group files by feature directory (src/features/*, modules/*, etc.)
  ├─ For flat structures: cluster by import graph + naming conventions
  ├─ Cross-reference with PRD sections if available
  └─ Human-readable summary per feature via LLM (haiku model, cheap)

Step 3: Dependency Mapping
  ├─ Read package.json / requirements.txt / composer.json
  ├─ Map each dependency to the features that import it
  └─ Flag shared dependencies (used by 3+ features)

Step 4: Write memory.json
  ├─ Merge with existing memory (incremental mode)
  ├─ Preserve manual annotations
  └─ Timestamp all entries

Step 5: Notify
  └─ Agent sees: "MemorySync complete: 12 features, 247 files indexed"
```

### 5.6 Memory Freshness

| Trigger | Action |
|---|---|
| Agent starts session in project | Auto-check `last_incremental_sync` — if >1hr, run incremental |
| User saves files (git hook) | Queue incremental sync for changed files |
| User runs `MemorySync --force` | Full re-index |
| PRD file changes | Auto-re-parse PRD sections, re-map to codebase |

---

## 6. Plugin / Skill System

### 6.1 Design Philosophy

Plugins follow the **3-tier progressive disclosure** model from Anthropic's Agent Skills architecture:

```
Tier 0: Plugin Registry (always in context)
  → Name + one-line description per plugin (~30 tokens each)
  → Total: ~300 tokens for 10 plugins

Tier 1: SKILL.md (loaded when plugin is triggered)
  → Core instructions, quick-start examples
  → Target: <500 lines

Tier 2: Reference Files (loaded on-demand within skill execution)
  → API docs, detailed patterns, edge cases
  → Lives on filesystem, zero tokens until needed
```

### 6.2 Plugin Structure

```
~/.sats/plugins/
├── installed.json              # Registry of installed plugins
├── shopify-dev/
│   ├── SKILL.md                # Core skill (Tier 1)
│   ├── reference/
│   │   ├── liquid-syntax.md    # Tier 2 — loaded only if needed
│   │   ├── theme-api.md
│   │   └── storefront-api.md
│   └── scripts/
│       ├── theme-check.sh
│       └── deploy.sh
├── wordpress-dev/
│   ├── SKILL.md
│   ├── reference/
│   │   ├── hooks-filters.md
│   │   ├── rest-api.md
│   │   ├── woocommerce.md
│   │   └── elementor.md
│   └── scripts/
│       └── wp-cli-helpers.sh
├── proposal-writer/
│   ├── SKILL.md
│   ├── templates/
│   │   ├── fiverr-proposal.md
│   │   ├── upwork-proposal.md
│   │   └── invoice-template.md
│   └── reference/
│       └── sorobindu-brand.md
└── prd-analyzer/
    ├── SKILL.md
    └── scripts/
        └── extract-features.py
```

### 6.3 Plugin Manifest: `installed.json`

```jsonc
{
  "plugins": [
    {
      "id": "shopify-dev",
      "name": "Shopify Development",
      "description": "Liquid templating, Dawn theme, Storefront API, theme deployment. Use when working on Shopify stores.",
      "version": "1.2.0",
      "source": "sorobindu/sats-plugins",
      "installed_at": "2026-03-01",
      "allowed_tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep"],
      "model_preference": "sonnet",
      "active": true
    },
    {
      "id": "wordpress-dev",
      "name": "WordPress & WooCommerce Development",
      "description": "Theme/plugin dev, hooks/filters, REST API, WooCommerce, Elementor, ACF. Use when working on WordPress projects.",
      "version": "2.0.0",
      "source": "sorobindu/sats-plugins",
      "allowed_tools": ["Read", "Write", "Edit", "Bash", "Glob", "Grep", "WebFetch"],
      "active": true
    }
  ]
}
```

### 6.4 Plugin Lifecycle

```
Installation:
  sats plugin install <source>
  → Downloads to ~/.sats/plugins/<id>/
  → Validates SKILL.md frontmatter
  → Adds entry to installed.json
  → Plugin description injected into Tier 0 at next session

Activation (per-session):
  1. Session starts → load installed.json
  2. Inject one-line descriptions into Tier 0 context (~30 tokens each)
  3. User says "help me fix the Shopify theme"
  4. Agent matches intent → "shopify-dev" plugin
  5. Agent reads ~/.sats/plugins/shopify-dev/SKILL.md (Tier 1, ~400 tokens)
  6. Agent follows SKILL.md instructions, reads reference/ files only as needed (Tier 2)

Deactivation:
  sats plugin disable <id>
  → Sets active: false
  → Plugin description removed from Tier 0
  → Zero token cost until re-enabled

Uninstallation:
  sats plugin uninstall <id>
  → Removes directory and registry entry
```

### 6.5 Plugin Authoring Spec

A valid SATS plugin requires:

```markdown
---
name: my-plugin
description: >
  One paragraph. What it does and when to use it.
  This text goes into Tier 0, so keep it under 50 words.
allowed-tools: Read, Write, Edit, Bash, Glob, Grep
model: sonnet
version: 1.0.0
author: sorobindu
---

# My Plugin

## Quick Start
[Core instructions here — this is Tier 1, loaded when triggered]

## Reference Files
For detailed API docs, read `reference/api-docs.md`.
For code patterns, read `reference/patterns.md`.
[These are Tier 2 — agent reads only if needed]
```

**Rules:**
- `SKILL.md` body MUST be under 500 lines
- `description` in frontmatter MUST be under 50 words
- `allowed-tools` MUST be minimal (only what the plugin actually needs)
- Reference files in `reference/` are unlimited in size (they live on disk, not in context)
- Scripts in `scripts/` are executed via Bash, never loaded into context

---

## 7. CLI Interface

### 7.1 Commands

```bash
# Core
sats init                          # Initialize .sats/ in current project
sats status                        # Show memory stats, active plugins, sync status

# Memory
sats memory sync                   # Incremental codebase sync
sats memory sync --force           # Full re-index
sats memory sync --prd ./PRD.md    # Analyze PRD and map to codebase
sats memory query "auth"           # Query feature memory from terminal
sats memory query "auth" --scope frontend --depth files-only
sats memory export                 # Export memory.json as readable markdown

# Plugins
sats plugin list                   # Show installed plugins
sats plugin install <source>       # Install from git URL, local path, or registry
sats plugin uninstall <id>         # Remove plugin
sats plugin enable <id>            # Activate plugin
sats plugin disable <id>           # Deactivate (zero token cost)
sats plugin create <name>          # Scaffold a new plugin with SKILL.md template
sats plugin validate <path>        # Validate plugin structure and token budget

# Tools
sats tools list                    # Show all available tools (core + plugin)
sats tools help <tool>             # Show full tool spec (Tier 1)
sats tools help <tool> --verbose   # Show extended docs (Tier 3)
```

### 7.2 Project Config: `.sats/config.json`

```jsonc
{
  "project_name": "kvanti",
  "stack": ["react", "vite", "typescript", "supabase", "stripe"],
  "structure": {
    "frontend_root": "src/",
    "backend_root": "supabase/",
    "test_root": "src/__tests__/",
    "e2e_root": "e2e/"
  },
  "memory": {
    "auto_sync": true,
    "sync_interval_minutes": 60,
    "sync_on_git_commit": true,
    "llm_summaries": true,
    "summary_model": "haiku"
  },
  "plugins": {
    "active": ["wordpress-dev", "proposal-writer"],
    "disabled": ["shopify-dev"]
  },
  "permissions": {
    "always_allow": ["Read", "LS", "Glob", "Grep", "TodoRead", "TodoWrite", "MemoryQ"],
    "ask_once": ["Write", "Edit", "MultiEdit", "Bash", "WebFetch", "WebSearch"],
    "deny": ["Bash(rm -rf *)", "Bash(sudo *)"]
  }
}
```

---

## 8. Context Budget Analysis

### 8.1 Token Budget Breakdown (Session Start)

| Component | Tokens | Notes |
|---|---|---|
| System prompt (base) | ~4,000 | Agent personality, rules, safety |
| Tool Registry (Tier 0) | ~800 | 18 tools × ~44 tokens each |
| Plugin Registry (Tier 0) | ~300 | 10 plugins × ~30 tokens each |
| Memory Summary (auto) | ~200 | Project name, stack, feature count |
| CLAUDE.md | ~500 | Project-specific instructions |
| **Total at session start** | **~5,800** | **Leaves ~194K tokens for work** |

### 8.2 Comparison with MCP Approach

| Approach | Session Start Tokens | After 3 Tools Used |
|---|---|---|
| **MCP (all tools loaded)** | ~15,000–25,000 | Same (already loaded) |
| **SATS (progressive)** | ~5,800 | ~7,500 (+3 tool helps) |

SATS saves **60–75% context at session start** and loads incrementally.

---

## 9. Example Workflows

### 9.1 New Project Onboarding

```
User: "I just cloned the kvanti project. Help me understand the codebase."

Agent:
1. sats init                                    # Creates .sats/
2. MemorySync --source codebase --force          # Full index (background)
3. While sync runs, agent uses LS + Glob to give immediate overview
4. Sync completes: "12 features, 247 files indexed"
5. MemoryQ "overview" --depth summary            # Returns feature list
6. Agent presents structured project overview
```

### 9.2 PRD-Driven Development

```
User: "Here's the PRD for the new referral system feature. Analyze it
       and tell me which existing files I'll need to modify."

Agent:
1. MemorySync --source prd --prd_path ./PRD-referral.md
   → Background: parses PRD, extracts features, maps to codebase
2. MemoryQ "referral" --scope fullstack --depth detailed
   → Returns:
     - New files to create (suggested paths based on project conventions)
     - Existing files to modify (auth, user-profile, payments)
     - Database changes needed
     - Dependencies to add
3. TodoWrite: structured implementation plan
```

### 9.3 Multi-Project Context Switch

```
User: "Switch to the Seha Care project."

Agent:
1. cd ~/projects/seha-care
2. Reads .sats/config.json → project context loaded
3. MemoryQ "overview" → instant feature summary (from cached memory.json)
4. Agent knows: Next.js + NestJS + Arabic voice + AWS Riyadh
5. No re-discovery needed — full context in ~200 tokens
```

---

## 10. Security & Permissions

### 10.1 Permission Model

```
Three-tier permission evaluation (in order):

1. DENY rules    — checked first, blocks matching tools/commands
2. ALLOW rules   — auto-approved without user prompt
3. ASK rules     — requires user confirmation (once per session or per-use)
```

### 10.2 Plugin Sandboxing

- Plugins declare `allowed-tools` in frontmatter — they CANNOT access tools outside this list
- Plugin scripts run in a restricted Bash context (no `sudo`, no `rm -rf`, no network by default)
- Plugin reference files are read-only — agent cannot modify them
- Memory writes from plugins are tagged with the plugin ID for auditability

### 10.3 Memory Privacy

- `.sats/memory.json` is local-only — never transmitted outside the project
- Memory queries return only file paths and summaries — never file contents
- `sats memory export` produces a sanitized markdown (no env vars, no secrets)

---

## 11. Implementation Roadmap

### Phase 1: Core Tools + Memory (4 weeks)

- Implement 16 core tools (file, search, execution, web, notebook, task mgmt)
- Build MemorySync pipeline (codebase scanning only)
- Build MemoryQ query interface
- Create `.sats/` project config system
- CLI: `sats init`, `sats memory sync`, `sats memory query`

### Phase 2: PRD Analysis + Async Engine (3 weeks)

- PRD markdown/docx parser
- Feature extraction from PRD headings and requirements
- PRD→codebase mapping via file naming + import graph
- Background job system for non-blocking sync
- Git hook integration for auto-sync on commit

### Phase 3: Plugin System (3 weeks)

- Plugin manifest spec and validation
- `sats plugin install/uninstall/enable/disable` commands
- Progressive disclosure Tier 0→1→2 loading
- Plugin scaffolding: `sats plugin create`
- First-party plugins: `wordpress-dev`, `shopify-dev`, `proposal-writer`

### Phase 4: Intelligence Layer (2 weeks)

- LLM-powered feature summaries (haiku model for cost efficiency)
- Smart feature clustering for flat project structures
- Cross-feature dependency warnings ("changing auth affects 4 other features")
- Memory diff: "Since last session, 3 files changed in the payments feature"

---

## 12. Success Metrics

| Metric | Current (No SATS) | Target (With SATS) |
|---|---|---|
| Session start context tokens | ~15,000–25,000 | ~5,800 |
| Time to first useful action | 2–5 minutes | <30 seconds |
| Tool calls for feature discovery | 10–15 per session | 1 (MemoryQ) |
| Context switch overhead | 5–10 minutes | <15 seconds |
| Plugin token overhead (idle) | ~2,000+ per MCP | ~30 per plugin |

---

## 13. Open Questions

1. **Memory format**: JSON vs SQLite for `.sats/memory.json` — JSON is human-readable and git-friendly; SQLite scales better for large projects (1000+ files).

2. **LLM dependency**: Should feature summaries require an LLM call, or can we generate useful summaries from static analysis alone? Hybrid approach recommended — static for structure, LLM (haiku) for natural language summaries.

3. **Plugin distribution**: Local-first vs. registry? Start local (`git clone` + `sats plugin install ./path`), add registry in v2.

4. **Team sharing**: Should `.sats/memory.json` be committed to the repo? Recommended: commit `config.json` and `features/` stubs, gitignore the full `memory.json` (it can be regenerated).

5. **MCP interop**: Should SATS plugins be able to wrap existing MCP servers in the CLI `--help` pattern? This would provide progressive disclosure for the existing MCP ecosystem.

---

## 14. References

- [Anthropic — Equipping Agents with Skills (Progressive Disclosure)](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills)
- [Anthropic — Skill Authoring Best Practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
- [Claude Code Router — Progressive Disclosure Blog](https://github.com/musistudio/claude-code-router/blob/main/blog/en/progressive-disclosure-of-agent-tools-from-the-perspective-of-cli-tool-style.md)
- [Claude Code Built-in Tools Reference](https://gist.github.com/wong2/e0f34aac66caf890a332f7b6f9e2ba8f)
- [HumanLayer — Writing a Good CLAUDE.md](https://www.humanlayer.dev/blog/writing-a-good-claude-md)
- [MCPJam — Progressive Disclosure vs MCP](https://www.mcpjam.com/blog/claude-agent-skills)

---

*SoroBindu OPC · Your Success, Our Mission · info@sorobindu.com*
