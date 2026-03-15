import { NextResponse } from "next/server";
import {
  startDevServer,
  stopDevServer,
  getDevServerStatus,
} from "@/lib/dev-server-manager";

/**
 * Dev server management endpoint.
 * GET: Check status of a project's dev server
 * POST: Start or stop a project's dev server
 */

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json(
      { error: "projectId is required" },
      { status: 400 },
    );
  }

  const status = getDevServerStatus(projectId);
  return NextResponse.json(status);
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      projectId: string;
      action: "start" | "stop";
    };

    if (!payload.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    if (payload.action === "stop") {
      const stopped = stopDevServer(payload.projectId);
      return NextResponse.json({ ok: true, stopped });
    }

    // Default: start
    const result = await startDevServer(payload.projectId);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to manage dev server",
      },
      { status: 500 },
    );
  }
}
