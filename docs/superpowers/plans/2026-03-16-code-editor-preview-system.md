# Code Editor + Preview System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Monaco code editor with file explorer, fix the preview startup to be instant via pre-built templates, and sync AI file operations to the editor in real-time.

**Architecture:** Chat (left) | Code↔Preview toggle + Terminal (right). Monaco editor with persistent file tree sidebar. Pre-built Next.js template in Docker image for instant preview. Custom events bridge AI tool calls to editor updates.

**Tech Stack:** Monaco Editor (`@monaco-editor/react`), Next.js 16, React 19, Docker, custom events, Vercel AI SDK

**Spec:** `docs/superpowers/specs/2026-03-16-code-editor-preview-system-design.md`

---

## Chunk 1: Foundation — Docker Template + Preview Fix

### Task 1: Create Next.js template directory for Docker image

**Files:**
- Create: `adorable/docker/template/package.json`
- Create: `adorable/docker/template/next.config.ts`
- Create: `adorable/docker/template/tsconfig.json`
- Create: `adorable/docker/template/tailwind.config.ts`
- Create: `adorable/docker/template/postcss.config.mjs`
- Create: `adorable/docker/template/app/layout.tsx`
- Create: `adorable/docker/template/app/page.tsx`
- Create: `adorable/docker/template/app/globals.css`

These are the starter files that get baked into the Docker image. When a new project is created, these files are copied to `/workspace/` so the dev server can start immediately without `npm install`.

- [ ] **Step 1: Create template package.json**

```json
{
  "name": "voxel-project",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev --turbopack --port 3000",
    "build": "next build",
    "start": "next start"
  },
  "dependencies": {
    "next": "15.3.3",
    "react": "19.1.0",
    "react-dom": "19.1.0",
    "tailwindcss": "4.1.8",
    "@tailwindcss/postcss": "4.1.8"
  },
  "devDependencies": {
    "@types/node": "22.15.21",
    "@types/react": "19.1.4",
    "@types/react-dom": "19.1.5",
    "typescript": "5.8.3"
  }
}
```

- [ ] **Step 2: Create template next.config.ts**

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {};

export default nextConfig;
```

- [ ] **Step 3: Create template tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create template tailwind.config.ts and postcss.config.mjs**

`tailwind.config.ts`:
```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
};

export default config;
```

`postcss.config.mjs`:
```javascript
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
```

- [ ] **Step 5: Create template app files (layout.tsx, page.tsx, globals.css)**

`app/globals.css`:
```css
@import "tailwindcss";
```

`app/layout.tsx`:
```tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Voxel App",
  description: "Built with Voxel",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`app/page.tsx`:
```tsx
export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-white">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Welcome to Voxel</h1>
        <p className="text-zinc-400">Your AI is generating your app...</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Commit**

```bash
git add adorable/docker/template/
git commit -m "feat: add Next.js template for instant preview"
```

---

### Task 2: Update Dockerfile to bake template with node_modules

**Files:**
- Modify: `adorable/docker/Dockerfile.sandbox`

- [ ] **Step 1: Add template copy and npm install to Dockerfile**

Add after the existing `RUN apt-get` line (line 3) and before `LABEL` (line 10):

```dockerfile
# Pre-built Next.js template with node_modules
COPY template/ /template/
RUN cd /template && npm install --prefer-offline && rm -rf /tmp/* /root/.npm
```

The full Dockerfile becomes:
```dockerfile
FROM node:22-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl python3 make g++ && rm -rf /var/lib/apt/lists/*

# Pre-built Next.js template with node_modules
COPY template/ /template/
RUN cd /template && npm install --prefer-offline && rm -rf /tmp/* /root/.npm

RUN git config --global user.name "Voxel" && \
    git config --global user.email "voxel@local" && \
    git config --global init.defaultBranch main

LABEL voxel.image.version="3"
WORKDIR /workspace
CMD ["tail", "-f", "/dev/null"]
```

Note: Bump image version from `"2"` to `"3"` to force rebuild.

- [ ] **Step 2: Update EXPECTED_IMAGE_VERSION in docker-manager.ts**

In `adorable/lib/docker-manager.ts` line 8, change:
```typescript
const EXPECTED_IMAGE_VERSION = "3";
```

- [ ] **Step 3: Commit**

```bash
git add adorable/docker/Dockerfile.sandbox adorable/lib/docker-manager.ts
git commit -m "feat: bake Next.js template into sandbox Docker image"
```

---

### Task 3: Copy template to /workspace on new container start

**Files:**
- Modify: `adorable/lib/docker-manager.ts` (lines 92-139: `createProjectContainer`)

- [ ] **Step 1: Add template scaffolding after container.start()**

After `await container.start()` (line 133 in `createProjectContainer`), add template copy logic. Insert before the return statement:

```typescript
// Scaffold template if workspace is empty (new project)
try {
  const checkExec = await container.exec({
    Cmd: ["test", "-f", "/workspace/package.json"],
    AttachStdout: true,
    AttachStderr: true,
  });
  const checkStream = await checkExec.start({});
  const exitCode = await new Promise<number>((resolve) => {
    checkStream.on("end", async () => {
      const info = await checkExec.inspect();
      resolve(info.ExitCode ?? 1);
    });
    checkStream.resume();
  });

  if (exitCode !== 0) {
    // No package.json — scaffold from template
    const scaffoldExec = await container.exec({
      Cmd: [
        "bash",
        "-c",
        "cp -a /template/. /workspace/ && rm -rf /workspace/node_modules && ln -s /template/node_modules /workspace/node_modules",
      ],
      AttachStdout: true,
      AttachStderr: true,
    });
    const scaffoldStream = await scaffoldExec.start({});
    await new Promise<void>((resolve) => {
      scaffoldStream.on("end", resolve);
      scaffoldStream.resume();
    });
  }
} catch (e) {
  console.error("Template scaffolding failed:", e);
  // Non-fatal — container still works, just no template
}
```

- [ ] **Step 2: Commit**

```bash
git add adorable/lib/docker-manager.ts
git commit -m "feat: scaffold Next.js template on new container start"
```

---

### Task 4: Add PreviewLoadingOverlay component

**Files:**
- Create: `adorable/components/code-editor/preview-loading-overlay.tsx`
- Modify: `adorable/app/[repoId]/repo-workspace-shell.tsx` (AppPreview component, lines 537-749)

- [ ] **Step 1: Create the loading overlay component**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PreviewLoadingOverlayProps {
  containerLoading: boolean;
  devServerLoading: boolean;
  visible: boolean;
}

export function PreviewLoadingOverlay({
  containerLoading,
  devServerLoading,
  visible,
}: PreviewLoadingOverlayProps) {
  const message = containerLoading
    ? "Preparing environment..."
    : devServerLoading
      ? "Starting dev server..."
      : "Almost ready...";

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950 transition-opacity duration-500",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-white">{message}</p>
      <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full bg-blue-500 transition-all duration-1000",
            containerLoading ? "w-1/3" : devServerLoading ? "w-2/3" : "w-full",
          )}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Replace the current loading spinner in AppPreview**

In `repo-workspace-shell.tsx`, the current loading logic is at lines 608-627 (the div with "Preparing environment..." / "Starting dev server..." text and the spinning loader). Replace that entire loading overlay section with the new `PreviewLoadingOverlay` component.

Import at top:
```typescript
import { PreviewLoadingOverlay } from "@/components/code-editor/preview-loading-overlay";
```

Replace the existing loading overlay (lines 608-627) with:
```tsx
<PreviewLoadingOverlay
  containerLoading={containerLoading}
  devServerLoading={devServerLoading || !effectivePreviewUrl}
  visible={!iframeLoaded}
/>
```

This renders the overlay on top of the iframe area. The iframe is always rendered (when URL is available) but hidden behind the overlay until it loads. The key change: **never show the iframe until `effectivePreviewUrl` is set**, so "refused to connect" never appears.

- [ ] **Step 3: Commit**

```bash
git add adorable/components/code-editor/preview-loading-overlay.tsx adorable/app/[repoId]/repo-workspace-shell.tsx
git commit -m "feat: smart loading overlay replaces 'refused to connect'"
```

---

## Chunk 2: Files API + File System Hook

### Task 5: Create /api/files endpoint

**Files:**
- Create: `adorable/app/api/files/route.ts`

This endpoint provides file CRUD operations on the container filesystem, used by the code editor.

- [ ] **Step 1: Create the files API route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getContainerForProject } from "@/lib/docker-manager";

function sanitizePath(filePath: string): string | null {
  // Normalize and reject path traversal
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("..") || !normalized.startsWith("/workspace")) {
    return null;
  }
  return normalized;
}

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".cache",
  "__pycache__",
]);

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const dirPath = req.nextUrl.searchParams.get("path");
  const filePath = req.nextUrl.searchParams.get("file");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const container = await getContainerForProject(projectId);
  if (!container) {
    return NextResponse.json(
      { error: "Container not found" },
      { status: 404 },
    );
  }

  // Read file content
  if (filePath) {
    const safe = sanitizePath(filePath);
    if (!safe) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    try {
      const exec = await container.exec({
        Cmd: ["cat", safe],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({});
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", resolve);
      });
      const content = Buffer.concat(chunks).toString("utf-8");
      // Strip Docker multiplexing header bytes if present
      const cleaned = stripDockerHeaders(content);
      return NextResponse.json({ content: cleaned });
    } catch {
      return NextResponse.json(
        { error: "Failed to read file" },
        { status: 500 },
      );
    }
  }

  // List directory
  if (dirPath) {
    const safe = sanitizePath(dirPath);
    if (!safe) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    try {
      const exec = await container.exec({
        Cmd: [
          "bash",
          "-c",
          `find ${safe} -maxdepth 1 -mindepth 1 -printf '%y %p\\n' 2>/dev/null | sort`,
        ],
        AttachStdout: true,
        AttachStderr: true,
      });
      const stream = await exec.start({});
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve) => {
        stream.on("data", (chunk: Buffer) => chunks.push(chunk));
        stream.on("end", resolve);
      });
      const output = stripDockerHeaders(
        Buffer.concat(chunks).toString("utf-8"),
      );
      const entries = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const type = line.charAt(0) === "d" ? "directory" : "file";
          const fullPath = line.substring(2);
          const name = fullPath.split("/").pop() || "";
          return { name, path: fullPath, type };
        })
        .filter((e) => !EXCLUDED_DIRS.has(e.name));

      return NextResponse.json({ entries });
    } catch {
      return NextResponse.json(
        { error: "Failed to list directory" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Provide path or file parameter" },
    { status: 400 },
  );
}

export async function PUT(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const filePath = req.nextUrl.searchParams.get("file");

  if (!projectId || !filePath) {
    return NextResponse.json(
      { error: "projectId and file required" },
      { status: 400 },
    );
  }

  const safe = sanitizePath(filePath);
  if (!safe) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const body = await req.json();
  const { content } = body;

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "content must be a string" },
      { status: 400 },
    );
  }

  const container = await getContainerForProject(projectId);
  if (!container) {
    return NextResponse.json(
      { error: "Container not found" },
      { status: 404 },
    );
  }

  try {
    // Use bash heredoc to write file content safely
    const escaped = content.replace(/'/g, "'\\''");
    const exec = await container.exec({
      Cmd: ["bash", "-c", `cat > ${safe} << 'VOXEL_EOF'\n${escaped}\nVOXEL_EOF`],
      AttachStdout: true,
      AttachStderr: true,
    });
    const stream = await exec.start({});
    await new Promise<void>((resolve) => {
      stream.on("end", resolve);
      stream.resume();
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to write file" },
      { status: 500 },
    );
  }
}

/**
 * Strip Docker stream multiplexing headers from exec output.
 * Docker prefixes each frame with an 8-byte header when AttachStdout is used.
 */
function stripDockerHeaders(raw: string): string {
  // If the output starts with a recognizable text character, it's likely clean
  if (raw.length === 0) return raw;
  const firstByte = raw.charCodeAt(0);
  // Docker headers start with 0x01 (stdout) or 0x02 (stderr)
  if (firstByte !== 1 && firstByte !== 2) return raw;

  let result = "";
  let offset = 0;
  const buf = Buffer.from(raw, "binary");
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const size = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + size > buf.length) {
      result += buf.subarray(offset).toString("utf-8");
      break;
    }
    result += buf.subarray(offset, offset + size).toString("utf-8");
    offset += size;
  }
  return result;
}
```

- [ ] **Step 2: Add getContainerForProject helper to docker-manager.ts**

In `adorable/lib/docker-manager.ts`, add this exported function (after `getOrCreateContainer`):

```typescript
export async function getContainerForProject(
  projectId: string,
): Promise<Docker.Container | null> {
  const name = `voxel-${projectId.slice(0, 12)}`;
  try {
    const containers = await docker.listContainers({
      all: false,
      filters: { name: [name] },
    });
    if (containers.length === 0) return null;
    return docker.getContainer(containers[0].Id);
  } catch {
    return null;
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add adorable/app/api/files/route.ts adorable/lib/docker-manager.ts
git commit -m "feat: add /api/files endpoint for container filesystem access"
```

---

### Task 6: Create useFileSystem hook

**Files:**
- Create: `adorable/hooks/use-file-system.ts`

- [ ] **Step 1: Create the hook**

```typescript
"use client";

import { useState, useCallback } from "react";

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
  expanded?: boolean;
}

export function useFileSystem(projectId: string | null) {
  const [tree, setTree] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const listDirectory = useCallback(
    async (dirPath: string): Promise<FileEntry[]> => {
      if (!projectId) return [];
      try {
        const res = await fetch(
          `/api/files?projectId=${projectId}&path=${encodeURIComponent(dirPath)}`,
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.entries || []).map((e: FileEntry) => ({
          ...e,
          children: e.type === "directory" ? undefined : undefined,
          expanded: false,
        }));
      } catch {
        return [];
      }
    },
    [projectId],
  );

  const loadRoot = useCallback(async () => {
    setLoading(true);
    const entries = await listDirectory("/workspace");
    setTree(entries);
    setLoading(false);
  }, [listDirectory]);

  const toggleDirectory = useCallback(
    async (dirPath: string) => {
      const toggle = async (entries: FileEntry[]): Promise<FileEntry[]> => {
        const result: FileEntry[] = [];
        for (const entry of entries) {
          if (entry.path === dirPath && entry.type === "directory") {
            if (entry.expanded) {
              result.push({ ...entry, expanded: false, children: undefined });
            } else {
              const children = await listDirectory(dirPath);
              result.push({ ...entry, expanded: true, children });
            }
          } else if (entry.children) {
            result.push({
              ...entry,
              children: await toggle(entry.children),
            });
          } else {
            result.push(entry);
          }
        }
        return result;
      };
      setTree((prev) => {
        toggle(prev).then(setTree);
        return prev;
      });
    },
    [listDirectory],
  );

  const readFile = useCallback(
    async (filePath: string): Promise<string | null> => {
      if (!projectId) return null;
      try {
        const res = await fetch(
          `/api/files?projectId=${projectId}&file=${encodeURIComponent(filePath)}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.content ?? null;
      } catch {
        return null;
      }
    },
    [projectId],
  );

  const writeFile = useCallback(
    async (filePath: string, content: string): Promise<boolean> => {
      if (!projectId) return false;
      try {
        const res = await fetch(
          `/api/files?projectId=${projectId}&file=${encodeURIComponent(filePath)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          },
        );
        return res.ok;
      } catch {
        return false;
      }
    },
    [projectId],
  );

  return { tree, loading, loadRoot, toggleDirectory, readFile, writeFile };
}
```

- [ ] **Step 2: Commit**

```bash
git add adorable/hooks/use-file-system.ts
git commit -m "feat: add useFileSystem hook for container file operations"
```

---

## Chunk 3: Monaco Editor Components

### Task 7: Install Monaco Editor dependency

**Files:**
- Modify: `adorable/package.json`

- [ ] **Step 1: Install @monaco-editor/react**

```bash
cd adorable && npm install @monaco-editor/react
```

- [ ] **Step 2: Commit**

```bash
git add adorable/package.json adorable/package-lock.json
git commit -m "feat: add @monaco-editor/react dependency"
```

---

### Task 8: Create EditorTabs component

**Files:**
- Create: `adorable/components/code-editor/editor-tabs.tsx`

- [ ] **Step 1: Create the tab bar component**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface EditorTab {
  path: string;
  name: string;
  modified: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({
  tabs,
  activeTab,
  onSelect,
  onClose,
}: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex overflow-x-auto bg-[#252526]">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={cn(
            "group flex shrink-0 items-center gap-1.5 border-t-2 px-3 py-1.5 text-xs",
            tab.path === activeTab
              ? "border-blue-500 bg-[#1e1e1e] text-white"
              : "border-transparent bg-[#2d2d2d] text-zinc-400 hover:bg-[#2a2a2a]",
          )}
          onClick={() => onSelect(tab.path)}
        >
          <span>{tab.name}</span>
          {tab.modified && (
            <span className="text-amber-400 group-hover:hidden">●</span>
          )}
          <span
            role="button"
            className={cn(
              "rounded p-0.5 hover:bg-zinc-600",
              tab.modified ? "hidden group-hover:inline-flex" : "",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.path);
            }}
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add adorable/components/code-editor/editor-tabs.tsx
git commit -m "feat: add EditorTabs component"
```

---

### Task 9: Create FileExplorer component

**Files:**
- Create: `adorable/components/code-editor/file-explorer.tsx`

- [ ] **Step 1: Create the file tree sidebar**

```tsx
"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  FileCode,
  FileJson,
  FileType,
  Palette,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
} from "lucide-react";
import type { FileEntry } from "@/hooks/use-file-system";

interface FileExplorerProps {
  tree: FileEntry[];
  loading: boolean;
  onLoadRoot: () => void;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  activeFile: string | null;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
    case "jsx":
    case "js":
      return <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
    case "json":
      return <FileJson className="h-3.5 w-3.5 shrink-0 text-yellow-400" />;
    case "css":
    case "scss":
      return <Palette className="h-3.5 w-3.5 shrink-0 text-purple-400" />;
    case "md":
    case "mdx":
      return <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />;
    default:
      return <FileType className="h-3.5 w-3.5 shrink-0 text-zinc-500" />;
  }
}

function FileTreeNode({
  entry,
  depth,
  onToggleDir,
  onOpenFile,
  activeFile,
}: {
  entry: FileEntry;
  depth: number;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  activeFile: string | null;
}) {
  const isDir = entry.type === "directory";
  const isActive = entry.path === activeFile;

  return (
    <>
      <button
        className={cn(
          "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-zinc-700/50",
          isActive && "bg-blue-600/30 text-white",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (isDir) {
            onToggleDir(entry.path);
          } else {
            onOpenFile(entry.path);
          }
        }}
      >
        {isDir ? (
          entry.expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-zinc-400" />
          )
        ) : (
          <span className="w-3" />
        )}
        {isDir ? (
          entry.expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          )
        ) : (
          getFileIcon(entry.name)
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {isDir && entry.expanded && entry.children && (
        <>
          {entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              activeFile={activeFile}
            />
          ))}
        </>
      )}
    </>
  );
}

export function FileExplorer({
  tree,
  loading,
  onLoadRoot,
  onToggleDir,
  onOpenFile,
  activeFile,
}: FileExplorerProps) {
  useEffect(() => {
    onLoadRoot();
  }, [onLoadRoot]);

  return (
    <div className="flex h-full w-44 shrink-0 flex-col border-r border-zinc-700 bg-[#252526]">
      <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
        Explorer
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        {loading ? (
          <div className="px-2 py-4 text-xs text-zinc-500">Loading...</div>
        ) : tree.length === 0 ? (
          <div className="px-2 py-4 text-xs text-zinc-500">No files</div>
        ) : (
          tree.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              activeFile={activeFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add adorable/components/code-editor/file-explorer.tsx
git commit -m "feat: add FileExplorer tree component"
```

---

### Task 10: Create CodeEditor component (Monaco wrapper)

**Files:**
- Create: `adorable/components/code-editor/code-editor.tsx`

This is the main code editor component that composes FileExplorer, EditorTabs, and Monaco.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFileSystem } from "@/hooks/use-file-system";
import { FileExplorer } from "./file-explorer";
import { EditorTabs, type EditorTab } from "./editor-tabs";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-sm text-zinc-500">
      Loading editor...
    </div>
  ),
});

function getLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    default:
      return "plaintext";
  }
}

interface CodeEditorProps {
  projectId: string;
}

export function CodeEditor({ projectId }: CodeEditorProps) {
  const { tree, loading, loadRoot, toggleDirectory, readFile, writeFile } =
    useFileSystem(projectId);

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(
    new Map(),
  );
  const [modifiedFiles, setModifiedFiles] = useState<Set<string>>(new Set());
  const saveTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const openFile = useCallback(
    async (filePath: string) => {
      // Add tab if not already open
      if (!tabs.find((t) => t.path === filePath)) {
        const name = filePath.split("/").pop() || filePath;
        setTabs((prev) => [...prev, { path: filePath, name, modified: false }]);
      }
      setActiveTab(filePath);

      // Load content if not cached
      if (!fileContents.has(filePath)) {
        const content = await readFile(filePath);
        if (content !== null) {
          setFileContents((prev) => new Map(prev).set(filePath, content));
        }
      }
    },
    [tabs, fileContents, readFile],
  );

  const closeTab = useCallback(
    (filePath: string) => {
      setTabs((prev) => prev.filter((t) => t.path !== filePath));
      setFileContents((prev) => {
        const next = new Map(prev);
        next.delete(filePath);
        return next;
      });
      setModifiedFiles((prev) => {
        const next = new Set(prev);
        next.delete(filePath);
        return next;
      });
      if (activeTab === filePath) {
        setActiveTab((prev) => {
          const remaining = tabs.filter((t) => t.path !== filePath);
          return remaining.length > 0
            ? remaining[remaining.length - 1].path
            : null;
        });
      }
    },
    [activeTab, tabs],
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return;

      setFileContents((prev) => new Map(prev).set(activeTab, value));
      setModifiedFiles((prev) => new Set(prev).add(activeTab));
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab ? { ...t, modified: true } : t,
        ),
      );

      // Debounced save (1s)
      const existing = saveTimerRef.current.get(activeTab);
      if (existing) clearTimeout(existing);

      const filePath = activeTab;
      const timer = setTimeout(async () => {
        const ok = await writeFile(filePath, value);
        if (ok) {
          setModifiedFiles((prev) => {
            const next = new Set(prev);
            next.delete(filePath);
            return next;
          });
          setTabs((prev) =>
            prev.map((t) =>
              t.path === filePath ? { ...t, modified: false } : t,
            ),
          );
        }
        saveTimerRef.current.delete(filePath);
      }, 1000);
      saveTimerRef.current.set(activeTab, timer);
    },
    [activeTab, writeFile],
  );

  // Ctrl+S / Cmd+S immediate save
  const handleKeyDown = useCallback(
    async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!activeTab) return;
        const content = fileContents.get(activeTab);
        if (content === undefined) return;

        // Cancel pending debounced save
        const existing = saveTimerRef.current.get(activeTab);
        if (existing) {
          clearTimeout(existing);
          saveTimerRef.current.delete(activeTab);
        }

        const ok = await writeFile(activeTab, content);
        if (ok) {
          setModifiedFiles((prev) => {
            const next = new Set(prev);
            next.delete(activeTab);
            return next;
          });
          setTabs((prev) =>
            prev.map((t) =>
              t.path === activeTab ? { ...t, modified: false } : t,
            ),
          );
        }
      }
    },
    [activeTab, fileContents, writeFile],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Listen for AI file change events
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        path: string;
        content?: string;
      };
      if (!detail?.path) return;

      const filePath = detail.path.startsWith("/workspace")
        ? detail.path
        : `/workspace/${detail.path.replace(/^\//, "")}`;
      const name = filePath.split("/").pop() || filePath;

      // Open tab if not already open
      setTabs((prev) => {
        if (prev.find((t) => t.path === filePath)) return prev;
        return [...prev, { path: filePath, name, modified: false }];
      });
      setActiveTab(filePath);

      // Update content
      if (detail.content !== undefined) {
        setFileContents((prev) => new Map(prev).set(filePath, detail.content!));
      } else {
        // Fetch content from API
        const content = await readFile(filePath);
        if (content !== null) {
          setFileContents((prev) => new Map(prev).set(filePath, content));
        }
      }

      // Refresh file tree
      loadRoot();
    };

    window.addEventListener("voxel:file-changed", handler);
    return () => window.removeEventListener("voxel:file-changed", handler);
  }, [readFile, loadRoot]);

  const activeContent = activeTab ? fileContents.get(activeTab) ?? "" : "";

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <EditorTabs
        tabs={tabs}
        activeTab={activeTab}
        onSelect={openFile}
        onClose={closeTab}
      />
      <div className="flex min-h-0 flex-1">
        <FileExplorer
          tree={tree}
          loading={loading}
          onLoadRoot={loadRoot}
          onToggleDir={toggleDirectory}
          onOpenFile={openFile}
          activeFile={activeTab}
        />
        <div className="flex-1">
          {activeTab ? (
            <MonacoEditor
              height="100%"
              language={getLanguage(activeTab)}
              theme="vs-dark"
              value={activeContent}
              onChange={handleEditorChange}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 8 },
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Select a file to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add adorable/components/code-editor/code-editor.tsx
git commit -m "feat: add CodeEditor component with Monaco, tabs, and file explorer"
```

---

## Chunk 4: Workspace Integration

### Task 11: Add Code/Preview toggle to workspace layout

**Files:**
- Modify: `adorable/app/[repoId]/repo-workspace-shell.tsx`

This is the biggest integration task. We need to:
1. Add a `rightPanelView` state (`"code"` | `"preview"`)
2. Add toggle buttons in the top bar
3. Conditionally render CodeEditor or AppPreview based on the toggle
4. Keep terminal visible in both modes

- [ ] **Step 1: Add state and imports**

Add import at the top of the file:
```typescript
import { CodeEditor } from "@/components/code-editor/code-editor";
```

Add state inside `RepoWorkspaceShell` component (around line 246, near other state declarations):
```typescript
const [rightPanelView, setRightPanelView] = useState<"code" | "preview">("preview");
```

- [ ] **Step 2: Add Code/Preview toggle to the unified top bar**

In the unified top bar section (around lines 390-420), find where `BrowserControls` is rendered. We need to add the toggle before the BrowserControls. Look for the right-side section of the top bar.

Add the toggle UI in the top bar, replacing or augmenting the existing controls. Insert inside the top bar's right-side area:

```tsx
{/* Code/Preview Toggle */}
<div className="flex items-center rounded-lg bg-zinc-900 p-0.5">
  <button
    className={cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
      rightPanelView === "code"
        ? "bg-zinc-700 text-white"
        : "text-zinc-400 hover:text-zinc-300",
    )}
    onClick={() => setRightPanelView("code")}
  >
    <FileCode className="h-3.5 w-3.5" />
    Code
  </button>
  <button
    className={cn(
      "flex items-center gap-1.5 rounded-md px-3 py-1 text-xs font-medium transition-colors",
      rightPanelView === "preview"
        ? "bg-zinc-700 text-white"
        : "text-zinc-400 hover:text-zinc-300",
    )}
    onClick={() => setRightPanelView("preview")}
  >
    <Globe className="h-3.5 w-3.5" />
    Preview
  </button>
</div>
```

Add `FileCode` and `Globe` to the existing lucide-react imports.

- [ ] **Step 3: Conditionally render CodeEditor or AppPreview**

In the right panel content area (around lines 440-455), replace the unconditional `<AppPreview>` with a conditional render:

```tsx
{/* Right panel content */}
<div className="flex min-h-0 flex-1 flex-col">
  {rightPanelView === "code" ? (
    <div className="min-h-0 flex-1">
      <CodeEditor projectId={repoId} />
    </div>
  ) : (
    <AppPreview
      metadata={metadata}
      iframeRef={iframeRef}
      repoId={repoId}
    />
  )}
</div>
```

Note: The terminal section should remain visible below BOTH code and preview views. The AppPreview component already includes the terminal. For the code view, the terminal needs to be rendered separately below the CodeEditor. Restructure so the terminal lives outside of AppPreview.

This means extracting the terminal section from AppPreview into the parent, so both views share it. The terminal JSX is at lines 641-746 inside AppPreview — it should be moved to the parent layout so it renders below whichever view is active.

- [ ] **Step 4: Extract terminal from AppPreview**

Move the terminal state (`extraTerminals`, `activeTab`, `terminalOpen`) and terminal JSX out of the `AppPreview` component and into the right panel of `RepoWorkspaceShell`. The structure becomes:

```tsx
{/* Right panel */}
<div className="flex flex-col" style={{ overflow: "hidden" }}>
  {/* Top bar with toggle is already above */}

  {/* Content area */}
  <div className="min-h-0 flex-1">
    {rightPanelView === "code" ? (
      <CodeEditor projectId={repoId} />
    ) : (
      <AppPreview
        metadata={metadata}
        iframeRef={iframeRef}
        repoId={repoId}
      />
    )}
  </div>

  {/* Terminal (shared between code and preview) */}
  <TerminalSection repoId={repoId} />
</div>
```

The terminal section can stay inline or become its own component — either way it should be rendered at the same level as the code/preview content area.

- [ ] **Step 5: Commit**

```bash
git add adorable/app/[repoId]/repo-workspace-shell.tsx
git commit -m "feat: add Code/Preview toggle with Monaco editor in workspace"
```

---

### Task 12: Emit voxel:file-changed events from tool cards

**Files:**
- Modify: `adorable/components/assistant-ui/tool-cards.tsx`

- [ ] **Step 1: Add file change event emission to WriteFileToolCard**

In `WriteFileToolCard` (around line 218), add a useEffect that dispatches `voxel:file-changed` when the tool completes:

```typescript
// Inside WriteFileToolCard, after parsing args
const dispatched = useRef(false);
useEffect(() => {
  if (status?.type === "running" || dispatched.current) return;
  dispatched.current = true;
  const filePath = str(a.file);
  const content = str(a.content);
  if (filePath) {
    window.dispatchEvent(
      new CustomEvent("voxel:file-changed", {
        detail: { path: filePath, content: content || undefined },
      }),
    );
  }
}, [status, a]);
```

- [ ] **Step 2: Add same event emission to ReplaceInFileToolCard**

In `ReplaceInFileToolCard` (around line 272), same pattern but without content (will be fetched by editor):

```typescript
const dispatched = useRef(false);
useEffect(() => {
  if (status?.type === "running" || dispatched.current) return;
  dispatched.current = true;
  const filePath = str(a.file);
  if (filePath) {
    window.dispatchEvent(
      new CustomEvent("voxel:file-changed", {
        detail: { path: filePath },
      }),
    );
  }
}, [status, a]);
```

- [ ] **Step 3: Add event emission to BatchWriteFilesToolCard**

Find the BatchWriteFiles tool card (or the section that handles it). Add:

```typescript
const dispatched = useRef(false);
useEffect(() => {
  if (status?.type === "running" || dispatched.current) return;
  dispatched.current = true;
  try {
    const files = a.files;
    if (Array.isArray(files)) {
      for (const f of files) {
        const filePath = str((f as Record<string, unknown>).file);
        const content = str((f as Record<string, unknown>).content);
        if (filePath) {
          window.dispatchEvent(
            new CustomEvent("voxel:file-changed", {
              detail: { path: filePath, content: content || undefined },
            }),
          );
        }
      }
    }
  } catch { /* ignore parse errors */ }
}, [status, a]);
```

- [ ] **Step 4: Add event emission for AppendToFile, DeletePath, MovePath**

For `appendToFileTool` — dispatch `voxel:file-changed` with path only (content fetched by editor).
For `deletePathTool` — dispatch `voxel:file-deleted` with path.
For `movePathTool` — dispatch both `voxel:file-deleted` (source) and `voxel:file-changed` (destination).

These follow the same useRef + useEffect pattern.

- [ ] **Step 5: Commit**

```bash
git add adorable/components/assistant-ui/tool-cards.tsx
git commit -m "feat: emit voxel:file-changed events from tool cards for editor sync"
```

---

## Chunk 5: Polish and Mobile

### Task 13: Handle mobile layout for Code tab

**Files:**
- Modify: `adorable/app/[repoId]/repo-workspace-shell.tsx`

- [ ] **Step 1: Update mobile view toggle**

The current mobile toggle (around line 246) switches between `"chat"` and `"preview"`. Update it to also support the code view. The mobile `mobileView` state should now include `"code"`:

```typescript
const [mobileView, setMobileView] = useState<"chat" | "code" | "preview">("chat");
```

On mobile, the Code/Preview toggle in the top bar works as a sub-toggle within the right panel. When user taps Code or Preview on mobile, it also sets `mobileView` appropriately:

```typescript
onClick={() => {
  setRightPanelView("code");
  if (isMobile) setMobileView("code");
}}
```

The grid columns on mobile should show the right panel for both `"code"` and `"preview"`:
```typescript
const gridColumns = isMobile
  ? mobileView === "chat"
    ? "1fr 0fr"
    : "0fr 1fr"
  : "2fr 3fr";
```

- [ ] **Step 2: Commit**

```bash
git add adorable/app/[repoId]/repo-workspace-shell.tsx
git commit -m "feat: support Code tab in mobile layout"
```

---

### Task 14: Auto-switch to Code tab when AI writes files

**Files:**
- Modify: `adorable/app/[repoId]/repo-workspace-shell.tsx`

- [ ] **Step 1: Add listener to auto-switch to Code view**

In `RepoWorkspaceShell`, add an effect that switches to Code tab when AI starts writing files:

```typescript
useEffect(() => {
  const handler = () => {
    setRightPanelView("code");
  };
  window.addEventListener("voxel:file-changed", handler);
  return () => window.removeEventListener("voxel:file-changed", handler);
}, []);
```

This provides the "watch AI write code" experience. The user sees the Code tab activate and files open as the AI generates them.

- [ ] **Step 2: Commit**

```bash
git add adorable/app/[repoId]/repo-workspace-shell.tsx
git commit -m "feat: auto-switch to Code tab when AI writes files"
```

---

### Task 15: File tree refresh on file changes

**Files:**
- Modify: `adorable/hooks/use-file-system.ts`

- [ ] **Step 1: Add listener for file changes to refresh tree**

Add a `useEffect` in the `useFileSystem` hook that listens for `voxel:file-changed` and `voxel:file-deleted` events and triggers a `loadRoot()` refresh:

```typescript
useEffect(() => {
  const handler = () => {
    // Debounce tree refresh
    const timer = setTimeout(() => loadRoot(), 500);
    return () => clearTimeout(timer);
  };

  window.addEventListener("voxel:file-changed", handler);
  window.addEventListener("voxel:file-deleted", handler);
  return () => {
    window.removeEventListener("voxel:file-changed", handler);
    window.removeEventListener("voxel:file-deleted", handler);
  };
}, [loadRoot]);
```

- [ ] **Step 2: Commit**

```bash
git add adorable/hooks/use-file-system.ts
git commit -m "feat: refresh file tree on AI file changes"
```

---

### Task 16: Final integration test and cleanup

- [ ] **Step 1: Build check**

```bash
cd adorable && npm run build
```

Fix any TypeScript or build errors.

- [ ] **Step 2: Manual testing checklist**

1. Create a new project → verify template is scaffolded (check container has `/workspace/package.json`)
2. Preview tab → verify loading overlay shows briefly, then default Next.js page appears (no "refused to connect")
3. Click Code tab → verify file explorer shows project files
4. Click a file → verify it opens in Monaco editor
5. Edit a file → verify modified indicator appears, auto-save works
6. Send a chat message that creates files → verify Code tab activates, files open in editor
7. Switch to Preview → verify live preview reflects AI changes
8. Mobile: verify Code/Preview toggle works

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: code editor + preview system integration complete"
```
