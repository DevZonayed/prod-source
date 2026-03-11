import { readFile } from "fs/promises";
import { execFile } from "child_process";
import { homedir } from "os";
import { join } from "path";

const CREDENTIALS_PATH = join(homedir(), ".claude", ".credentials.json");

type ClaudeCredentials = {
  claudeAiOauth?: {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
    scopes: string[];
    subscriptionType: string;
  };
};

type ClaudeAuthStatus = {
  authenticated: boolean;
  email?: string;
  subscriptionType?: string;
  expiresAt?: number;
};

/**
 * Read the Claude Code OAuth credentials from disk.
 * Returns the access token if available and not expired.
 */
export async function getClaudeAccessToken(): Promise<string | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    const creds: ClaudeCredentials = JSON.parse(raw);
    const oauth = creds.claudeAiOauth;

    if (!oauth?.accessToken) {
      console.warn("[ClaudeAuth] No accessToken found in credentials file");
      return null;
    }

    const now = Date.now();
    const timeUntilExpiry = oauth.expiresAt ? oauth.expiresAt - now : Infinity;
    const isExpired = oauth.expiresAt && now > oauth.expiresAt - 5 * 60 * 1000;

    console.log("[ClaudeAuth] Token state:", {
      hasToken: !!oauth.accessToken,
      tokenPrefix: oauth.accessToken?.slice(0, 20) + "...",
      expiresAt: oauth.expiresAt
        ? new Date(oauth.expiresAt).toISOString()
        : "none",
      timeUntilExpiryMs: timeUntilExpiry,
      isExpiredOrExpiring: isExpired,
    });

    if (isExpired) {
      console.log("[ClaudeAuth] Token expired or expiring soon, refreshing...");
      const refreshed = await refreshClaudeAuth();
      if (!refreshed) {
        console.error("[ClaudeAuth] Token refresh failed");
        return null;
      }
      // Re-read after refresh
      const freshRaw = await readFile(CREDENTIALS_PATH, "utf-8");
      const freshCreds: ClaudeCredentials = JSON.parse(freshRaw);
      const freshToken = freshCreds.claudeAiOauth?.accessToken ?? null;

      if (freshToken) {
        const freshExpiry = freshCreds.claudeAiOauth?.expiresAt;
        console.log("[ClaudeAuth] Token refreshed:", {
          tokenPrefix: freshToken.slice(0, 20) + "...",
          newExpiresAt: freshExpiry
            ? new Date(freshExpiry).toISOString()
            : "none",
          tokenChanged: freshToken !== oauth.accessToken,
        });
      } else {
        console.error(
          "[ClaudeAuth] No token in credentials after refresh",
        );
      }
      return freshToken;
    }

    return oauth.accessToken;
  } catch (err) {
    console.error("[ClaudeAuth] Failed to read credentials:", err);
    return null;
  }
}

/**
 * Check if Claude Code CLI is installed and authenticated.
 */
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

/**
 * Check if the Claude CLI is available on the system.
 */
export async function isClaudeCliInstalled(): Promise<boolean> {
  try {
    await execClaudeCli(["--version"]);
    return true;
  } catch {
    return false;
  }
}

/**
 * Trigger `claude auth login` on the server. This starts the OAuth flow.
 * In a server context it will output a URL that the user must visit.
 * Returns the child process output which contains the auth URL.
 */
export async function startClaudeAuthLogin(): Promise<{
  success: boolean;
  message: string;
}> {
  try {
    // Use script to capture TTY output from the interactive login
    const output = await execClaudeCli(["auth", "login"], 60_000);
    return { success: true, message: output };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Auth login failed";
    return { success: false, message };
  }
}

/**
 * Refresh Claude Code auth by invoking the CLI which auto-refreshes tokens.
 * Tries multiple approaches: `auth status` first, then a lightweight `--version`
 * call (which also triggers credential refresh in some CLI versions).
 */
async function refreshClaudeAuth(): Promise<boolean> {
  // Approach 1: `auth status` — triggers refresh in most CLI versions
  try {
    const output = await execClaudeCli(["auth", "status"]);
    console.log("[ClaudeAuth] Refresh via `auth status` output:", output);
    const status = JSON.parse(output);
    if (status.loggedIn === true) return true;
  } catch (err) {
    console.warn("[ClaudeAuth] `auth status` refresh failed:", err);
  }

  // Approach 2: `print-auth-token` — some CLI versions expose this
  try {
    const token = await execClaudeCli(["print-auth-token"], 15_000);
    if (token && token.startsWith("sk-ant-")) {
      console.log("[ClaudeAuth] Got fresh token via `print-auth-token`");
      return true;
    }
  } catch {
    // Not available in all CLI versions, that's fine
  }

  return false;
}

/**
 * Logout from Claude Code.
 */
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
