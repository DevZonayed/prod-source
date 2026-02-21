import { type UIMessage } from "ai";
import { freestyle } from "freestyle-sandboxes";

export const ADORABLE_METADATA_PATH = ".adorable/metadata.json";
export const ADORABLE_CONVERSATIONS_DIR = ".adorable/conversations";

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
  version: 1;
  vm: RepoVmMetadata;
  conversations: RepoConversationSummary[];
  deployments: RepoDeploymentSummary[];
};

const decodeBase64 = (value: string) => {
  return Buffer.from(value, "base64").toString("utf8");
};

const encodeJson = (value: unknown) => {
  return JSON.stringify(value, null, 2);
};

const getDefaultBranch = async (repoId: string) => {
  const repo = freestyle.git.repos.ref({ repoId });
  const { defaultBranch } = await repo.branches.getDefaultBranch();
  return defaultBranch;
};

const readJsonFile = async <T>(
  repoId: string,
  path: string,
): Promise<T | null> => {
  const repo = freestyle.git.repos.ref({ repoId });
  const rev = await getDefaultBranch(repoId);

  try {
    const entry = await repo.contents.get({ path, rev });
    if (entry.type !== "file") return null;
    return JSON.parse(decodeBase64(entry.content)) as T;
  } catch {
    return null;
  }
};

const writeCommit = async (
  repoId: string,
  message: string,
  files: Array<{ path: string; content: string }>,
) => {
  const repo = freestyle.git.repos.ref({ repoId });
  const branch = await getDefaultBranch(repoId);

  await repo.commits.create({
    message,
    branch,
    files,
    author: {
      name: "Adorable",
      email: "adorable@freestyle.sh",
    },
  });
};

const conversationPath = (conversationId: string) => {
  return `${ADORABLE_CONVERSATIONS_DIR}/${conversationId}.json`;
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

export const readRepoMetadata = async (
  repoId: string,
): Promise<RepoMetadata | null> => {
  const metadata = await readJsonFile<RepoMetadata>(
    repoId,
    ADORABLE_METADATA_PATH,
  );
  if (!metadata) return null;

  return {
    ...metadata,
    deployments: Array.isArray(metadata.deployments)
      ? metadata.deployments
      : [],
  };
};

export const writeRepoMetadata = async (
  repoId: string,
  metadata: RepoMetadata,
) => {
  await writeCommit(repoId, "Update adorable metadata", [
    { path: ADORABLE_METADATA_PATH, content: encodeJson(metadata) },
  ]);
};

export const createConversationInRepo = async (
  repoId: string,
  metadata: RepoMetadata,
  conversationId: string,
) => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const now = new Date().toISOString();
  const fallbackTitle = `Conversation ${latestMetadata.conversations.length + 1}`;

  const nextMetadata: RepoMetadata = {
    ...latestMetadata,
    conversations: [
      {
        id: conversationId,
        title: fallbackTitle,
        createdAt: now,
        updatedAt: now,
      },
      ...latestMetadata.conversations,
    ],
  };

  await writeCommit(repoId, "Create conversation", [
    {
      path: ADORABLE_METADATA_PATH,
      content: encodeJson(nextMetadata),
    },
    {
      path: conversationPath(conversationId),
      content: encodeJson([]),
    },
  ]);

  return nextMetadata;
};

export const readConversationMessages = async (
  repoId: string,
  conversationId: string,
): Promise<UIMessage[]> => {
  return (
    (await readJsonFile<UIMessage[]>(
      repoId,
      conversationPath(conversationId),
    )) ?? []
  );
};

export const saveConversationMessages = async (
  repoId: string,
  metadata: RepoMetadata,
  conversationId: string,
  messages: UIMessage[],
) => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const now = new Date().toISOString();

  const existing = latestMetadata.conversations.find(
    (c) => c.id === conversationId,
  );
  const fallbackTitle =
    existing?.title ??
    `Conversation ${latestMetadata.conversations.length + 1}`;
  const title = deriveConversationTitle(messages, fallbackTitle);

  const updatedConversation: RepoConversationSummary = {
    id: conversationId,
    title,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  const nextConversations = [
    updatedConversation,
    ...latestMetadata.conversations.filter((c) => c.id !== conversationId),
  ];

  const nextMetadata: RepoMetadata = {
    ...latestMetadata,
    conversations: nextConversations,
  };

  await writeCommit(repoId, "Update conversation", [
    {
      path: ADORABLE_METADATA_PATH,
      content: encodeJson(nextMetadata),
    },
    {
      path: conversationPath(conversationId),
      content: encodeJson(messages),
    },
  ]);

  return nextMetadata;
};

export const addRepoDeployment = async (
  repoId: string,
  metadata: RepoMetadata,
  deployment: RepoDeploymentSummary,
) => {
  const latestMetadata = (await readRepoMetadata(repoId)) ?? metadata;
  const nextMetadata: RepoMetadata = {
    ...latestMetadata,
    deployments: [
      deployment,
      ...latestMetadata.deployments.filter(
        (d) => d.commitSha !== deployment.commitSha,
      ),
    ],
  };

  await writeCommit(repoId, "Record deployment", [
    {
      path: ADORABLE_METADATA_PATH,
      content: encodeJson(nextMetadata),
    },
  ]);

  return nextMetadata;
};
