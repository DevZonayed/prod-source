# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Adorable is an AI-powered app builder where users describe projects in natural language and the AI generates, edits, and runs full-stack code in sandboxed VMs. It features live preview, terminal access, and one-click deployment.

## Repository Structure

This is a **npm workspace monorepo**. The root `package.json` delegates all commands to the `adorable/` subdirectory, which contains the actual Next.js application.

```
prod-source/
├── adorable/          # Main Next.js 16 app (App Router, TypeScript, Turbopack)
│   ├── app/           # Routes, layouts, API endpoints
│   ├── components/    # UI (shadcn/ui "new-york" style) and assistant-ui components
│   ├── lib/           # Core logic, LLM provider, tools, BuildForge engine
│   └── hooks/         # React hooks
├── .agents/skills/    # AI knowledge modules (Next.js, TypeScript, UI/UX, etc.)
└── .github/workflows/ # CI/CD (deploy on push to main)
```

## Common Commands

All commands run from the repo root and delegate to the `adorable` workspace:

```bash
npm run dev          # Start dev server with Turbopack
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
```

From within `adorable/`:
```bash
npx prettier --check .    # Check formatting
npx prettier --write .    # Fix formatting
```

## Key Architecture

### Chat & Tool Execution Flow

`app/api/chat/route.ts` is the main endpoint. It receives messages + repoId, loads repo metadata, assembles tools (base + BuildForge), and streams LLM responses via Vercel AI SDK (`ai` package). The client-side assistant is in `app/assistant.tsx`.

### LLM Provider System (`lib/llm-provider.ts`)

Supports OpenAI (default, `gpt-5.2-codex`), Anthropic (Claude), and Claude Code (OAuth). Selected via `LLM_PROVIDER` env var.

### BuildForge Engine (`lib/buildforge/`)

The AI code generation subsystem with:
- **3-level memory**: Level 1 (hardcoded app patterns for 8 archetypes like ecommerce, SaaS, CRM), Level 2 (per-project memory files), Level 3 (context assembly with token budgeting)
- **Spec engine** (`spec/`): Parses natural language into structured app specifications, validates against patterns
- **Thinker** (`thinker/`): Decomposes features into ordered tasks, generates execution plans, handles self-correction
- **Tools** (`tools/`): 11 tool categories (memory-context, spec-engine, frontend-gen, backend-gen, design-system, testing-qa, devops, thinker, repo-analysis, project-init, base). Registry in `tools/registry.ts` filters tools by phase.
- **Types & constants**: `types.ts` and `constants.ts` define Entity, Screen, ApiEndpoint, Task, ExecutionPlan, PatternId, token budgets, and phase mappings

### Freestyle VM Integration (`lib/adorable-vm.ts`)

Each project gets a sandboxed VM via `freestyle-sandboxes` SDK. VMs provide: dev server (port 3000), PTY for bash, web terminal (ttyd on ports 3010/3020), and git-backed persistence. VM config and identity management in `lib/identity-session.ts`.

### Repo & Conversation Storage (`lib/repo-storage.ts`)

Git-backed metadata storage. Types in `lib/repo-types.ts`. React contexts in `lib/repos-context.tsx` and `lib/project-conversations-context.tsx`.

### System Prompt (`lib/system-prompt.ts`)

Dynamic system prompt generation for the AI assistant, incorporating BuildForge capabilities.

### Base Tools (`lib/create-tools.ts`)

Factory for fundamental tools: bash execution, file operations, dev server management.

## Tech Stack

- **Framework**: Next.js 16 (App Router, standalone output)
- **AI**: Vercel AI SDK (`ai`, `@ai-sdk/openai`, `@ai-sdk/anthropic`), assistant-ui
- **State**: Zustand
- **Styling**: Tailwind CSS 4, shadcn/ui (new-york style, zinc base, lucide icons)
- **Sandboxing**: freestyle-sandboxes
- **Node**: 22 (per CI config)

## Path Aliases

`@/*` maps to the `adorable/` root directory (configured in `tsconfig.json`).

## Deployment

Production deploys automatically on push to `main` via GitHub Actions. Uses `freestyle-sh deploy` targeting `adorable-demo.style.dev`. Requires `FREESTYLE_API_KEY` secret.

## Environment Variables

- `FREESTYLE_API_KEY` — Required for Freestyle sandbox VM service
- `LLM_PROVIDER` — Optional, selects AI provider (openai/anthropic/claude-code)
- Provider-specific API keys as needed (OpenAI, Anthropic)
