import { NextResponse } from "next/server";
import { getGitHubToken, listGitHubTokens } from "@/lib/local-storage";

/**
 * GitHub integration endpoints.
 * GET: List available GitHub tokens (masked)
 * POST: Validate a GitHub token or test repo access
 */

export async function GET() {
  const tokens = listGitHubTokens();
  const masked = tokens.map((t) => ({
    id: t.id,
    label: t.label,
    tokenPreview: t.token.slice(0, 8) + "..." + t.token.slice(-4),
    createdAt: t.createdAt,
  }));

  return NextResponse.json({ tokens: masked });
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      action: string;
      tokenId?: string;
      repoUrl?: string;
    };

    if (payload.action === "validateToken") {
      if (!payload.tokenId) {
        return NextResponse.json(
          { error: "tokenId is required" },
          { status: 400 },
        );
      }

      const tokenRecord = getGitHubToken(payload.tokenId);
      if (!tokenRecord) {
        return NextResponse.json(
          { error: "Token not found" },
          { status: 404 },
        );
      }

      // Test the token by hitting the GitHub API
      try {
        const res = await fetch("https://api.github.com/user", {
          headers: {
            Authorization: `token ${tokenRecord.token}`,
            Accept: "application/vnd.github.v3+json",
          },
        });

        if (res.ok) {
          const user = (await res.json()) as { login: string };
          return NextResponse.json({
            ok: true,
            username: user.login,
          });
        } else {
          return NextResponse.json({
            ok: false,
            error: `GitHub API returned ${res.status}`,
          });
        }
      } catch (e) {
        return NextResponse.json({
          ok: false,
          error: e instanceof Error ? e.message : "Failed to validate token",
        });
      }
    }

    if (payload.action === "testRepoAccess") {
      if (!payload.tokenId || !payload.repoUrl) {
        return NextResponse.json(
          { error: "tokenId and repoUrl are required" },
          { status: 400 },
        );
      }

      const tokenRecord = getGitHubToken(payload.tokenId);
      if (!tokenRecord) {
        return NextResponse.json(
          { error: "Token not found" },
          { status: 404 },
        );
      }

      // Extract owner/repo from URL
      const match = payload.repoUrl.match(
        /github\.com[/:]([^/]+)\/([^/.]+)/,
      );
      if (!match) {
        return NextResponse.json({
          ok: false,
          error: "Invalid GitHub repo URL",
        });
      }

      const [, owner, repo] = match;
      try {
        const res = await fetch(
          `https://api.github.com/repos/${owner}/${repo}`,
          {
            headers: {
              Authorization: `token ${tokenRecord.token}`,
              Accept: "application/vnd.github.v3+json",
            },
          },
        );

        if (res.ok) {
          const repoData = (await res.json()) as {
            full_name: string;
            private: boolean;
          };
          return NextResponse.json({
            ok: true,
            fullName: repoData.full_name,
            isPrivate: repoData.private,
          });
        } else {
          return NextResponse.json({
            ok: false,
            error: `Cannot access repo (HTTP ${res.status})`,
          });
        }
      } catch (e) {
        return NextResponse.json({
          ok: false,
          error: e instanceof Error ? e.message : "Failed to test access",
        });
      }
    }

    return NextResponse.json(
      { error: `Unknown action: ${payload.action}` },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
