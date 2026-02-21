"use client";

import { AssistantRuntimeProvider, useAuiState } from "@assistant-ui/react";
import {
  useAISDKRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { useRouter } from "next/navigation";
import { Thread } from "@/components/assistant-ui/thread";
import { useCallback, useEffect, useState } from "react";

type ThreadState = {
  isEmpty: boolean;
  isRunning: boolean;
};

const EMPTY_MESSAGES: UIMessage[] = [];

export const Assistant = ({
  initialMessages,
  selectedRepoId = null,
  selectedConversationId = null,
  onThreadStateChange,
}: {
  initialMessages?: UIMessage[];
  selectedRepoId?: string | null;
  selectedConversationId?: string | null;
  onThreadStateChange?: (next: ThreadState) => void;
}) => {
  const router = useRouter();
  const resolvedInitialMessages = initialMessages ?? EMPTY_MESSAGES;

  const [seedMessages, setSeedMessages] = useState<UIMessage[]>(
    resolvedInitialMessages,
  );
  const [localRepoId, setLocalRepoId] = useState<string | null>(selectedRepoId);
  const [localConversationId, setLocalConversationId] = useState<string | null>(
    selectedConversationId,
  );
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);

  useEffect(() => {
    setSeedMessages(resolvedInitialMessages);
  }, [resolvedInitialMessages]);

  useEffect(() => {
    setLocalRepoId(selectedRepoId);
    setLocalConversationId(selectedConversationId);
  }, [selectedConversationId, selectedRepoId]);

  const ensureActiveConversation = useCallback(async () => {
    if (localRepoId && localConversationId) {
      return {
        repoId: localRepoId,
        conversationId: localConversationId,
      };
    }

    if (localRepoId) {
      const response = await fetch(`/api/repos/${localRepoId}/conversations`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error(
          "Failed to create a conversation for the selected repo.",
        );
      }

      const data = await response.json();
      const conversationId = data.conversationId as string | undefined;

      if (!conversationId) {
        throw new Error("Conversation creation did not return an id.");
      }

      const nextPath = `/${localRepoId}/${conversationId}`;
      window.history.replaceState(window.history.state, "", nextPath);
      setLocalConversationId(conversationId);

      return {
        repoId: localRepoId,
        conversationId,
      };
    }

    const response = await fetch("/api/repos", { method: "POST" });
    if (!response.ok) {
      throw new Error("Failed to create a repository for this chat.");
    }

    const data = await response.json();
    const repoId = data.id as string | undefined;
    const conversationId = data.conversationId as string | undefined;

    if (!repoId || !conversationId) {
      throw new Error("Repository creation did not return ids.");
    }

    const nextPath = `/${repoId}/${conversationId}`;
    window.history.replaceState(window.history.state, "", nextPath);
    setPendingRoute(nextPath);
    setLocalRepoId(repoId);
    setLocalConversationId(conversationId);

    return {
      repoId,
      conversationId,
    };
  }, [localConversationId, localRepoId]);

  const runtimeKey = "assistant-runtime";

  const handleFinish = useCallback(() => {
    if (!pendingRoute) return;
    router.replace(pendingRoute);
    setPendingRoute(null);
  }, [pendingRoute, router]);

  const chat = useChat<UIMessage>({
    id: runtimeKey,
    transport: new AssistantChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async (options) => {
        const active = await ensureActiveConversation();

        return {
          body: {
            ...options.body,
            id: options.id,
            messages: options.messages,
            trigger: options.trigger,
            messageId: options.messageId,
            metadata: options.requestMetadata,
            repoId: active.repoId,
            conversationId: active.conversationId,
          },
        };
      },
    }),
    messages: seedMessages,
    onFinish: handleFinish,
  });

  const runtime = useAISDKRuntime(chat);

  return (
    <AssistantRuntimeProvider key={runtimeKey} runtime={runtime}>
      <ThreadStateBridge onThreadStateChange={onThreadStateChange} />
      <Thread />
    </AssistantRuntimeProvider>
  );
};

function ThreadStateBridge({
  onThreadStateChange,
}: {
  onThreadStateChange?: (next: ThreadState) => void;
}) {
  const isEmpty = useAuiState(({ thread }) => thread.isEmpty);
  const isRunning = useAuiState(({ thread }) => thread.isRunning);

  useEffect(() => {
    onThreadStateChange?.({ isEmpty, isRunning });
  }, [isEmpty, isRunning, onThreadStateChange]);

  return null;
}
