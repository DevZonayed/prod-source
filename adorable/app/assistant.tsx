"use client";

import { AssistantRuntimeProvider, useAuiState } from "@assistant-ui/react";
import {
  useAISDKRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { Thread } from "@/components/assistant-ui/thread";
import { useCallback, useEffect, useRef, useState } from "react";

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
  onActiveConversationChange,
}: {
  initialMessages?: UIMessage[];
  selectedRepoId?: string | null;
  selectedConversationId?: string | null;
  onThreadStateChange?: (next: ThreadState) => void;
  onActiveConversationChange?: (repoId: string, conversationId: string) => void;
}) => {
  const resolvedInitialMessages = initialMessages ?? EMPTY_MESSAGES;

  const [seedMessages, setSeedMessages] = useState<UIMessage[]>(
    resolvedInitialMessages,
  );
  const [runtimeVersion, setRuntimeVersion] = useState(0);
  const [localRepoId, setLocalRepoId] = useState<string | null>(selectedRepoId);
  const [localConversationId, setLocalConversationId] = useState<string | null>(
    selectedConversationId,
  );
  const activeRepoIdRef = useRef<string | null>(selectedRepoId);
  const activeConversationIdRef = useRef<string | null>(selectedConversationId);
  const onActiveConversationChangeRef = useRef(onActiveConversationChange);
  const chatSessionIdRef = useRef(
    selectedConversationId
      ? `conversation:${selectedConversationId}`
      : selectedRepoId
        ? `repo:${selectedRepoId}:draft`
        : "home:draft",
  );

  useEffect(() => {
    setSeedMessages(resolvedInitialMessages);
  }, [resolvedInitialMessages]);

  useEffect(() => {
    setLocalRepoId((previous) => selectedRepoId ?? previous);
    setLocalConversationId((previous) => selectedConversationId ?? previous);
  }, [selectedConversationId, selectedRepoId]);

  useEffect(() => {
    if (selectedRepoId) {
      activeRepoIdRef.current = selectedRepoId;
    }
    if (selectedConversationId) {
      activeConversationIdRef.current = selectedConversationId;
    }
  }, [selectedConversationId, selectedRepoId]);

  useEffect(() => {
    onActiveConversationChangeRef.current = onActiveConversationChange;
  }, [onActiveConversationChange]);

  useEffect(() => {
    const handleGoHome = () => {
      setSeedMessages(EMPTY_MESSAGES);
      setLocalRepoId(null);
      setLocalConversationId(null);
      activeRepoIdRef.current = null;
      activeConversationIdRef.current = null;
      chatSessionIdRef.current = `home:draft:${Date.now()}`;
      setRuntimeVersion((version) => version + 1);
    };

    window.addEventListener("adorable:go-home", handleGoHome);
    return () => {
      window.removeEventListener("adorable:go-home", handleGoHome);
    };
  }, []);

  const ensureActiveConversation = useCallback(async () => {
    const activeRepoId = activeRepoIdRef.current;
    const activeConversationId = activeConversationIdRef.current;

    if (activeRepoId && activeConversationId) {
      return {
        repoId: activeRepoId,
        conversationId: activeConversationId,
      };
    }

    if (activeRepoId) {
      const response = await fetch(`/api/repos/${activeRepoId}/conversations`, {
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

      const nextPath = `/${activeRepoId}/${conversationId}`;
      window.history.replaceState(window.history.state, "", nextPath);
      setLocalConversationId(conversationId);
      activeConversationIdRef.current = conversationId;
      onActiveConversationChangeRef.current?.(activeRepoId, conversationId);
      window.dispatchEvent(
        new CustomEvent("adorable:active-conversation", {
          detail: { repoId: activeRepoId, conversationId },
        }),
      );

      return {
        repoId: activeRepoId,
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
    setLocalRepoId(repoId);
    setLocalConversationId(conversationId);
    activeRepoIdRef.current = repoId;
    activeConversationIdRef.current = conversationId;
    onActiveConversationChangeRef.current?.(repoId, conversationId);
    window.dispatchEvent(
      new CustomEvent("adorable:active-conversation", {
        detail: { repoId, conversationId },
      }),
    );

    return {
      repoId,
      conversationId,
    };
  }, []);

  const runtimeKey = `${chatSessionIdRef.current}:${runtimeVersion}`;

  const chat = useChat<UIMessage>({
    id: runtimeKey,
    transport: new AssistantChatTransport({
      api: "/api/chat",
      prepareSendMessagesRequest: async (options) => {
        const active = await ensureActiveConversation();

        return {
          body: {
            ...options.body,
            messages: options.messages,
            metadata: options.requestMetadata,
            id: undefined,
            trigger: "submit-message",
            messageId: undefined,
            repoId: active.repoId,
            conversationId: active.conversationId,
          },
        };
      },
    }),
    messages: seedMessages,
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
