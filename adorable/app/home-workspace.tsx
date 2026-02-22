"use client";

import { useCallback, useState } from "react";
import { Assistant } from "./assistant";
import { RepoWorkspaceShell } from "./[repoId]/repo-workspace-shell";

export function HomeWorkspace() {
  const [activeRepoId, setActiveRepoId] = useState<string | null>(null);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);

  const handleActiveConversationChange = useCallback(
    (repoId: string, conversationId: string) => {
      setActiveRepoId(repoId);
      setActiveConversationId(conversationId);
    },
    [],
  );

  return (
    <RepoWorkspaceShell
      repoId={activeRepoId}
      selectedConversationIdOverride={activeConversationId}
    >
      <Assistant
        selectedRepoId={activeRepoId}
        selectedConversationId={activeConversationId}
        onActiveConversationChange={handleActiveConversationChange}
      />
    </RepoWorkspaceShell>
  );
}
