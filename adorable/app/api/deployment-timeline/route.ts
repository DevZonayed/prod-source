import { getDeploymentTimelineFromCommits } from "@/lib/deployment-status";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get("repoId");
  const limitRaw = searchParams.get("limit");
  const limit = limitRaw ? Number.parseInt(limitRaw, 10) : 12;

  if (!repoId) {
    return Response.json(
      { ok: false, error: "Missing repoId." },
      { status: 400 },
    );
  }

  try {
    const timeline = await getDeploymentTimelineFromCommits(
      repoId,
      Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 30) : 12,
    );
    return Response.json({ ok: true, timeline });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch deployment timeline.",
      },
      { status: 500 },
    );
  }
}
