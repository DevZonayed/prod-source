import { getDeploymentStatusForLatestCommit } from "@/lib/deployment-status";
import { resolveSourceRepoId } from "@/lib/repo-storage";

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
    const sourceRepoId = await resolveSourceRepoId(repoId);
    const status = await getDeploymentStatusForLatestCommit(
      sourceRepoId,
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
