import { NextResponse } from "next/server";
import {
  getClaudeAuthStatus,
  getClaudeAccessToken,
  isClaudeCliInstalled,
  logoutClaude,
} from "@/lib/claude-auth";

/** GET — check Claude Code auth status */
export async function GET() {
  const installed = await isClaudeCliInstalled();
  if (!installed) {
    return NextResponse.json({
      installed: false,
      authenticated: false,
      email: null,
      subscriptionType: null,
    });
  }

  const status = await getClaudeAuthStatus();
  const hasToken = !!(await getClaudeAccessToken());

  return NextResponse.json({
    installed: true,
    authenticated: status.authenticated && hasToken,
    email: status.email ?? null,
    subscriptionType: status.subscriptionType ?? null,
  });
}

/** POST — trigger login or logout */
export async function POST(req: Request) {
  const body = (await req.json()) as { action: "login" | "logout" };

  if (body.action === "logout") {
    const ok = await logoutClaude();
    return NextResponse.json({ ok });
  }

  if (body.action === "login") {
    // We can't do interactive OAuth from a server API route.
    // The user needs to run `claude auth login` in a terminal on this machine.
    // Return instructions.
    return NextResponse.json({
      ok: false,
      method: "terminal",
      instructions:
        'Run "claude auth login" in a terminal on this server to authenticate. The browser-based OAuth flow will open automatically.',
    });
  }

  return NextResponse.json({ error: "Invalid action" }, { status: 400 });
}
