import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { freestyle } from "freestyle-sandboxes";
import { TEMPLATE_REPO } from "@/lib/vars";
import { createVmForRepo } from "@/lib/adorable-vm";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import {
  type RepoMetadata,
  createConversationInRepo,
  readRepoMetadata,
  writeRepoMetadata,
} from "@/lib/repo-storage";

const ADORABLE_REPO_PREFIX = "adorable - ";

const toDisplayRepoName = (name?: string | null) => {
  if (!name) return undefined;
  return name.startsWith(ADORABLE_REPO_PREFIX)
    ? name.slice(ADORABLE_REPO_PREFIX.length)
    : name;
};

const toRepoResponse = async (repo: { id: string; name?: string | null }) => {
  const metadata = await readRepoMetadata(repo.id);
  const repoDisplayName = toDisplayRepoName(repo.name);
  const metadataDisplayName = toDisplayRepoName(metadata?.name);
  return {
    id: repo.id,
    name: repoDisplayName ?? metadataDisplayName ?? "Untitled Repo",
    metadata,
  };
};

export async function GET() {
  const { identityId, identity } = await getOrCreateIdentitySession();
  const { repositories } = await identity.permissions.git.list({ limit: 200 });

  const items = await Promise.all(
    repositories.map((repo) => toRepoResponse(repo)),
  );

  return NextResponse.json({
    identityId,
    repositories: items,
  });
}

export async function POST(req: Request) {
  const { identity } = await getOrCreateIdentitySession();

  let requestedName: string | undefined;
  let requestedConversationTitle: string | undefined;
  try {
    const payload = (await req.json()) as {
      name?: string;
      conversationTitle?: string;
    };
    const nextName = payload?.name?.trim();
    const nextConversationTitle = payload?.conversationTitle?.trim();
    requestedName = nextName ? nextName : undefined;
    requestedConversationTitle = nextConversationTitle
      ? nextConversationTitle
      : undefined;
  } catch {
    requestedName = undefined;
    requestedConversationTitle = undefined;
  }

  const { repoId } = await freestyle.git.repos.create({
    ...(requestedName
      ? { name: `${ADORABLE_REPO_PREFIX}${requestedName}` }
      : {}),
    import: {
      commitMessage: "Initial commit",
      url: TEMPLATE_REPO,
      type: "git",
    },
  });

  await identity.permissions.git.grant({
    permission: "write",
    repoId,
  });

  const vm = await createVmForRepo(repoId);

  await identity.permissions.vms.grant({
    vmId: vm.vmId,
  });

  const initialMetadata: RepoMetadata = {
    version: 1,
    vm,
    conversations: [],
    deployments: [],
  };

  await writeRepoMetadata(repoId, initialMetadata);

  const conversationId = randomUUID();
  const metadata = await createConversationInRepo(
    repoId,
    initialMetadata,
    conversationId,
    requestedConversationTitle,
  );

  return NextResponse.json({
    id: repoId,
    metadata,
    conversationId,
  });
}
