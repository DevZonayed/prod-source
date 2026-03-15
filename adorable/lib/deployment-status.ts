/**
 * Deployment status — stubbed out for local mode.
 * No cloud deployments in local-only mode.
 */

export const DEPLOYMENT_DOMAIN_SUFFIX = "localhost";

export type DeploymentUiStatus = {
  state: "idle" | "deploying" | "live" | "failed";
  domain: string | null;
  url: string | null;
  commitSha: string | null;
  deploymentId: string | null;
  lastError: string | null;
  updatedAt: string;
};

export type DeploymentTimelineEntry = {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  domain: string;
  url: string;
  deploymentId: string | null;
  state: "idle" | "deploying" | "live" | "failed";
};

export const getLatestCommitSha = async (_repoId: string) => {
  return null;
};

export const getDomainForCommit = (_commitSha: string) => {
  return "localhost";
};

export const getDeploymentStatusForLatestCommit = async (
  _repoId: string,
  _isAgentRunning: boolean,
): Promise<DeploymentUiStatus> => {
  return {
    state: "idle",
    domain: null,
    url: null,
    commitSha: null,
    deploymentId: null,
    lastError: null,
    updatedAt: new Date().toISOString(),
  };
};

export const getDeploymentTimelineFromCommits = async (
  _repoId: string,
  _limit = 12,
): Promise<DeploymentTimelineEntry[]> => {
  return [];
};
