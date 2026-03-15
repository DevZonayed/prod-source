import { NextResponse } from "next/server";
import {
  getSetting,
  setSetting,
  deleteSetting,
  listGitHubTokens,
  createGitHubToken,
  deleteGitHubToken,
} from "@/lib/local-storage";
import { readConfig, updateConfig } from "@/lib/local-config";
import { randomUUID } from "crypto";

export async function GET() {
  const config = readConfig();
  const tokens = listGitHubTokens();

  // Mask token values for security
  const maskedTokens = tokens.map((t) => ({
    id: t.id,
    label: t.label,
    tokenPreview: t.token.slice(0, 8) + "..." + t.token.slice(-4),
    createdAt: t.createdAt,
  }));

  return NextResponse.json({
    config,
    githubTokens: maskedTokens,
  });
}

export async function PUT(req: Request) {
  try {
    const payload = (await req.json()) as {
      llm?: {
        provider?: string;
        openaiApiKey?: string;
        anthropicApiKey?: string;
        model?: string;
      };
      github?: {
        defaultTokenId?: string;
      };
      server?: {
        port?: number;
      };
    };

    const updated = updateConfig(payload);
    return NextResponse.json({ ok: true, config: updated });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      action: string;
      label?: string;
      token?: string;
      tokenId?: string;
      key?: string;
      value?: string;
    };

    switch (payload.action) {
      case "addGitHubToken": {
        if (!payload.label || !payload.token) {
          return NextResponse.json(
            { error: "label and token are required" },
            { status: 400 },
          );
        }
        const id = randomUUID();
        const record = createGitHubToken({
          id,
          label: payload.label,
          token: payload.token,
        });
        return NextResponse.json({
          ok: true,
          token: {
            id: record.id,
            label: record.label,
            tokenPreview:
              record.token.slice(0, 8) + "..." + record.token.slice(-4),
            createdAt: record.createdAt,
          },
        });
      }

      case "removeGitHubToken": {
        if (!payload.tokenId) {
          return NextResponse.json(
            { error: "tokenId is required" },
            { status: 400 },
          );
        }
        deleteGitHubToken(payload.tokenId);
        return NextResponse.json({ ok: true });
      }

      case "setSetting": {
        if (!payload.key || payload.value === undefined) {
          return NextResponse.json(
            { error: "key and value are required" },
            { status: 400 },
          );
        }
        setSetting(payload.key, payload.value);
        return NextResponse.json({ ok: true });
      }

      case "deleteSetting": {
        if (!payload.key) {
          return NextResponse.json(
            { error: "key is required" },
            { status: 400 },
          );
        }
        deleteSetting(payload.key);
        return NextResponse.json({ ok: true });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${payload.action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid request" },
      { status: 400 },
    );
  }
}
