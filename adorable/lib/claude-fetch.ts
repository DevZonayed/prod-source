/**
 * Custom fetch for Claude Code OAuth authentication.
 *
 * Matches the official Claude Code CLI (cli.js v2.1.76) auth mechanism exactly:
 *   - OAuth: `Authorization: Bearer ${accessToken}` + `anthropic-beta: oauth-2025-04-20`
 *   - User-Agent: `claude-cli/2.1.76` (matches CLI binary)
 *   - anthropic-version: `2023-06-01`
 *
 * The @ai-sdk/anthropic wrapper only supports x-api-key auth. This fetch intercepts
 * every request, removes the placeholder x-api-key, and replaces it with the
 * Authorization: Bearer header that the CLI uses for OAuth.
 */

import { getValidToken } from "./claude-auth";

// Match CLI version from cli.js (pO() and Gy() functions)
const CLI_VERSION = "2.1.76";

/**
 * Creates a custom fetch that authenticates exactly like the Claude CLI binary.
 *
 * CLI auth pattern (from QO() in cli.js):
 *   OAuth: { Authorization: `Bearer ${accessToken}`, "anthropic-beta": "oauth-2025-04-20" }
 *   API key: { "x-api-key": key }
 *
 * CLI user-agent pattern (from Gy() in cli.js):
 *   `claude-cli/${VERSION} (external, ${entrypoint})`
 */
export function createClaudeCodeFetch(): typeof globalThis.fetch {
  return async (input, init) => {
    // Get a valid (auto-refreshed) OAuth token
    let token: string;
    try {
      token = await getValidToken();
    } catch (err) {
      console.error("[ClaudeFetch] Failed to get valid token:", err);
      throw err;
    }

    // Build headers matching CLI auth pattern exactly
    const headers = new Headers(init?.headers);

    // CLI (QO function): OAuth uses Authorization: Bearer, NOT x-api-key
    // Remove the placeholder x-api-key that @ai-sdk/anthropic sets
    headers.delete("x-api-key");
    headers.set("Authorization", `Bearer ${token}`);

    // CLI (DP variable): OAuth requests require this beta flag
    const existingBeta = headers.get("anthropic-beta") ?? "";
    const betaFlags = existingBeta
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean);

    if (!betaFlags.includes("oauth-2025-04-20")) {
      betaFlags.push("oauth-2025-04-20");
    }
    headers.set("anthropic-beta", betaFlags.join(","));

    // CLI (Gy function): User-Agent identifies as claude-cli
    headers.set(
      "User-Agent",
      `claude-cli/${CLI_VERSION} (external, voxel-app)`,
    );

    // CLI always sends anthropic-version (already set by @ai-sdk/anthropic, but ensure it)
    if (!headers.has("anthropic-version")) {
      headers.set("anthropic-version", "2023-06-01");
    }

    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request).url;

    console.log("[ClaudeFetch] Request:", {
      url: url.split("?")[0],
      tokenPrefix: token.slice(0, 20) + "...",
      betas: headers.get("anthropic-beta"),
      userAgent: headers.get("User-Agent"),
    });

    // Make the actual request
    const response = await globalThis.fetch(input, { ...init, headers });

    // Log error responses for debugging
    if (!response.ok) {
      const cloned = response.clone();
      const errorBody = await cloned.text().catch(() => "(unreadable)");
      console.error("[ClaudeFetch] API Error:", {
        status: response.status,
        statusText: response.statusText,
        url: url.split("?")[0],
        responseBody: errorBody.slice(0, 1000),
      });
    }

    return response;
  };
}
