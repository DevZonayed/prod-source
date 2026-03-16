# Code Editor + Preview System Design

## Problem

1. **No code editor** — Users can't see or edit the files the AI generates. They only see chat + preview.
2. **"localhost refused to connect"** — The preview iframe loads before the dev server is ready, showing a broken error for 30-60 seconds on every new project.
3. **No real-time visibility** — Users can't watch the AI write code or understand what's being generated.

## Solution Overview

Add a VS Code-like code editor (Monaco) to the workspace with a Code/Preview tab toggle, fix the preview startup to be near-instant via pre-built templates, and sync AI file operations to the editor in real-time.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Layout | Chat (left) \| Code↔Preview toggle + Terminal (right) | v0.dev/Lovable pattern. Clean, works on all screens. |
| Editor | Monaco Editor | VS Code's engine. Industry standard for web IDEs. |
| File explorer | Persistent sidebar tree (always visible) | Most familiar to developers. |
| AI sync | Auto-open & live update | Users see AI write code in real-time. Builds trust. |
| Preview fix | Pre-scaffold template + smart loading overlay | Near-instant preview. No "refused to connect" ever. |

---

## 1. Workspace Layout

### Desktop (≥768px)
```
┌─────────────────────────────────────────────────────────┐
│  [← Conversations]          [Code ● | Preview]  [Publish] │
├──────────────┬──────────────────────────────────────────┤
│              │  [page.tsx] [layout.tsx] [todo.tsx ●]     │
│              ├────────┬─────────────────────────────────┤
│   Chat       │ Explorer│  Monaco Editor                  │
│   Panel      │ ▾ app   │  1│ import TodoList from...     │
│   (2fr)      │   page  │  2│                             │
│              │   layout│  3│ export default function() { │
│              │ ▾ comps  │  4│   return (                  │
│              │   todo   │  5│     <TodoList />            │
│              ├────────┴─────────────────────────────────┤
│              │  Terminal  [Dev Server] [Extra] [+]       │
│              │  $ ✓ Ready on http://localhost:3000       │
├──────────────┴──────────────────────────────────────────┤
```

When "Preview" tab is active, the right panel switches to:
```
┌──────────────────────────────────────────┐
│  [← →] [↻]  http://localhost:3000/      │
├──────────────────────────────────────────┤
│                                          │
│          Live Preview (iframe)           │
│                                          │
├──────────────────────────────────────────┤
│  Terminal  [Dev Server] [Extra] [+]      │
│  $ ✓ Ready on http://localhost:3000      │
└──────────────────────────────────────────┘
```

### Mobile
- Tab toggle between Chat view and Code/Preview view (same as current mobile behavior but with Code tab added).

### Grid layout
- Left: `2fr` (chat)
- Right: `3fr` (code/preview + terminal)
- Terminal: collapsible, 0-35% of right panel height

---

## 2. Preview Startup Fix

### Root Cause
Container creation → npm install → dev server start takes 30-60s. During this time, the iframe src points to an unreachable URL, showing "refused to connect."

### Solution: Pre-built Template in Docker Image

**Docker image changes (`voxel-sandbox`):**
- Bake a default Next.js app at `/template/` in the image
- Pre-install node_modules in the template (no runtime npm install needed)
- Template includes: `app/page.tsx`, `app/layout.tsx`, `app/globals.css`, `package.json`, `tailwind.config.ts`, `tsconfig.json`, `next.config.ts`

**Container startup changes (`docker-manager.ts`):**
- After `container.start()`, run `docker exec` to check if `/workspace/package.json` exists
- If not (new project), run `cp -a /template/. /workspace/` to copy all files including dotfiles
- **node_modules strategy**: Use symlink (`ln -s /template/node_modules /workspace/node_modules`) for instant availability. Since `/template/node_modules` lives in the container's overlay filesystem, this is instant. If the AI later runs `npm install` (adding new deps), the symlink gets replaced with a real directory automatically.
- `createProjectContainer()` must wait for the copy/symlink to complete before returning
- This takes <2 seconds (file copy + symlink, no npm install)

**Dev server startup changes (`dev-server-manager.ts`):**
- The existing code already skips `npm install` when `node_modules` exists — no change needed
- Start dev server immediately: `npx next dev --turbopack --port 3000`
- Dev server ready in ~2-3 seconds (node_modules available via symlink)

**Loading overlay (`PreviewLoadingOverlay`):**
- Renders OVER the iframe area (not instead of it)
- Shows progress: "Preparing environment..." → "Starting dev server..." → fades out
- Never renders the iframe `src` until `useDevServer` confirms the URL is reachable
- Smooth fade-out transition when iframe's `onLoad` fires

**Result:** Preview shows a working Next.js default page within ~3 seconds of project creation. AI then modifies files and hot-reload updates the preview live.

---

## 3. Code Editor (Monaco)

### Package
`@monaco-editor/react` — the standard React wrapper for Monaco.

### Loading Strategy
- Use `next/dynamic` with `{ ssr: false }` to lazy-load Monaco only when Code tab is active
- This keeps the initial bundle small (~0 extra KB until user clicks Code tab)

### CodeEditor Component
- Wraps `<Editor>` from `@monaco-editor/react`
- Theme: VS Code Dark+ (matches app aesthetic)
- Language detection from file extension (tsx, ts, css, json, etc.)
- Read/write files via container API endpoints

### File Tabs (EditorTabs)
- Horizontal tab bar above editor
- Each tab: filename, close button (×), modified indicator (●)
- Active tab highlighted with blue top border
- Tabs closeable, scrollable when many open
- Right-click context menu: Close, Close Others, Close All

### File Explorer (FileExplorer)
- Persistent sidebar (left of editor, ~180px wide)
- Tree view with expand/collapse folders
- File type icons (different icons for .tsx, .css, .json, etc.)
- Click file → opens in editor tab
- Shows full project tree from container's `/workspace`
- Fetches file list via API: `GET /api/files?projectId=...&path=/workspace`

### New API Endpoint: `/api/files`
- `GET ?projectId=...&path=...` → returns directory listing (lazy-load per folder, not full recursive)
- `GET ?projectId=...&file=...` → returns file content
- `PUT ?projectId=...&file=...` → writes file content (for user edits)
- **Security**: All file paths must be validated to be under `/workspace/`. Use path traversal protection (reject `..` segments). Reuse `normalizeRelativePath` from `create-tools.ts`.
- **Exclusions**: Directory listings exclude `node_modules/`, `.next/`, `.git/` by default

---

## 4. AI → Editor Sync

### Event Flow
```
AI tool call (writeFile/replaceInFile)
  → Server executes in container
  → Tool result returned to client
  → Custom event: `voxel:file-changed` { path, content, action }
  → useEditorSync hook picks up event
  → Opens file tab in Monaco (if not already open)
  → Updates editor content
  → Highlights changed lines (green gutter)
  → File tree refreshes
  → Next.js hot-reload updates preview
```

### useEditorSync Hook
- Listens for `voxel:file-changed` custom events
- Maintains a Map of open files and their content
- When a file change event fires:
  1. If file not open → add tab, set as active
  2. If file open → update content in Monaco model
  3. Apply decorations (green highlight) on changed lines
  4. Auto-scroll to first changed line
- Debounce rapid changes (100ms) to prevent flicker

### Event Emission
- Emit events in `components/assistant-ui/tool-cards.tsx` (where `voxel:tool-error` is already emitted)
- Tool calls to watch: `writeFile`, `replaceInFile`, `batchWriteFiles`, `appendToFile`, `deletePath`, `movePath`
- Read the file path from the tool call **arguments** (input), not the result (which only returns `{ ok: true }`)
- For `batchWriteFiles`, emit a separate `voxel:file-changed` event per file in the batch
- Content: either read from tool call args (for writeFile which has full content) or fetch lazily from `/api/files` (for replaceInFile which has only a diff)

### User Edits
- Monaco `onChange` → debounced save (1s) via `PUT /api/files`
- Save writes to container filesystem
- Next.js hot-reload picks up the change
- Ctrl+S / Cmd+S triggers immediate save
- Modified indicator (●) on tab until saved

---

## 5. Component Architecture

### New Files

| File | Purpose |
|------|---------|
| `components/code-editor/code-editor.tsx` | Monaco editor wrapper with tabs and sidebar |
| `components/code-editor/file-explorer.tsx` | File tree sidebar component |
| `components/code-editor/editor-tabs.tsx` | Tab bar for open files |
| `components/code-editor/preview-loading-overlay.tsx` | Smart loading screen for preview |
| `hooks/use-file-system.ts` | File listing and read/write via container API |
| `hooks/use-editor-sync.ts` | Bridges AI tool events to Monaco editor state |
| `app/api/files/route.ts` | File CRUD API endpoint for container filesystem |

### Modified Files

| File | Changes |
|------|---------|
| `app/[repoId]/repo-workspace-shell.tsx` | Add Code/Preview toggle, integrate CodeEditor, add loading overlay |
| `lib/docker-manager.ts` | Copy template to /workspace on new container |
| `lib/dev-server-manager.ts` | Skip npm install when template detected |
| `app/assistant.tsx` | Emit `voxel:file-changed` events on tool completion |
| `Dockerfile` (sandbox image) | Bake Next.js template with node_modules |

### State Management
- Editor state (open tabs, active file, content) managed via Zustand store or React state in CodeEditor
- File tree state managed in useFileSystem hook
- No global store needed — editor state is local to the workspace

---

## 6. Docker Image Template

### Template Contents (`/template/` in voxel-sandbox image)
```
/template/
├── app/
│   ├── page.tsx          # Default "Welcome" page
│   ├── layout.tsx        # Root layout with fonts
│   └── globals.css       # Tailwind base styles
├── public/
├── package.json          # Next.js + React + Tailwind deps
├── tailwind.config.ts
├── tsconfig.json
├── next.config.ts
├── postcss.config.mjs
└── node_modules/         # Pre-installed (biggest time saver)
```

### Image Build Addition
```dockerfile
# In voxel-sandbox Dockerfile
COPY template/ /template/
RUN cd /template && npm install
```

### Container Start Logic
```bash
# Run via docker exec after container.start()
if [ ! -f /workspace/package.json ]; then
  cp -a /template/. /workspace/     # copies all files including dotfiles
  rm -rf /workspace/node_modules     # remove copied node_modules dir if any
  ln -s /template/node_modules /workspace/node_modules  # instant symlink
fi
```

### Known Limitations (v1)
- If AI and user edit the same file simultaneously, last write wins (acceptable for v1)
- Container restart clears editor state — editor re-fetches content on reconnect
- No keyboard shortcuts beyond Monaco defaults (Ctrl+P, Ctrl+Shift+E etc. deferred)

---

## 7. Loading States Summary

| State | What user sees |
|-------|---------------|
| Container creating | Loading overlay: "Preparing environment..." |
| Dev server starting | Loading overlay: "Starting dev server..." |
| Dev server ready | Loading overlay fades out, preview appears |
| AI generating code | Code tab: live file updates. Preview tab: hot-reload updates |
| Error/timeout | Loading overlay: error message + retry button |

No state ever shows "localhost refused to connect" in the iframe.

---

## 8. Out of Scope

- IntelliSense/autocomplete (Monaco has basic support built-in, no LSP integration needed for v1)
- Git integration in the editor
- Multi-file diff view
- Collaborative editing
- File upload/download
- Search across files (can add later)
