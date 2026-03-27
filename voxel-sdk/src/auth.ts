/**
 * Claude Code CLI OAuth Authentication
 *
 * Reads and auto-refreshes OAuth tokens from ~/.claude/.credentials.json.
 * This is the same mechanism the Claude Code CLI uses internally.
 */

import { readFile, writeFile, rename } from "fs/promises";
import { execFile } from "child_process";
import { homedir } from "os";
import { join } from "path";

const CREDENTIALS_PATH = join(homedir(), ".claude", ".credentials.json");
const CREDENTIALS_TMP_PATH = CREDENTIALS_PATH + ".tmp";

const OAUTH_TOKEN_ENDPOINT = "https://console.anthropic.com/api/oauth/token";
const OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";

const EXPIRY_BUFFER_MS = 5 * 60 * 1000;

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
  [key: string]: unknown;
};

let refreshLock: Promise<string | null> | null = null;

// ─── Core: getValidToken ───

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

  if (!isExpiring) return oauth.accessToken;

  if (!refreshLock) {
    refreshLock = performRefresh(creds!).finally(() => { refreshLock = null; });
  }

  const freshToken = await refreshLock;
  if (!freshToken) {
    throw new Error("Claude OAuth token refresh failed. Run 'claude auth login' to re-authenticate.");
  }
  return freshToken;
}

export async function getAccessToken(): Promise<string | null> {
  try {
    return await getValidToken();
  } catch {
    return null;
  }
}

// ─── Refresh Logic ───

async function performRefresh(creds: ClaudeCredentials): Promise<string | null> {
  const oauthResult = await refreshOAuthToken(creds);
  if (oauthResult) return oauthResult;

  const cliOk = await refreshViaCli();
  if (cliOk) {
    const freshCreds = await readCredentials();
    return freshCreds?.claudeAiOauth?.accessToken ?? null;
  }
  return null;
}

async function refreshOAuthToken(creds: ClaudeCredentials): Promise<string | null> {
  const refreshToken = creds?.claudeAiOauth?.refreshToken;
  if (!refreshToken) return null;

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

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    };

    const newExpiresAt = Date.now() + data.expires_in * 1000;
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

    await writeFile(CREDENTIALS_TMP_PATH, JSON.stringify(updatedCreds, null, 2), "utf-8");
    await rename(CREDENTIALS_TMP_PATH, CREDENTIALS_PATH);

    return data.access_token;
  } catch {
    return null;
  }
}

async function refreshViaCli(): Promise<boolean> {
  try {
    const output = await execClaudeCli(["auth", "status"]);
    const status = JSON.parse(output);
    return status.loggedIn === true;
  } catch { /* */ }

  try {
    const token = await execClaudeCli(["print-auth-token"], 15_000);
    return !!token && token.startsWith("sk-ant-");
  } catch { /* */ }

  return false;
}

// ─── Helpers ───

async function readCredentials(): Promise<ClaudeCredentials | null> {
  try {
    const raw = await readFile(CREDENTIALS_PATH, "utf-8");
    return JSON.parse(raw) as ClaudeCredentials;
  } catch {
    return null;
  }
}

function execClaudeCli(args: string[], timeout = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("claude", args, { timeout }, (error, stdout, stderr) => {
      if (error) { reject(new Error(stderr || error.message)); return; }
      resolve(stdout.trim());
    });
  });
}

// ─── Status Utilities ───

export async function getAuthStatus(): Promise<{
  authenticated: boolean;
  email?: string;
  subscriptionType?: string;
  expiresAt?: number;
}> {
  try {
    const output = await execClaudeCli(["auth", "status"]);
    const status = JSON.parse(output);
    if (status.loggedIn) {
      return { authenticated: true, email: status.email, subscriptionType: status.subscriptionType };
    }
  } catch { /* */ }
  return { authenticated: false };
}

export async function isCliInstalled(): Promise<boolean> {
  try { await execClaudeCli(["--version"]); return true; } catch { return false; }
}
