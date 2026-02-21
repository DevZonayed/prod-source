import { freestyle } from "freestyle-sandboxes";

export const DEPLOYMENT_DOMAIN_SUFFIX = "commit-repo.style.dev";

export type DeploymentUiStatus = {
  state: "idle" | "deploying" | "live" | "failed";
  domain: string | null;
  url: string | null;
  commitSha: string | null;
  deploymentId: string | null;
  lastError: string | null;
  updatedAt: string;
};

export const getLatestCommitSha = async (repoId: string) => {
  const repo = freestyle.git.repos.ref({ repoId });
  const commits = await repo.commits.list({ limit: 1, order: "desc" });
  return commits.commits[0]?.sha ?? null;
};

export const getDomainForCommit = (commitSha: string) => {
  return `${commitSha.slice(0, 12)}-${DEPLOYMENT_DOMAIN_SUFFIX}`;
};

export const getDeploymentStatusForLatestCommit = async (
  repoId: string,
  isAgentRunning: boolean,
): Promise<DeploymentUiStatus> => {
  const commitSha = await getLatestCommitSha(repoId);
  const updatedAt = new Date().toISOString();

  if (!commitSha) {
    return {
      state: "idle",
      domain: null,
      url: null,
      commitSha: null,
      deploymentId: null,
      lastError: "No commits found for repository.",
      updatedAt,
    };
  }

  const domain = getDomainForCommit(commitSha);
  const { entries } = await freestyle.serverless.deployments.list({
    limit: 200,
  });

  //   console.log(entries);

  const match = entries.find((entry) => entry.domains.includes(domain));

  console.log(match);

  if (!match) {
    return {
      state: isAgentRunning ? "deploying" : "idle",
      domain,
      url: `https://${domain}`,
      commitSha,
      deploymentId: null,
      lastError: null,
      updatedAt,
    };
  }

  const state: DeploymentUiStatus["state"] =
    match.state === "deployed"
      ? "live"
      : match.state === "failed"
        ? "failed"
        : "deploying";

  return {
    state,
    domain,
    url: `https://${domain}`,
    commitSha,
    deploymentId: match.deploymentId,
    lastError: state === "failed" ? "Deployment reported failed state." : null,
    updatedAt,
  };
};
