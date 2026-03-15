import { NextResponse } from "next/server";

/**
 * Terminal WebSocket endpoint.
 *
 * Next.js App Router doesn't natively support WebSocket upgrades in route handlers.
 * Instead, we use a custom server-side WebSocket setup via the Next.js custom server
 * or middleware approach.
 *
 * For the Docker deployment, the terminal WebSocket is handled by a separate
 * WebSocket server that runs alongside the Next.js server.
 *
 * This route serves as a fallback/health check endpoint.
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

  return NextResponse.json({
    status: "ok",
    message: "Terminal WebSocket available at ws://localhost:4000/ws/terminal",
    projectId,
  });
}
