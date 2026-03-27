import { tool, type Tool } from "ai";
import { z } from "zod";
import { dispatch } from "@/lib/browser-bridge";

/**
 * Browser action tool using the Preview Bridge.
 *
 * Commands are dispatched to the browser-bridge singleton, which queues them.
 * The client-side PreviewBridge component polls for commands, forwards them
 * to the iframe via postMessage, and sends results back. The user sees every
 * action happen live in the preview panel.
 */

type BrowserResult = {
  action?: string;
  url?: string;
  ok?: boolean;
  error?: string;
  selector?: string;
  text?: string;
  script?: string;
  result?: string;
  screenshot?: string;
};

export function createBrowserTools(projectId: string, previewUrl: string) {
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
        "get_snapshot",
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
      "Control the live preview browser. Actions happen visually in the user's preview panel. Supports navigation, clicking elements, typing text, taking screenshots, scrolling, waiting, JS evaluation, and getting a DOM snapshot.",
    inputSchema: browserParams,
    execute: async ({ Action, Url, Selector, Text, Script }) => {
      try {
        const result = await dispatch(projectId, {
          action: Action,
          url: Url || previewUrl,
          selector: Selector,
          text: Text,
          script: Script,
          scrollDirection: Action === "scroll_up" ? "up" : Action === "scroll_down" ? "down" : undefined,
        });

        if (!result.success) {
          return { action: Action, error: result.error ?? "Action failed" };
        }

        return {
          action: Action,
          ok: true,
          result: typeof result.data === "string" ? result.data : JSON.stringify(result.data),
          screenshot: result.screenshot,
          url: Action === "navigate" ? (Url || previewUrl) : undefined,
          selector: Selector,
          text: Text,
          script: Script,
        };
      } catch (err) {
        return {
          action: Action,
          error: `Bridge error: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    },
  };

  return {
    browser_action: browserTool,
  };
}
