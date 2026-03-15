import { Assistant } from "../../assistant";
import { RepoWelcome } from "@/components/assistant-ui/repo-welcome";
import { readConversationMessages } from "@/lib/repo-storage";
import { getProject } from "@/lib/local-storage";

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ repoId: string; conversationId: string }>;
}) {
  const { repoId, conversationId } = await params;

  const project = getProject(repoId);
  if (!project) {
    return (
      <Assistant
        initialMessages={[]}
        selectedRepoId={repoId}
        selectedConversationId={conversationId}
        welcome={<RepoWelcome />}
      />
    );
  }

  const initialMessages = await readConversationMessages(
    repoId,
    conversationId,
  );
  return (
    <Assistant
      initialMessages={initialMessages}
      selectedRepoId={repoId}
      selectedConversationId={conversationId}
      welcome={<RepoWelcome />}
    />
  );
}
