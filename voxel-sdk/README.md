# Voxel SDK

A thin bridge to the **Claude Code CLI** via the `@anthropic-ai/claude-agent-sdk`. Drop this into any TypeScript/Electron project to get:

- **MCP Server** — Register tools dynamically, Claude executes them
- **Query Bridge** — Stream queries through the CLI binary with full event parsing
- **OAuth Auth** — Auto-read/refresh tokens from `~/.claude/.credentials.json`
- **Prompt Builder** — Compose system prompts from identity + tool catalog + skills

---

## Quick Start

```typescript
import { McpServer, runQuery, buildPrompt } from "voxel-sdk";
import { z } from "zod";

// 1. Create an MCP server and register tools
const server = new McpServer("my-tools");

server.addTool(
  "read_file",
  "Read a file from disk",
  { Path: z.string().describe("Absolute file path") },
  async (args) => {
    const fs = require("fs/promises");
    const content = await fs.readFile(args.Path, "utf-8");
    return { content: [{ type: "text", text: content }] };
  },
  "Filesystem"
);

server.addTool(
  "write_file",
  "Write content to a file",
  {
    Path: z.string().describe("Absolute file path"),
    Content: z.string().describe("File content"),
  },
  async (args) => {
    const fs = require("fs/promises");
    await fs.writeFile(args.Path, args.Content, "utf-8");
    return { content: [{ type: "text", text: `Wrote ${args.Path}` }] };
  },
  "Filesystem"
);

// 2. Build a system prompt
const prompt = buildPrompt(
  {
    agentName: "My Assistant",
    agentBuilder: "My Company",
    coreInstructions: "You help users with coding tasks.",
  },
  server
);

// 3. Run a query
const result = await runQuery(
  [{ role: "user", content: "Create a hello world file at /tmp/hello.txt" }],
  { systemPrompt: prompt },
  {
    mcpServer: server,
    onEvent: (event) => {
      if (event.type === "text-delta") process.stdout.write(event.delta);
      if (event.type === "tool-input-start") console.log(`\n[Tool: ${event.toolName}]`);
    },
  }
);

console.log("\n\nDone:", result.text);
```

---

## API

### `McpServer`

Creates and manages an MCP server with dynamically registered tools.

```typescript
const server = new McpServer("server-name", "1.0.0");

// Add tools
server.addTool(name, description, zodSchema, handler, category?);

// Remove tools
server.removeTool(name);

// Query tools
server.hasTool(name);
server.listTools();     // → [{ name, description, category }]
server.size;            // → number

// For system prompts
server.getCatalog();    // → formatted text listing all tools by category

// For query execution
server.build();             // → MCP server instance for Agent SDK
server.getAllowedToolNames(); // → ["mcp__server-name__tool1", ...]
```

### `runQuery(messages, options, bridgeOptions)`

Execute a query through the Claude Code CLI.

```typescript
const result = await runQuery(
  messages,       // Array<{ role: "user"|"assistant", content: string }>
  {
    systemPrompt: "...",
    model: "sonnet",              // "sonnet" | "opus" | "haiku" | full model ID
    maxTurns: 200,                // Max agentic turns
    permissionMode: "bypassPermissions",
    allowedBuiltinTools: ["WebSearch", "WebFetch"],  // CLI tools alongside MCP
  },
  {
    mcpServer: server,
    onEvent: (event) => { /* handle streaming events */ },
  }
);

// result.text — Final assistant text
// result.inputTokens — Total input tokens used
// result.outputTokens — Total output tokens used
```

### Stream Events

The `onEvent` callback receives these events:

| Event | Fields | When |
|-------|--------|------|
| `text-start` | `id` | Text block begins |
| `text-delta` | `id`, `delta` | Text chunk streamed |
| `text-end` | `id` | Text block complete |
| `tool-input-start` | `toolCallId`, `toolName` | Tool call begins |
| `tool-input-delta` | `toolCallId`, `inputTextDelta` | Tool args streaming |
| `tool-input-available` | `toolCallId`, `toolName`, `input` | Tool args complete |
| `tool-output-available` | `toolCallId`, `output` | Tool result ready |
| `start-step` | | New agent step begins |
| `finish-step` | | Agent step complete |
| `usage` | `inputTokens`, `outputTokens` | Token usage report |
| `finish` | `text` | Query complete |
| `error` | `message` | Error occurred |

### `buildPrompt(config, mcpServer?, skills?)`

Compose a system prompt from components.

```typescript
const prompt = buildPrompt(
  {
    agentName: "My Agent",
    agentBuilder: "My Company",
    coreInstructions: "You are a helpful coding assistant...",
    additionalInstructions: "Always respond in Japanese.",
  },
  server,  // Auto-generates tool catalog from registered tools
  [        // Optional skills
    { name: "react-patterns", content: "# React Best Practices\n..." },
  ]
);
```

### `loadSkillsFromFiles(...files)`

Load skill content from disk.

```typescript
const skills = loadSkillsFromFiles(
  { name: "react", path: "./skills/react.md" },
  { name: "typescript", path: "./skills/typescript.md" },
);
```

### Auth

```typescript
import { getAccessToken, getAuthStatus, isCliInstalled } from "voxel-sdk";

// Check if Claude CLI is installed
await isCliInstalled(); // → true/false

// Check auth status
await getAuthStatus(); // → { authenticated: true, email: "...", ... }

// Get a valid OAuth token (auto-refreshes)
const token = await getAccessToken(); // → "sk-ant-..." or null
```

---

## Electron Integration

```typescript
// main.ts
import { McpServer, runQuery, buildPrompt } from "./voxel-sdk/src";
import { z } from "zod";
import { ipcMain, BrowserWindow } from "electron";

const server = new McpServer("ide-tools");

// Register your Electron-specific tools
server.addTool("open_in_editor", "Open a file in the editor",
  { Path: z.string() },
  async (args) => {
    mainWindow.webContents.send("open-file", args.Path);
    return { content: [{ type: "text", text: `Opened ${args.Path}` }] };
  },
  "IDE"
);

// Add more tools as needed...

const prompt = buildPrompt({
  agentName: "IDE Assistant",
  coreInstructions: "You are an AI coding assistant integrated into an IDE.",
}, server);

// Handle chat from renderer process
ipcMain.handle("chat", async (_, messages) => {
  return runQuery(messages, { systemPrompt: prompt }, {
    mcpServer: server,
    onEvent: (event) => {
      mainWindow.webContents.send("agent-event", event);
    },
  });
});
```

---

## How It Works

```
Your Electron App
  │
  ├─ McpServer (registers tools)
  │    └─ addTool("my_tool", ..., handler)
  │
  ├─ buildPrompt (assembles system prompt)
  │    └─ identity + tool catalog + skills + instructions
  │
  └─ runQuery (executes through Claude Code CLI)
       │
       ├─ query() from @anthropic-ai/claude-agent-sdk
       │    └─ Spawns the Claude CLI binary
       │    └─ Authenticates via OAuth (~/.claude/.credentials.json)
       │    └─ Sends system prompt + messages + MCP server config
       │
       ├─ Claude generates text + tool calls
       │    └─ Tool calls route to YOUR MCP server handlers
       │    └─ Results flow back to Claude for next turn
       │
       └─ Stream events → onEvent callback → your UI
```

---

## Files

```
voxel-sdk/
├── package.json         # Dependencies (@anthropic-ai/claude-agent-sdk, zod)
├── tsconfig.json        # TypeScript config
├── README.md            # This file
└── src/
    ├── index.ts         # Entry point — all exports
    ├── mcp-server.ts    # McpServer class (tool registration + MCP build)
    ├── query-bridge.ts  # runQuery() — core query execution + streaming
    ├── prompt-builder.ts # buildPrompt() — system prompt composition
    ├── auth.ts          # Claude Code CLI OAuth token management
    └── types.ts         # All type definitions
```

**6 source files. 2 dependencies. 0 framework lock-in.**

---

## Dependencies

| Package | Purpose |
|---------|---------|
| `@anthropic-ai/claude-agent-sdk` | Bridge to Claude Code CLI binary (query, MCP server, tool definitions) |
| `zod` | Schema validation for tool parameters |

Everything else uses Node.js built-ins.

---

## Prerequisites

- **Claude Code CLI** must be installed and authenticated (`claude auth login`)
- **Node.js 20+**
- **TypeScript 5+** (peer dependency)
