import { readFile, writeFile, rename } from "fs/promises";
import { execFile } from "child_process";
import { homedir } from "os";
import { join } from "path";

const CREDENTIALS_PATH = join(homedir(), ".claude", ".credentials.json");
const CREDENTIALS_TMP_PATH = CREDENTIALS_PATH + ".tmp";

const OAUTH_TOKEN_ENDPOINT = "https://console.anthropic.com/api/oauth/token";
const OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000; // Refresh 5 minutes before expiry

type ClaudeOAuth = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scopes?: string[];
  subscriptionType?: string;
  rateLimitTier?: string;
};

type ClaudeCredentials = {
  claudeAiOauth?: ClaudeOAuth;
  [key: string]: unknown; // Preserve other top-level keys (e.g. mcpOAuth)
};

type ClaudeAuthStatus = {
  authenticated: boolean;
  email?: string;
  subscriptionType?: string;
  expiresAt?: number;
};

// ---------------------------------------------------------------------------
// In-memory refresh lock — deduplicates concurrent refresh attempts
// (refresh tokens are single-use, so only one refresh can succeed)
// ---------------------------------------------------------------------------
let refreshLock: Promise<string | null> | null = null;

// ---------------------------------------------------------------------------
// Core: getValidToken — the single entry point for a guaranteed-valid token
// ---------------------------------------------------------------------------

/**
 * Returns a valid Claude OAuth access token, refreshing if needed.
 * Reads fresh from disk on every call so it picks up tokens refreshed
 * by the Claude CLI or other processes.
 */
export async function getValidToken(): Promise<string> {
  const creds = await readCredentials();
  const oauth = creds?.claudeAiOauth;

  if (!oauth?.accessToken) {
    throw new Error(
      "Claude Code is not authenticated. No accessToken in ~/.claude/.credentials.json. " +
      "Run 'claude auth login' to authenticate.",
    );
  }

  const now = Date.now();
  const isExpiring = oauth.expiresAt && now > oauth.expiresAt - EXPIRY_BUFFER_MS;

  if (!isExpiring) {
    return oauth.accessToken;
  }

  console.log("[ClaudeAuth] Token expired or expiring soon, refreshing...");

  // Deduplicate concurrent refreshes
  if (!refreshLock) {
    refreshLock = performRefresh(creds!).finally(() => {
      refreshLock = null;
    });
  }

  const freshToken = await refreshLock;
  if (!freshToken) {
    throw new Error(
      "Claude OAuth token refresh failed. Run 'claude auth login' to re-authenticate.",
    );
  }
  return freshToken;
}

// ---------------------------------------------------------------------------
// OAuth Token Refresh — calls Anthropic's OAuth endpoint directly
// ---------------------------------------------------------------------------

async function performRefresh(creds: ClaudeCredentials): Promise<string | null> {
  // Try direct OAuth refresh first
  const oauthResult = await refreshOAuthToken(creds);
  if (oauthResult) return oauthResult;

  // Fallback: CLI-based refresh
  console.log("[ClaudeAuth] OAuth refresh failed, trying CLI fallback...");
  const cliOk = await refreshViaCli();
  if (cliOk) {
    const freshCreds = await readCredentials();
    return freshCreds?.claudeAiOauth?.accessToken ?? null;
  }

  return null;
}

/**
 * Refresh token via Anthropic's OAuth endpoint directly.
 * Writes the new credentials atomically to disk.
 */
async function refreshOAuthToken(creds: ClaudeCredentials): Promise<string | null> {
  const refreshToken = creds?.claudeAiOauth?.refreshToken;
  if (!refreshToken) {
    console.error("[ClaudeAuth] No refreshToken available for OAuth refresh");
    return null;
  }

  try {
    const res = await fetch(OAUTH_TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: OAUTH_CLIENT_ID,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[ClaudeAuth] OAuth refresh failed: ${res.status} ${res.statusText}`, body);
      return null;
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const newExpiresAt = Date.now() + data.expires_in * 1000;

    // Re-read to get the latest state (another process may have updated)
    const latestCreds = await readCredentials() ?? {};
    const updatedCreds: ClaudeCredentials = {
      ...latestCreds,
      claudeAiOauth: {
        ...latestCreds.claudeAiOauth,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: newExpiresAt,
      } as ClaudeOAuth,
    };

    // Atomic write: temp file + rename
    await writeFile(CREDENTIALS_TMP_PATH, JSON.stringify(updatedCreds, null, 2), "utf-8");
    await rename(CREDENTIALS_TMP_PATH, CREDENTIALS_PATH);

    console.log("[ClaudeAuth] OAuth refresh succeeded:", {
      tokenPrefix: data.access_token.slice(0, 20) + "...",
      expiresAt: new Date(newExpiresAt).toISOString(),
    });

    return data.access_token;
  } catch (err) {
    console.error("[ClaudeAuth] OAuth refresh error:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// CLI-based refresh (fallback)
// ---------------------------------------------------------------------------

async function refreshViaCli(): Promise<boolean> {
  try {
    const output = await execClaudeCli(["auth", "status"]);
    const status = JSON.parse(output);
    if (status.loggedIn === true) {
      console.log("[ClaudeAuth] CLI refresh via 'auth status' succeeded");
      return true;
    }
  } catch (err) {
    console.warn("[ClaudeAuth] CLI 'auth status' refresh failed:", err);
  }

  try {
    const token = await execClaudeCli(["print-auth-token"], 15_000);
    if (token && token.startsWith("sk-ant-")) {
      console.log("[ClaudeAuth] CLI refresh via 'print-auth-token' succeeded");
      return true;
    }
  } catch {
    // Not available in all CLI versions
  }

  return false;
}

// ---------------------------------------------------------------------------
// Credential file helpers
// ---------------------------------------------------------------------------

async function readCredentials(): Promise<ClaudeCredentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    return JSON.parse(raw) as ClaudeCredentials;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Backward-compatible exports
// ---------------------------------------------------------------------------

/**
 * Read the Claude Code OAuth credentials from disk.
 * Delegates to getValidToken() for refresh logic.
 */
export async function getClaudeAccessToken(): Promise<string | null> {
  try {
    const token = await getValidToken();

    // Log token state for debugging
    const creds = await readCredentials();
    const oauth = creds?.claudeAiOauth;
    console.log("[ClaudeAuth] Token state:", {
      hasToken: true,
      tokenPrefix: token.slice(0, 20) + "...",
      expiresAt: oauth?.expiresAt
        ? new Date(oauth.expiresAt).toISOString()
        : "none",
      timeUntilExpiryMs: oauth?.expiresAt ? oauth.expiresAt - Date.now() : Infinity,
      isExpiredOrExpiring: false,
    });

    return token;
  } catch {
    return null;
  }
}

export async function getClaudeAuthStatus(): Promise<ClaudeAuthStatus> {
  try {
    const output = await execClaudeCli(["auth", "status"]);
    const status = JSON.parse(output);
    if (status.loggedIn) {
      return {
        authenticated: true,
        email: status.email,
        subscriptionType: status.subscriptionType,
      };
    }
    return { authenticated: false };
  } catch {
    return { authenticated: false };
  }
}

export async function isClaudeCliInstalled(): Promise<boolean> {
  try {
    await execClaudeCli(["--version"]);
    return true;
  } catch {
    return false;
  }
}

export async function startClaudeAuthLogin(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    const output = await execClaudeCli(["auth", "login"], 60_000);
    return { success: true, message: output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth login failed";
    return { success: false, message };
  }
}

export async function logoutClaude(): Promise<boolean> {
  try {
    await execClaudeCli(["auth", "logout"]);
    return true;
  } catch {
    return false;
  }
}

function execClaudeCli(
  args: string[],
  timeout = 10_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("claude", args, { timeout }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(stderr || error.message));
        return;
      }
      resolve(stdout.trim());
    });
  });
}
