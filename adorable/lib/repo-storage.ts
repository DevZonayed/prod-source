import { type UIMessage } from "ai";
import {
  getProject,
  listProjects,
  listConversations,
  getConversation,
  createConversation as dbCreateConversation,
  saveConversationMessages as dbSaveMessages,
  updateProject,
  type ProjectRecord,
} from "@/lib/local-storage";

// ─── Types (preserved for backward compat with frontend) ───

export type RepoVmMetadata = {
  vmId: string;
  previewUrl: string;
  devCommandTerminalUrl: string;
  additionalTerminalsUrl: string;
};

export type RepoConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type RepoDeploymentSummary = {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  domain: string;
  url: string;
  deploymentId: string | null;
  state: "idle" | "deploying" | "live" | "failed";
};

export type RepoMetadata = {
  version: 2;
  sourceRepoId: string;
  name?: string;
  vm: RepoVmMetadata;
  conversations: RepoConversationSummary[];
  deployments: RepoDeploymentSummary[];
  productionDomain: string | null;
  productionDeploymentId: string | null;
};

export const VOXEL_METADATA_PATH = "metadata.json";
export const VOXEL_CONVERSATIONS_DIR = "conversations";
export const VOXEL_WRAPPER_REPO_PREFIX = "voxel-meta - ";

// ─── Convert DB record to RepoMetadata ───

function projectToMetadata(project: ProjectRecord): RepoMetadata {
  const conversations = listConversations(project.id);

  return {
    version: 2,
    sourceRepoId: project.id,
    name: project.name,
    vm: {
      vmId: project.id,
      previewUrl: project.previewUrl || `http://localhost:${project.devPort || 4100}`,
      devCommandTerminalUrl: `ws://localhost:4000/api/terminal?projectId=${project.id}`,
      additionalTerminalsUrl: `ws://localhost:4000/api/terminal?projectId=${project.id}&session=additional`,
    },
    conversations: conversations.map((c) => ({
      id: c.id,
      title: c.title,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    })),
    deployments: [],
    productionDomain: null,
    productionDeploymentId: null,
  };
}

// ─── Public API (same signatures as before) ───

export const readRepoMetadata = async (
  repoId: string,
): Promise<RepoMetadata | null> => {
  const project = getProject(repoId);
  if (!project) return null;
  return projectToMetadata(project);
};

export const resolveSourceRepoId = async (repoId: string) => {
  return repoId;
};

export const writeRepoMetadata = async (
  repoId: string,
  metadata: RepoMetadata,
) => {
  if (metadata.name) {
    updateProject(repoId, { name: metadata.name });
  }
};

const deriveConversationTitle = (
  messages: UIMessage[] | undefined,
  fallback: string,
): string => {
  if (!Array.isArray(messages) || messages.length === 0) {
    return fallback;
  }

  const userMessage = messages.find((m) => m.role === "user");
  const textPart = userMessage?.parts?.find((part) => part.type === "text");
  const text = textPart && "text" in textPart ? textPart.text : "";
  const clean = text.trim().replace(/\s+/g, " ");
  if (!clean) return fallback;
  return clean.slice(0, 60);
};

export const createConversationInRepo = async (
  repoId: string,
  metadata: RepoMetadata,
  conversationId: string,
  initialTitle?: string,
) => {
  const normalizedTitle = initialTitle?.trim().replace(/\s+/g, " ");
  const fallbackTitle =
    normalizedTitle && normalizedTitle.length > 0
      ? normalizedTitle.slice(0, 60)
      : `Conversation ${metadata.conversations.length + 1}`;

  dbCreateConversation({
    id: conversationId,
    projectId: repoId,
    title: fallbackTitle,
  });

  return readRepoMetadata(repoId) as Promise<RepoMetadata>;
};

export const readConversationMessages = async (
  _repoId: string,
  conversationId: string,
): Promise<UIMessage[]> => {
  const conv = getConversation(conversationId);
  return conv?.messages ?? [];
};

export const saveConversationMessages = async (
  repoId: string,
  _metadata: RepoMetadata,
  conversationId: string,
  messages: UIMessage[],
) => {
  const conv = getConversation(conversationId);
  const fallbackTitle = conv?.title ?? `Conversation`;
  const title = deriveConversationTitle(messages, fallbackTitle);

  // Create conversation if it doesn't exist yet
  if (!conv) {
    dbCreateConversation({
      id: conversationId,
      projectId: repoId,
      title,
      messages,
    });
  } else {
    dbSaveMessages(conversationId, messages, title);
  }

  return readRepoMetadata(repoId);
};

// ─── Deployment stubs (no-ops in local mode) ───

export const addRepoDeployment = async (
  _repoId: string,
  metadata: RepoMetadata,
  _deployment: RepoDeploymentSummary,
) => {
  return metadata;
};

export const setRepoProductionDomain = async (
  _repoId: string,
  metadata: RepoMetadata,
  _productionDomain: string,
) => {
  return metadata;
};

export const promoteRepoDeploymentToProduction = async (
  _repoId: string,
  metadata: RepoMetadata,
  _productionDeploymentId: string,
) => {
  return metadata;
};
