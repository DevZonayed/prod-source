import { tool, type Tool } from "ai";
import type { Vm } from "freestyle-sandboxes";
import { z } from "zod";
import { WORKDIR, VM_PORT } from "../../vars";
import { runVmCommand, shellQuote } from "./helpers";

/**
 * Browser action tool using Playwright MCP for controlling the sandbox preview.
 *
 * Architecture: The Playwright MCP server runs on the Next.js server side,
 * pointing at the VM's publicly-accessible preview URL. This avoids installing
 * Playwright inside the VM.
 *
 * If Playwright MCP is not available, falls back to curl-based HTTP checks.
 */

type BrowserState = {
  mcpClient: unknown | null;
  initialized: boolean;
  previewUrl: string;
};

const browserState: BrowserState = {
  mcpClient: null,
  initialized: false,
  previewUrl: "",
};

/**
 * Attempts to initialize the Playwright MCP connection.
 * Returns true if successful, false if Playwright is not available.
 */
async function ensureBrowser(previewUrl: string): Promise<boolean> {
  if (browserState.initialized) return !!browserState.mcpClient;
  browserState.previewUrl = previewUrl;

  try {
    // Dynamic import to avoid hard dependency
    const { MCPClient } = await import("@mastra/mcp");
    const client = new MCPClient({
      servers: {
        playwright: {
          command: "npx",
          args: ["@anthropic-ai/mcp-playwright@latest"],
          env: {
            PLAYWRIGHT_HEADLESS: "true",
          },
        },
      },
    });
    browserState.mcpClient = client;
    browserState.initialized = true;
    return true;
  } catch {
    browserState.initialized = true; // Mark as attempted
    return false;
  }
}

/**
 * Executes a Playwright MCP tool call.
 */
async function callPlaywright(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  if (!browserState.mcpClient) {
    throw new Error("Playwright MCP not initialized");
  }
  const client = browserState.mcpClient as {
    callTool: (
      server: string,
      tool: string,
      args: Record<string, unknown>,
    ) => Promise<{ content: Array<{ text?: string; type: string }> }>;
  };
  const result = await client.callTool("playwright", toolName, args);
  const textParts = result.content
    .filter((c) => c.type === "text" && c.text)
    .map((c) => c.text!);
  return textParts.join("\n") || "(no output)";
}

/**
 * Fallback: use curl to check the app when Playwright is unavailable.
 */
async function curlFallback(
  vm: Vm,
  url: string,
): Promise<{ ok: boolean; statusCode: number; body: string }> {
  const result = await runVmCommand(
    vm,
    `curl -sS -o /tmp/curl-body.txt -w '%{http_code}' ${shellQuote(url)} 2>&1`,
  );
  const statusCode = parseInt(result.stdout.trim(), 10) || 0;
  const bodyResult = await runVmCommand(vm, "cat /tmp/curl-body.txt | head -100");
  return {
    ok: statusCode >= 200 && statusCode < 400,
    statusCode,
    body: bodyResult.stdout.slice(0, 2000),
  };
}

type BrowserResult = {
  action?: string;
  url?: string;
  fallback?: boolean;
  statusCode?: number;
  ok?: boolean;
  bodyPreview?: string;
  note?: string;
  error?: string;
  selector?: string;
  text?: string;
  script?: string;
  result?: string;
  savedTo?: string;
};

/**
 * Creates the browser_action tool
 */
export function createBrowserTools(vm: Vm, previewUrl: string) {
  const browserParams = z.object({
    Action: z
      .enum([
        "navigate",
        "click",
        "type",
        "screenshot",
        "scroll_up",
        "scroll_down",
        "wait",
        "evaluate",
      ])
      .describe("Browser action to perform"),
    Url: z
      .string()
      .optional()
      .describe("URL for navigate action (empty = use preview URL)"),
    Selector: z
      .string()
      .optional()
      .describe("CSS selector for click/type actions"),
    Text: z
      .string()
      .optional()
      .describe("Text to type for type action"),
    Script: z
      .string()
      .optional()
      .describe("JavaScript to evaluate for evaluate action"),
  });

  type BrowserInput = z.infer<typeof browserParams>;

  const browserTool: Tool<BrowserInput, BrowserResult> = {
    description:
      "Control a headless browser for testing web applications. Supports navigation, clicking, typing, screenshot capture, scrolling, waiting, and JS evaluation. Uses the sandbox preview URL.",
    inputSchema: browserParams,
    execute: async ({
      Action,
      Url,
      Selector,
      Text,
      Script,
    }) => {
        const hasBrowser = await ensureBrowser(previewUrl);

        if (!hasBrowser) {
          if (Action === "navigate") {
            const targetUrl = Url || `http://localhost:${VM_PORT}`;
            const fallbackResult = await curlFallback(vm, targetUrl);
            return {
              action: "navigate",
              url: targetUrl,
              fallback: true,
              statusCode: fallbackResult.statusCode,
              ok: fallbackResult.ok,
              bodyPreview: fallbackResult.body.slice(0, 500),
              note: "Playwright MCP not available. Using curl fallback.",
            };
          }
          return {
            action: Action,
            fallback: true,
            error: `Action '${Action}' requires Playwright MCP. Only 'navigate' works in fallback mode.`,
          };
        }

        try {
          switch (Action) {
            case "navigate": {
              const targetUrl = Url || previewUrl;
              return {
                action: "navigate",
                url: targetUrl,
                result: await callPlaywright("browser_navigate", {
                  url: targetUrl,
                }),
              };
            }
            case "click":
              if (!Selector)
                return { error: "Selector required for click action" };
              return {
                action: "click",
                selector: Selector,
                result: await callPlaywright("browser_click", {
                  selector: Selector,
                }),
              };
            case "type":
              if (!Selector)
                return { error: "Selector required for type action" };
              if (!Text) return { error: "Text required for type action" };
              return {
                action: "type",
                selector: Selector,
                text: Text,
                result: await callPlaywright("browser_type", {
                  selector: Selector,
                  text: Text,
                }),
              };
            case "screenshot":
              return {
                action: "screenshot",
                result: await callPlaywright("browser_screenshot", {}),
                savedTo: `${WORKDIR}/public/screenshots/screenshot-${Date.now()}.png`,
              };
            case "scroll_up":
              return {
                action: "scroll_up",
                result: await callPlaywright("browser_scroll", {
                  direction: "up",
                }),
              };
            case "scroll_down":
              return {
                action: "scroll_down",
                result: await callPlaywright("browser_scroll", {
                  direction: "down",
                }),
              };
            case "wait":
              return {
                action: "wait",
                result: await callPlaywright("browser_wait", { timeout: 2000 }),
              };
            case "evaluate":
              if (!Script)
                return { error: "Script required for evaluate action" };
              return {
                action: "evaluate",
                script: Script,
                result: await callPlaywright("browser_evaluate", {
                  script: Script,
                }),
              };
            default:
              return { error: `Unknown action: ${Action}` };
          }
        } catch (err) {
          return {
            action: Action,
            error: `Browser action failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
  };

  return {
    browser_action: browserTool,
  };
}
