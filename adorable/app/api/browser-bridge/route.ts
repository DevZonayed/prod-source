import { NextRequest, NextResponse } from "next/server";
import {
  getPendingCommands,
  resolveCommand,
  type BridgeResult,
} from "@/lib/browser-bridge";

/**
 * GET /api/browser-bridge?projectId=xxx
 * Client polls this for pending browser commands.
 */
export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const commands = getPendingCommands(projectId);
  return NextResponse.json({ commands });
}

/**
 * POST /api/browser-bridge
 * Client sends back the result of a command execution.
 */
export async function POST(req: NextRequest) {
  const body = (await req.json()) as {
    commandId?: string;
    result?: BridgeResult;
  };

  if (!body.commandId || !body.result) {
    return NextResponse.json(
      { error: "commandId and result required" },
      { status: 400 },
    );
  }

  const resolved = resolveCommand(body.commandId, body.result);
  return NextResponse.json({ ok: resolved });
}
