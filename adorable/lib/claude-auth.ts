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
    if (!oauth?.accessToken) return null;

    // Check expiry (with 5 min buffer)
    if (oauth.expiresAt && Date.now() > oauth.expiresAt - 5 * 60 * 1000) {
      // Token expired or about to expire — try refreshing
      const refreshed = await refreshClaudeAuth();
      if (!refreshed) return null;
      // Re-read after refresh
      const freshRaw = await readFile(CREDENTIALS_PATH, "utf-8");
      const freshCreds: ClaudeCredentials = JSON.parse(freshRaw);
      return freshCreds.claudeAiOauth?.accessToken ?? null;
    }

    return oauth.accessToken;
  } catch {
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
 * Refresh Claude Code auth by running a quick status check.
 * Claude CLI auto-refreshes tokens when used.
 */
async function refreshClaudeAuth(): Promise<boolean> {
  try {
    const output = await execClaudeCli(["auth", "status"]);
    const status = JSON.parse(output);
    return status.loggedIn === true;
  } catch {
    return false;
  }
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
