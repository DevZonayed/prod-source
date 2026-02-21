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

const toRepoResponse = async (repo: { id: string; name?: string | null }) => {
  const metadata = await readRepoMetadata(repo.id);
  return {
    id: repo.id,
    name: repo.name ?? "Untitled Repo",
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

export async function POST() {
  const { identity } = await getOrCreateIdentitySession();

  const { repoId } = await freestyle.git.repos.create({
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
  };

  await writeRepoMetadata(repoId, initialMetadata);

  const conversationId = randomUUID();
  const metadata = await createConversationInRepo(
    repoId,
    initialMetadata,
    conversationId,
  );

  return NextResponse.json({
    id: repoId,
    metadata,
    conversationId,
  });
}
