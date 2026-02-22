import { getDeploymentStatusForLatestCommit } from "@/lib/deployment-status";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const repoId = searchParams.get("repoId");
  const runningParam = searchParams.get("running");
  const isAgentRunning = runningParam === "1" || runningParam === "true";

  if (!repoId) {
    return Response.json(
      { ok: false, error: "Missing repoId." },
      { status: 400 },
    );
  }

  try {
    const status = await getDeploymentStatusForLatestCommit(
      repoId,
      isAgentRunning,
    );
    return Response.json({ ok: true, ...status });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch deployment status.",
      },
      { status: 500 },
    );
  }
}
