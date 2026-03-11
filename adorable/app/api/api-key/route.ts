import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getClaudeAuthStatus,
  getClaudeAccessToken,
} from "@/lib/claude-auth";

const COOKIE_NAME = "user-api-key";
const COOKIE_PROVIDER = "user-api-provider";
const COOKIE_MODEL = "user-model";

/** Check if a global API key is configured in the environment */
function hasGlobalKey(): boolean {
  return !!(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

/** GET – returns whether the user needs to provide a key */
export async function GET() {
  const jar = await cookies();
  const userKey = jar.get(COOKIE_NAME)?.value;
  const userProvider = jar.get(COOKIE_PROVIDER)?.value ?? "openai";
  const userModel = jar.get(COOKIE_MODEL)?.value ?? null;

  // Check Claude Code auth
  const claudeStatus = await getClaudeAuthStatus();
  const claudeToken = await getClaudeAccessToken();
  const hasClaudeCode = claudeStatus.authenticated && !!claudeToken;

  return NextResponse.json({
    hasGlobalKey: hasGlobalKey(),
    hasUserKey: !!userKey,
    hasClaudeCode,
    claudeEmail: claudeStatus.email ?? null,
    claudeSubscription: claudeStatus.subscriptionType ?? null,
    provider: userProvider,
    model: userModel,
  });
}

/** POST – save or delete the user's API key */
export async function POST(req: Request) {
  const body = (await req.json()) as {
    apiKey?: string;
    provider?: "openai" | "anthropic";
    model?: string;
    action?: "save" | "delete" | "save-model";
  };

  const jar = await cookies();

  if (body.action === "delete") {
    jar.delete(COOKIE_NAME);
    jar.delete(COOKIE_PROVIDER);
    jar.delete(COOKIE_MODEL);
    return NextResponse.json({ ok: true });
  }

  // Save just the model selection (no API key change needed)
  if (body.action === "save-model" && body.model) {
    jar.set(COOKIE_MODEL, body.model, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
    return NextResponse.json({ ok: true });
  }

  const apiKey = body.apiKey?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "API key is required" }, { status: 400 });
  }

  const provider = body.provider ?? "openai";

  // Basic validation
  if (provider === "openai" && !apiKey.startsWith("sk-")) {
    return NextResponse.json(
      { error: "OpenAI keys start with sk-" },
      { status: 400 },
    );
  }

  jar.set(COOKIE_NAME, apiKey, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365, // 1 year
    path: "/",
  });

  jar.set(COOKIE_PROVIDER, provider, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  });

  return NextResponse.json({ ok: true });
}
