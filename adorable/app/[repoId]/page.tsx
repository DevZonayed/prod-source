import { Assistant } from "../assistant";

export default async function RepoPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = await params;
  return (
    <Assistant
      initialMessages={[]}
      selectedRepoId={repoId}
      selectedConversationId={null}
    />
  );
}
