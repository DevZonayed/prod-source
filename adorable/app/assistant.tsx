"use client";

import { AssistantRuntimeProvider, useAuiState } from "@assistant-ui/react";
import {
  useAISDKRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { useChat } from "@ai-sdk/react";
import { type UIMessage } from "ai";
import { usePathname, useRouter } from "next/navigation";
import { Thread } from "@/components/assistant-ui/thread";
import {
  RepoSidebar,
  type RepoConversation,
  type RepoVmInfo,
} from "@/components/assistant-ui/repo-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ExternalLinkIcon,
  Loader2Icon,
  PlusIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type RepoItem = {
  id: string;
  name: string;
  vm: RepoVmInfo | null;
  conversations: RepoConversation[];
};

type DeploymentStatus = {
  state: "idle" | "deploying" | "live" | "failed";
  url: string | null;
  commitSha: string | null;
};

export const Assistant = ({
  initialMessages = [],
}: {
  initialMessages?: UIMessage[];
}) => {
  const router = useRouter();
  const pathname = usePathname();
  const pathParts = pathname.split("/").filter(Boolean);
  const routeRepoId = pathParts[0] ?? null;
  const routeConversationId = pathParts[1] ?? null;

  const [localRoute, setLocalRoute] = useState<{
    repoId: string;
    conversationId: string | null;
  } | null>(null);

  const selectedRepoId = localRoute?.repoId ?? routeRepoId;
  const selectedConversationId =
    localRoute?.conversationId ?? routeConversationId;

  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [seedMessages, setSeedMessages] =
    useState<UIMessage[]>(initialMessages);

  useEffect(() => {
    if (!localRoute) return;
    if (
      routeRepoId === localRoute.repoId &&
      routeConversationId === localRoute.conversationId
    ) {
      setLocalRoute(null);
    }
  }, [localRoute, routeConversationId, routeRepoId]);

  useEffect(() => {
    setSeedMessages(initialMessages);
  }, [initialMessages]);

  const selectedRepo = repos.find((repo) => repo.id === selectedRepoId) ?? null;

  const loadRepos = useCallback(async () => {
    const response = await fetch("/api/repos", { cache: "no-store" });
    if (!response.ok) return;
    const data = await response.json();

    const nextRepos: RepoItem[] = Array.isArray(data.repositories)
      ? data.repositories.map(
          (repo: {
            id: string;
            name?: string;
            metadata?: {
              vm?: RepoVmInfo;
              conversations?: RepoConversation[];
            };
          }) => ({
            id: repo.id,
            name: repo.name ?? "Untitled Repo",
            vm: repo.metadata?.vm ?? null,
            conversations: Array.isArray(repo.metadata?.conversations)
              ? repo.metadata!.conversations
              : [],
          }),
        )
      : [];

    setRepos(nextRepos);

    if (!selectedRepoId && nextRepos[0]?.id) {
      const repoId = nextRepos[0].id;
      const conversationId = nextRepos[0].conversations[0]?.id;
      if (conversationId) {
        router.replace(`/${repoId}/${conversationId}`);
      } else {
        router.replace(`/${repoId}`);
      }
    }
  }, [router, selectedRepoId]);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  const handleCreateRepo = useCallback(async () => {
    const response = await fetch("/api/repos", { method: "POST" });
    if (!response.ok) return;
    const data = await response.json();
    await loadRepos();

    if (data.id && data.conversationId) {
      router.push(`/${data.id}/${data.conversationId}`);
    }
  }, [loadRepos, router]);

  const handleCreateConversation = useCallback(
    async (repoId: string) => {
      router.push(`/${repoId}`);
    },
    [router],
  );

  const ensureActiveConversation = useCallback(async () => {
    if (selectedRepoId && selectedConversationId) {
      return {
        repoId: selectedRepoId,
        conversationId: selectedConversationId,
      };
    }

    if (selectedRepoId) {
      if (selectedConversationId) {
        return {
          repoId: selectedRepoId,
          conversationId: selectedConversationId,
        };
      }

      const response = await fetch(
        `/api/repos/${selectedRepoId}/conversations`,
        {
          method: "POST",
        },
      );

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

      const nextPath = `/${selectedRepoId}/${conversationId}`;
      window.history.replaceState(window.history.state, "", nextPath);
      setLocalRoute({ repoId: selectedRepoId, conversationId });
      await loadRepos();

      return {
        repoId: selectedRepoId,
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
    setLocalRoute({ repoId, conversationId });
    await loadRepos();

    return {
      repoId,
      conversationId,
    };
  }, [loadRepos, router, selectedConversationId, selectedRepoId]);

  const runtimeKey = selectedRepoId ?? "none";

  return (
    <ConversationRuntimeShell
      runtimeKey={runtimeKey}
      seedMessages={seedMessages}
      ensureActiveConversation={ensureActiveConversation}
      repos={repos}
      selectedRepoId={selectedRepoId}
      selectedConversationId={selectedConversationId}
      onSelectConversation={(repoId, conversationId) => {
        router.push(`/${repoId}/${conversationId}`);
      }}
      onCreateRepo={handleCreateRepo}
      onCreateConversation={handleCreateConversation}
      repoVm={selectedRepo?.vm ?? null}
      isConversationLoading={false}
    />
  );
};

function ConversationRuntimeShell({
  runtimeKey,
  seedMessages,
  ensureActiveConversation,
  repos,
  selectedRepoId,
  selectedConversationId,
  onSelectConversation,
  onCreateRepo,
  onCreateConversation,
  repoVm,
  isConversationLoading,
}: {
  runtimeKey: string;
  seedMessages: UIMessage[];
  ensureActiveConversation: () => Promise<{
    repoId: string;
    conversationId: string;
  }>;
  repos: RepoItem[];
  selectedRepoId: string | null;
  selectedConversationId: string | null;
  onSelectConversation: (repoId: string, conversationId: string) => void;
  onCreateRepo: () => Promise<void>;
  onCreateConversation: (repoId: string) => Promise<void>;
  repoVm: RepoVmInfo | null;
  isConversationLoading: boolean;
}) {
  const [threadState, setThreadState] = useState({
    isEmpty: true,
    isRunning: false,
  });

  const chat = useChat<UIMessage>({
    id: runtimeKey,
    transport: new AssistantChatTransport({
      api: "/api/chat", // API route
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
  });

  const runtime = useAISDKRuntime(chat);

  return (
    <SidebarProvider>
      <div className="flex h-dvh w-full pr-0.5">
        <RepoSidebar
          repos={repos}
          selectedRepoId={selectedRepoId}
          selectedConversationId={selectedConversationId}
          onSelectConversation={onSelectConversation}
          onCreateRepo={onCreateRepo}
          onCreateConversation={onCreateConversation}
        />
        <SidebarInset>
          <MainContent
            runtime={runtime}
            runtimeKey={runtimeKey}
            selectedRepoId={selectedRepoId}
            repoVm={repoVm}
            threadIsEmpty={threadState.isEmpty}
            threadIsRunning={threadState.isRunning}
            onThreadStateChange={setThreadState}
            isConversationLoading={isConversationLoading}
          />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function MainContent({
  runtime,
  runtimeKey,
  selectedRepoId,
  repoVm,
  threadIsEmpty,
  threadIsRunning,
  onThreadStateChange,
  isConversationLoading,
}: {
  runtime: ReturnType<typeof useAISDKRuntime>;
  runtimeKey: string;
  selectedRepoId: string | null;
  repoVm: RepoVmInfo | null;
  threadIsEmpty: boolean;
  threadIsRunning: boolean;
  onThreadStateChange: React.Dispatch<
    React.SetStateAction<{ isEmpty: boolean; isRunning: boolean }>
  >;
  isConversationLoading: boolean;
}) {
  const hasPreview = Boolean(repoVm?.previewUrl);
  const showPreview = hasPreview && Boolean(selectedRepoId);
  useSidebar();

  return (
    <div
      className="grid h-dvh transition-[grid-template-columns] duration-500 ease-in-out"
      style={{
        gridTemplateColumns: showPreview ? "1fr 1fr" : "1fr 0fr",
      }}
    >
      <div className="relative min-w-0 overflow-hidden">
        <AssistantRuntimeProvider key={runtimeKey} runtime={runtime}>
          <ThreadStateBridge onThreadStateChange={onThreadStateChange} />
          <SidebarTrigger className="absolute top-2.5 left-2.5 z-10" />
          {isConversationLoading ? (
            <div className="flex h-full w-full items-center justify-center">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2Icon className="size-4 animate-spin" />
                Loading conversation…
              </div>
            </div>
          ) : (
            <Thread />
          )}
        </AssistantRuntimeProvider>
      </div>
      <div
        className={cn(
          "min-w-0 overflow-hidden border-l transition-opacity duration-500",
          showPreview ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {showPreview &&
          (repoVm?.previewUrl ? (
            <AppPreview
              repoId={selectedRepoId ?? undefined}
              metadata={repoVm}
              isAgentRunning={threadIsRunning}
            />
          ) : (
            <PreviewPlaceholder />
          ))}
      </div>
    </div>
  );
}

function ThreadStateBridge({
  onThreadStateChange,
}: {
  onThreadStateChange: React.Dispatch<
    React.SetStateAction<{ isEmpty: boolean; isRunning: boolean }>
  >;
}) {
  const isEmpty = useAuiState(({ thread }) => thread.isEmpty);
  const isRunning = useAuiState(({ thread }) => thread.isRunning);

  useEffect(() => {
    onThreadStateChange({ isEmpty, isRunning });
  }, [isEmpty, isRunning, onThreadStateChange]);

  return null;
}

function DeploymentStatusBadge({
  repoId,
  isAgentRunning,
}: {
  repoId?: string;
  isAgentRunning: boolean;
}) {
  const [status, setStatus] = useState<DeploymentStatus | null>(null);

  useEffect(() => {
    if (!repoId) {
      setStatus(null);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const params = new URLSearchParams({
          repoId,
          running: isAgentRunning ? "1" : "0",
        });
        const response = await fetch(
          `/api/deployment-status?${params.toString()}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setStatus({
          state: data.state,
          url: data.url ?? null,
          commitSha: data.commitSha ?? null,
        });
      } catch {}
    };

    poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [repoId, isAgentRunning]);

  if (!status) return null;
  const show =
    status.state === "deploying" ||
    status.state === "live" ||
    status.state === "failed";
  if (!show) return null;

  const label =
    status.state === "deploying"
      ? "Deploying…"
      : status.state === "live"
        ? "Deployment live"
        : "Deployment failed";

  return (
    <div className="ml-2 inline-flex items-center gap-2 rounded-md border bg-background px-2 py-1 text-[11px] shadow-sm">
      {status.state === "deploying" && (
        <Loader2Icon className="size-3.5 animate-spin text-muted-foreground" />
      )}
      <span className="font-medium">{label}</span>
      {status.commitSha && (
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {status.commitSha.slice(0, 7)}
        </span>
      )}
      {status.state === "live" && status.url && (
        <a
          href={status.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
        >
          Open
          <ExternalLinkIcon className="size-3" />
        </a>
      )}
    </div>
  );
}

function PreviewPlaceholder() {
  return (
    <div className="flex h-full flex-col">
      {/* Browser toolbar skeleton */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-muted/20 px-2">
        <div className="size-6 rounded bg-muted-foreground/8" />
        <div className="size-6 rounded bg-muted-foreground/8" />
        <div className="size-6 rounded bg-muted-foreground/8" />
        <div className="ml-1 h-7 flex-1 rounded-md bg-muted/50" />
      </div>

      {/* Page content skeleton */}
      <div className="h-[70%] overflow-hidden p-8">
        <div className="mx-auto max-w-md space-y-8">
          {/* Nav skeleton */}
          <div className="flex items-center justify-between">
            <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
            <div className="flex gap-4">
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
              <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
            </div>
          </div>

          {/* Hero skeleton */}
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-6 w-56 animate-pulse rounded bg-muted/50" />
            <div className="h-4 w-40 animate-pulse rounded bg-muted/30" />
            <div className="mt-2 h-9 w-28 animate-pulse rounded-lg bg-muted/40" />
          </div>

          {/* Cards skeleton */}
          <div className="grid grid-cols-3 gap-3">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="space-y-2 rounded-lg border border-muted/30 p-3"
              >
                <div className="h-3 w-full animate-pulse rounded bg-muted/40" />
                <div className="h-2 w-3/4 animate-pulse rounded bg-muted/25" />
                <div className="h-2 w-1/2 animate-pulse rounded bg-muted/20" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Terminal skeleton */}
      <div className="flex h-[30%] min-h-0 flex-col border-t">
        <div className="flex h-8 shrink-0 items-center bg-muted/20 px-3">
          <div className="h-3.5 w-20 animate-pulse rounded bg-muted-foreground/10" />
        </div>
        <div className="flex-1 p-3">
          <div className="space-y-2">
            <div className="h-2.5 w-48 animate-pulse rounded bg-muted-foreground/8" />
            <div className="h-2.5 w-32 animate-pulse rounded bg-muted-foreground/6" />
          </div>
        </div>
      </div>
    </div>
  );
}

type TerminalTab = {
  id: string;
  label: string;
  url: string;
  closable: boolean;
};

function AppPreview({
  metadata,
  repoId,
  isAgentRunning,
}: {
  metadata: RepoVmInfo;
  repoId?: string;
  isAgentRunning: boolean;
}) {
  const [extraTerminals, setExtraTerminals] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState("dev-server");
  const [counter, setCounter] = useState(1);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    setIframeLoaded(false);
  }, [metadata?.previewUrl]);

  const addTerminal = useCallback(() => {
    if (!metadata?.additionalTerminalsUrl) return;
    const id = `terminal-${counter}`;
    setExtraTerminals((prev) => [
      ...prev,
      {
        id,
        label: `Terminal ${counter}`,
        url: metadata.additionalTerminalsUrl!,
        closable: true,
      },
    ]);
    setActiveTab(id);
    setCounter((c) => c + 1);
  }, [metadata?.additionalTerminalsUrl, counter]);

  const closeTerminal = useCallback(
    (id: string) => {
      setExtraTerminals((prev) => prev.filter((t) => t.id !== id));
      if (activeTab === id) setActiveTab("dev-server");
    },
    [activeTab],
  );

  const allTabs: TerminalTab[] = [
    ...(metadata?.devCommandTerminalUrl
      ? [
          {
            id: "dev-server",
            label: "Dev Server",
            url: metadata.devCommandTerminalUrl,
            closable: false,
          },
        ]
      : []),
    ...extraTerminals,
  ];

  const activeUrl = allTabs.find((t) => t.id === activeTab)?.url;

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {metadata?.previewUrl ? (
        <>
          {/* Browser toolbar + Preview */}
          <div className="relative flex h-[70%] min-h-0 flex-col">
            <BrowserToolbar
              previewUrl={metadata.previewUrl}
              iframeRef={iframeRef}
              repoId={repoId}
              isAgentRunning={isAgentRunning}
            />
            <div className="relative min-h-0 flex-1">
              {!iframeLoaded && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2Icon className="size-6 animate-spin text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground/40">
                      Loading preview…
                    </p>
                  </div>
                </div>
              )}
              <iframe
                ref={iframeRef}
                src={metadata.previewUrl}
                className={cn(
                  "h-full w-full transition-opacity duration-300",
                  iframeLoaded ? "opacity-100" : "opacity-0",
                )}
                onLoad={() => setIframeLoaded(true)}
              />
            </div>
          </div>

          {/* Terminal panel */}
          <div className="flex h-[30%] min-h-0 flex-col">
            {/* Tab bar */}
            <div className="flex shrink-0 items-center gap-0 border-y bg-[rgb(43,43,43)] px-1">
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex items-center gap-1 px-2 py-1.5 text-xs transition-colors ${
                    activeTab === tab.id
                      ? "border-b-2 border-foreground bg-[rgb(43,43,43)] text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.closable && (
                    <span
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTerminal(tab.id);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          closeTerminal(tab.id);
                        }
                      }}
                      className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-muted"
                    >
                      <XIcon className="size-3" />
                    </span>
                  )}
                </button>
              ))}

              {metadata.additionalTerminalsUrl && (
                <button
                  type="button"
                  onClick={addTerminal}
                  className="ml-1 rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="New terminal"
                >
                  <PlusIcon className="size-3.5" />
                </button>
              )}
            </div>

            {/* Terminal iframes – all rendered, only active one visible */}
            <div className="relative min-h-0 flex-1">
              {allTabs.map((tab) => (
                <iframe
                  key={tab.id}
                  src={tab.url}
                  className="absolute inset-0 h-full w-full"
                  style={{ display: activeTab === tab.id ? "block" : "none" }}
                />
              ))}
              {allTabs.length === 0 && (
                <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                  No terminal selected
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="flex h-full flex-col">
          {/* Browser toolbar skeleton */}
          <div className="flex h-10 shrink-0 items-center gap-1.5 border-b bg-muted/20 px-2">
            <div className="size-6 rounded bg-muted-foreground/8" />
            <div className="size-6 rounded bg-muted-foreground/8" />
            <div className="size-6 rounded bg-muted-foreground/8" />
            <div className="ml-1 h-7 flex-1 rounded-md bg-muted/50" />
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="flex flex-col items-center gap-3">
              <Loader2Icon className="size-6 animate-spin text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground/40">
                Starting dev server…
              </p>
            </div>
          </div>
          <div className="flex h-[30%] min-h-0 flex-col border-t">
            <div className="flex h-8 shrink-0 items-center bg-muted/20 px-3">
              <div className="h-3.5 w-20 animate-pulse rounded bg-muted-foreground/10" />
            </div>
            <div className="flex-1 p-3">
              <div className="h-2.5 w-32 animate-pulse rounded bg-muted-foreground/8" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function BrowserToolbar({
  previewUrl,
  iframeRef,
  repoId,
  isAgentRunning,
}: {
  previewUrl: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  repoId?: string;
  isAgentRunning: boolean;
}) {
  const [urlValue, setUrlValue] = useState(() => {
    try {
      return new URL(previewUrl).pathname;
    } catch {
      return "/";
    }
  });

  useEffect(() => {
    try {
      setUrlValue(new URL(previewUrl).pathname);
    } catch {
      setUrlValue("/");
    }
  }, [previewUrl]);

  const baseUrl = (() => {
    try {
      const u = new URL(previewUrl);
      return `${u.protocol}//${u.host}`;
    } catch {
      return previewUrl;
    }
  })();

  const navigate = (path: string) => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    setUrlValue(normalizedPath);
    iframe.src = `${baseUrl}${normalizedPath}`;
  };

  const handleReload = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    // eslint-disable-next-line no-self-assign
    iframe.src = iframe.src;
  };

  const handleBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {
      // cross-origin
    }
  };

  const handleForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {
      // cross-origin
    }
  };

  return (
    <div className="flex h-10 shrink-0 items-center gap-1 border-b bg-muted/20 px-2">
      <button
        type="button"
        onClick={handleBack}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Back"
      >
        <ArrowLeftIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={handleForward}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Forward"
      >
        <ArrowRightIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={handleReload}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Reload"
      >
        <RotateCwIcon className="size-3.5" />
      </button>
      <form
        className="ml-1 flex-1"
        onSubmit={(e) => {
          e.preventDefault();
          navigate(urlValue);
        }}
      >
        <input
          type="text"
          value={urlValue}
          onChange={(e) => setUrlValue(e.target.value)}
          className="h-7 w-full rounded-md bg-muted/50 px-2.5 text-xs text-foreground transition-colors outline-none focus:bg-muted focus:ring-1 focus:ring-ring"
          aria-label="URL path"
        />
      </form>
      <DeploymentStatusBadge repoId={repoId} isAgentRunning={isAgentRunning} />
    </div>
  );
}
