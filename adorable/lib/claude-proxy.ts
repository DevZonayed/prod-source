/**
 * Claude Code Auth Proxy — DEPRECATED
 *
 * This proxy approach was replaced by direct OAuth token injection via claude-fetch.ts.
 * The custom fetch reads the OAuth token from ~/.claude/.credentials.json and adds it
 * directly as the x-api-key header with the oauth-2025-04-20 beta flag.
 *
 * This file is kept as a no-op for import compatibility.
 */

export async function getProxyBaseUrl(): Promise<string> {
  throw new Error(
    "Claude proxy is deprecated. OAuth tokens are now injected directly via claude-fetch.ts.",
  );
}
