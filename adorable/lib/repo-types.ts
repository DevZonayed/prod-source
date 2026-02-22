export type RepoDeployment = {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  domain: string;
  url: string;
  deploymentId: string | null;
  state: "idle" | "deploying" | "live" | "failed";
};

export type RepoConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type RepoVmInfo = {
  vmId: string;
  previewUrl: string;
  devCommandTerminalUrl: string;
  additionalTerminalsUrl: string;
};

export type RepoItem = {
  id: string;
  name: string;
  vm: RepoVmInfo | null;
  conversations: RepoConversation[];
  deployments: RepoDeployment[];
  productionDomain: string | null;
  productionDeploymentId: string | null;
};
