"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { RepoDeployment, RepoItem, RepoVmInfo } from "@/lib/repo-types";
import { ProjectConversationsProvider } from "@/lib/project-conversations-context";
import { ReposProvider } from "@/lib/repos-context";
import { PublishDialog } from "@/components/assistant-ui/publish-dialog";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronUpIcon,
  CodeIcon,
  FileTextIcon,
  Loader2Icon,
  MonitorIcon,
  PlusIcon,
  RotateCwIcon,
  TerminalIcon,
  XIcon,
} from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { useErrorDetection } from "@/hooks/use-error-detection";
import { ErrorPopup } from "@/components/assistant-ui/error-popup";
import { XTerminal } from "@/components/xterm-terminal";
import { useDevServer } from "@/hooks/use-dev-server";
import { useContainer } from "@/hooks/use-container";

type TerminalTab = {
  id: string;
  label: string;
  sessionId: string;
  closable: boolean;
};

type OptimisticMetadataDetail = {
  repoId: string;
  conversationId: string;
  repoName: string;
  conversationTitle: string;
};

type ThreadStateDetail = {
  repoId: string | null;
  isRunning: boolean;
};

type RouteEntry = {
  path: string;
  type: "page" | "api";
};

export function RepoWorkspaceShell({
  repoId,
  children,
  selectedConversationIdOverride,
}: {
  repoId: string | null;
  children: React.ReactNode;
  selectedConversationIdOverride?: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const selectedConversationId =
    selectedConversationIdOverride ??
    pathname.split("/").filter(Boolean)[1] ??
    null;

  const [repos, setRepos] = useState<RepoItem[]>([]);
  const [reposLoading, setReposLoading] = useState(true);
  const [threadIsRunning, setThreadIsRunning] = useState(false);
  const hasDeployingRepo = repos.some((repo) =>
    repo.deployments.some((deployment) => deployment.state === "deploying"),
  );

  const loadRepos = useCallback(async () => {
    const response = await fetch("/api/repos", { cache: "no-store" });
    if (!response.ok) {
      setReposLoading(false);
      return;
    }

    const data = await response.json();
    const nextRepos: RepoItem[] = Array.isArray(data.repositories)
      ? data.repositories.map(
          (repo: {
            id: string;
            name?: string;
            metadata?: {
              vm?: RepoVmInfo;
              conversations?: RepoItem["conversations"];
              deployments?: RepoDeployment[];
              productionDomain?: string | null;
              productionDeploymentId?: string | null;
            };
          }) => ({
            id: repo.id,
            name: repo.name ?? "Untitled Repo",
            vm: repo.metadata?.vm ?? null,
            conversations: Array.isArray(repo.metadata?.conversations)
              ? repo.metadata.conversations
              : [],
            deployments: Array.isArray(repo.metadata?.deployments)
              ? repo.metadata.deployments
              : [],
            productionDomain:
              typeof repo.metadata?.productionDomain === "string"
                ? repo.metadata.productionDomain
                : null,
            productionDeploymentId:
              typeof repo.metadata?.productionDeploymentId === "string"
                ? repo.metadata.productionDeploymentId
                : null,
          }),
        )
      : [];

    setRepos(nextRepos);
    setReposLoading(false);
  }, []);

  useEffect(() => {
    loadRepos();
  }, [loadRepos]);

  useEffect(() => {
    if (!repoId) return;
    loadRepos();
  }, [loadRepos, repoId]);

  useEffect(() => {
    if (!threadIsRunning && !hasDeployingRepo) return;
    const interval = window.setInterval(() => {
      void loadRepos();
    }, 10000);
    return () => {
      window.clearInterval(interval);
    };
  }, [loadRepos, threadIsRunning, hasDeployingRepo]);

  useEffect(() => {
    const handleReposUpdated = () => {
      void loadRepos();
    };

    window.addEventListener("voxel:repos-updated", handleReposUpdated);
    return () => {
      window.removeEventListener("voxel:repos-updated", handleReposUpdated);
    };
  }, [loadRepos]);

  useEffect(() => {
    const handleThreadState = (event: Event) => {
      const customEvent = event as CustomEvent<ThreadStateDetail>;
      const detail = customEvent.detail;
      if (!detail) return;
      if (repoId && detail.repoId && detail.repoId !== repoId) return;
      setThreadIsRunning(Boolean(detail.isRunning));
    };

    window.addEventListener(
      "voxel:thread-state",
      handleThreadState as EventListener,
    );
    return () => {
      window.removeEventListener(
        "voxel:thread-state",
        handleThreadState as EventListener,
      );
    };
  }, [repoId]);

  useEffect(() => {
    const handleOptimisticMetadata = (event: Event) => {
      const customEvent = event as CustomEvent<OptimisticMetadataDetail>;
      const detail = customEvent.detail;
      if (!detail?.repoId || !detail?.conversationId) return;

      const now = new Date().toISOString();

      setRepos((previous) =>
        previous.map((repo) => {
          if (repo.id !== detail.repoId) return repo;

          const hasConversation = repo.conversations.some(
            (conversation) => conversation.id === detail.conversationId,
          );

          const nextConversations = hasConversation
            ? repo.conversations.map((conversation) =>
                conversation.id === detail.conversationId
                  ? {
                      ...conversation,
                      title: detail.conversationTitle,
                      updatedAt: now,
                    }
                  : conversation,
              )
            : [
                {
                  id: detail.conversationId,
                  title: detail.conversationTitle,
                  createdAt: now,
                  updatedAt: now,
                },
                ...repo.conversations,
              ];

          return {
            ...repo,
            name: repo.name === "Untitled Repo" ? detail.repoName : repo.name,
            conversations: nextConversations,
          };
        }),
      );
    };

    window.addEventListener(
      "voxel:metadata-optimistic",
      handleOptimisticMetadata as EventListener,
    );
    return () => {
      window.removeEventListener(
        "voxel:metadata-optimistic",
        handleOptimisticMetadata as EventListener,
      );
    };
  }, []);

  const handleSelectProject = useCallback(
    (nextRepoId: string) => {
      router.push(`/${nextRepoId}`);
    },
    [router],
  );

  const selectedRepo = repoId
    ? (repos.find((repo) => repo.id === repoId) ?? null)
    : null;
  const showWorkspacePanel = Boolean(repoId);
  const isMobile = useIsMobile();
  const { latestError, fixError, dismissError } = useErrorDetection();
  const [mobileView, setMobileView] = useState<"chat" | "preview">("chat");

  // Reset to chat view when navigating away
  useEffect(() => {
    if (!repoId) setMobileView("chat");
  }, [repoId]);

  // On mobile, compute which panel to show
  const gridColumns = (() => {
    if (!showWorkspacePanel) return "1fr 0fr";
    if (isMobile) return mobileView === "chat" ? "1fr 0fr" : "0fr 1fr";
    return "2fr 3fr";
  })();

  const conversationsContextValue = useMemo(
    () => ({
      repoId,
      conversations: selectedRepo?.conversations ?? [],
      onSelectConversation: (conversationId: string) => {
        if (repoId) {
          router.push(`/${repoId}/${conversationId}`);
        }
      },
    }),
    [repoId, selectedRepo?.conversations, router],
  );

  const onSetProductionDomain = useCallback(
    async (nextRepoId: string, domain: string) => {
      const response = await fetch(
        `/api/repos/${nextRepoId}/production-domain`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ domain }),
        },
      );

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to configure production domain");
      }

      await loadRepos();
    },
    [loadRepos],
  );

  const onPromoteDeployment = useCallback(
    async (nextRepoId: string, deploymentId: string) => {
      const response = await fetch(`/api/repos/${nextRepoId}/promote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deploymentId }),
      });

      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(data?.error ?? "Failed to promote deployment");
      }

      await loadRepos();
    },
    [loadRepos],
  );

  const reposContextValue = useMemo(
    () => ({
      repos,
      isLoading: reposLoading,
      onSelectProject: handleSelectProject,
    }),
    [repos, reposLoading, handleSelectProject],
  );

  const iframeRef = useRef<HTMLIFrameElement>(null);

  return (
    <ReposProvider value={reposContextValue}>
      <ProjectConversationsProvider value={conversationsContextValue}>
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden">
          {/* Unified top bar */}
          {repoId && selectedRepo && (
            <div
              className={cn(
                "shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm transition-[grid-template-columns] duration-500 ease-in-out",
                isMobile ? "flex h-11 items-center" : "grid h-11",
              )}
              style={
                isMobile ? undefined : { gridTemplateColumns: gridColumns }
              }
            >
              {/* Left: back button */}
              {(!isMobile || mobileView === "chat") && (
                <div className="flex items-center px-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedConversationId) {
                        window.dispatchEvent(
                          new CustomEvent("voxel:go-to-repo", {
                            detail: { repoId },
                          }),
                        );
                        router.push(`/${repoId}`);
                      } else {
                        window.dispatchEvent(new Event("voxel:go-home"));
                        router.push("/");
                      }
                    }}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
                    title={
                      selectedConversationId ? "All conversations" : "All apps"
                    }
                  >
                    <ChevronLeftIcon className="size-3.5" />
                    <span className="text-sm font-medium">
                      {selectedConversationId
                        ? "All Conversations"
                        : "All Apps"}
                    </span>
                  </button>
                </div>
              )}

              {/* Mobile preview top bar: back to chat + publish */}
              {isMobile && mobileView === "preview" && (
                <div className="flex flex-1 items-center gap-1 px-2">
                  <button
                    type="button"
                    onClick={() => setMobileView("chat")}
                    className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground"
                  >
                    <ChevronLeftIcon className="size-3.5" />
                    <span className="text-sm font-medium">Chat</span>
                  </button>
                  <div className="ml-auto">
                    {selectedRepo.vm?.previewUrl && (
                      <PublishDialog
                        repo={selectedRepo}
                        onSetProductionDomain={onSetProductionDomain}
                        onPromoteDeployment={onPromoteDeployment}
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Right: browser controls + publish (desktop only) */}
              {!isMobile && (
                <div
                  className={cn(
                    "flex items-center gap-1 px-2 transition-opacity duration-500",
                    showWorkspacePanel
                      ? "opacity-100"
                      : "pointer-events-none opacity-0",
                  )}
                >
                  {showWorkspacePanel && selectedRepo.vm?.previewUrl && (
                    <BrowserControls
                      previewUrl={selectedRepo.vm.previewUrl}
                      iframeRef={iframeRef}
                      repo={selectedRepo}
                      onSetProductionDomain={onSetProductionDomain}
                      onPromoteDeployment={onPromoteDeployment}
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Main content grid */}
          <div
            className={cn(
              "grid min-h-0 flex-1",
              !isMobile &&
                "transition-[grid-template-columns] duration-500 ease-in-out",
            )}
            style={isMobile ? undefined : { gridTemplateColumns: gridColumns }}
          >
            <div
              className={cn(
                "relative min-w-0 overflow-hidden",
                isMobile && mobileView === "preview" && "hidden",
              )}
            >
              {children}
            </div>
            <div
              className={cn(
                "min-w-0 overflow-hidden",
                !isMobile && "transition-opacity duration-500",
                showWorkspacePanel && (!isMobile || mobileView === "preview")
                  ? "opacity-100"
                  : !isMobile && "pointer-events-none opacity-0",
                isMobile && mobileView === "chat" && "hidden",
              )}
            >
              {showWorkspacePanel && repoId && (
                <AppPreview
                  metadata={selectedRepo?.vm ?? null}
                  iframeRef={iframeRef}
                  repoId={repoId}
                />
              )}
            </div>
          </div>

          <ErrorPopup
            error={latestError}
            onFix={fixError}
            onDismiss={dismissError}
          />

          {/* Mobile floating toggle button */}
          {isMobile && showWorkspacePanel && (
            <button
              type="button"
              onClick={() =>
                setMobileView((v) => (v === "chat" ? "preview" : "chat"))
              }
              className="fixed right-4 bottom-20 z-50 flex size-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/20 transition-all active:scale-90"
              title={mobileView === "chat" ? "Show preview" : "Show chat"}
            >
              {mobileView === "chat" ? (
                <MonitorIcon className="size-5" />
              ) : (
                <CodeIcon className="size-5" />
              )}
            </button>
          )}
        </div>
      </ProjectConversationsProvider>
    </ReposProvider>
  );
}

function PreviewPlaceholder() {
  return (
    <div className="flex h-full flex-col p-2">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border/50 bg-background">
        <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border/30 bg-muted/10 px-3">
          <div className="flex gap-1.5">
            <div className="size-2.5 rounded-full bg-muted-foreground/15" />
            <div className="size-2.5 rounded-full bg-muted-foreground/15" />
            <div className="size-2.5 rounded-full bg-muted-foreground/15" />
          </div>
          <div className="ml-3 h-6 flex-1 rounded-lg bg-muted/30" />
        </div>

        <div className="flex-1 overflow-hidden p-8">
          <div className="mx-auto max-w-md space-y-8">
            <div className="flex items-center justify-between">
              <div className="h-4 w-20 animate-pulse rounded bg-muted/60" />
              <div className="flex gap-4">
                <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
                <div className="h-3 w-12 animate-pulse rounded bg-muted/40" />
              </div>
            </div>

            <div className="flex flex-col items-center gap-4 py-6">
              <div className="h-6 w-56 animate-pulse rounded bg-muted/50" />
              <div className="h-4 w-40 animate-pulse rounded bg-muted/30" />
              <div className="mt-2 h-9 w-28 animate-pulse rounded-lg bg-muted/40" />
            </div>

            <div className="grid grid-cols-3 gap-3">
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  className="space-y-2 rounded-lg border border-muted/20 p-3"
                >
                  <div className="h-3 w-full animate-pulse rounded bg-muted/40" />
                  <div className="h-2 w-3/4 animate-pulse rounded bg-muted/25" />
                  <div className="h-2 w-1/2 animate-pulse rounded bg-muted/20" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AppPreview({
  metadata,
  iframeRef,
  repoId,
}: {
  metadata: RepoVmInfo | null;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  repoId: string;
}) {
  const [extraTerminals, setExtraTerminals] = useState<TerminalTab[]>([]);
  const [activeTab, setActiveTab] = useState("dev-server");
  const [counter, setCounter] = useState(1);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Auto-create container, then start dev server once container is ready
  const { containerReady, loading: containerLoading, error: containerError } = useContainer(repoId);
  const { previewUrl: livePreviewUrl, running: devServerRunning, loading: devServerLoading, error: devServerError } = useDevServer(repoId, containerReady);

  // Use live URL from dev-server-manager, or fall back to metadata
  // Filter out placeholder URLs (the app's own port is not a valid preview)
  const metadataUrl = metadata?.previewUrl || null;
  const isPlaceholder = metadataUrl && (metadataUrl.includes(`:${3000}`) || metadataUrl.includes(`:${4000}`));
  const effectivePreviewUrl = livePreviewUrl || (isPlaceholder ? null : metadataUrl);

  useEffect(() => {
    setIframeLoaded(false);
  }, [effectivePreviewUrl]);

  const addTerminal = useCallback(() => {
    const id = `terminal-${counter}`;
    setExtraTerminals((prev) => [
      ...prev,
      {
        id,
        label: `Terminal ${counter}`,
        sessionId: `extra-${counter}`,
        closable: true,
      },
    ]);
    setActiveTab(id);
    setCounter((c) => c + 1);
    setTerminalOpen(true);
  }, [counter]);

  const closeTerminal = useCallback(
    (id: string) => {
      setExtraTerminals((prev) => prev.filter((t) => t.id !== id));
      if (activeTab === id) setActiveTab("dev-server");
    },
    [activeTab],
  );

  const allTabs: TerminalTab[] = [
    {
      id: "dev-server",
      label: "Dev Server",
      sessionId: "dev-server",
      closable: false,
    },
    ...extraTerminals,
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden p-2 pl-0">
      {/* Preview pane */}
      <div
        className="relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-border/50 bg-background transition-all duration-300"
        style={{ flex: terminalOpen ? "1 1 65%" : "1 1 100%" }}
      >
        {/* Loading state */}
        {(!effectivePreviewUrl || !iframeLoaded || devServerLoading || containerLoading) && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background">
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" />
                <Loader2Icon className="relative size-6 animate-spin text-muted-foreground/60" />
              </div>
              <p className="text-sm text-muted-foreground/50">
                {containerLoading
                  ? "Preparing environment..."
                  : devServerLoading || !effectivePreviewUrl
                    ? "Starting dev server..."
                    : "Loading preview..."}
              </p>
              {(containerError || devServerError) && (
                <p className="text-xs text-destructive">{containerError || devServerError}</p>
              )}
            </div>
          </div>
        )}
        {effectivePreviewUrl && (
          <iframe
            ref={iframeRef}
            src={effectivePreviewUrl}
            className={cn(
              "h-full w-full rounded-xl transition-opacity duration-500",
              iframeLoaded && !devServerLoading ? "opacity-100" : "opacity-0",
            )}
            onLoad={() => setIframeLoaded(true)}
          />
        )}
      </div>

      {/* Terminal panel */}
      <div
        className={cn(
          "flex flex-col overflow-hidden rounded-xl border border-border/50 transition-all duration-300 ease-in-out",
          terminalOpen ? "mt-2 min-h-0 flex-[0_0_35%]" : "mt-2 h-9 flex-none",
        )}
      >
        {/* Terminal header / tab bar */}
        <div className="flex shrink-0 items-center gap-0 bg-[rgb(35,35,35)] px-1">
          {/* Toggle button */}
          <button
            type="button"
            onClick={() => setTerminalOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
          >
            <TerminalIcon className="size-3.5" />
            <span>Terminal</span>
            {terminalOpen ? (
              <ChevronDownIcon className="size-3" />
            ) : (
              <ChevronUpIcon className="size-3" />
            )}
          </button>

          {terminalOpen && (
            <>
              <div className="mx-1 h-4 w-px bg-white/10" />
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "group flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs transition-all",
                    activeTab === tab.id
                      ? "bg-white/10 text-foreground"
                      : "text-muted-foreground hover:bg-white/5 hover:text-foreground",
                  )}
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
                      className="ml-0.5 rounded p-0.5 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white/10"
                    >
                      <XIcon className="size-3" />
                    </span>
                  )}
                </button>
              ))}

              <button
                type="button"
                onClick={addTerminal}
                className="ml-1 rounded-lg p-1.5 text-muted-foreground transition-all hover:bg-white/5 hover:text-foreground"
                title="New terminal"
              >
                <PlusIcon className="size-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Terminal content */}
        {terminalOpen && (
          <div className="relative min-h-0 flex-1 bg-[#09090b]">
            {allTabs.map((tab) => (
              <div
                key={tab.id}
                className="absolute inset-0"
                style={{
                  display: activeTab === tab.id ? "block" : "none",
                }}
              >
                {containerReady ? (
                  <XTerminal
                    projectId={repoId}
                    sessionId={tab.sessionId}
                    className="h-full w-full"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    {containerLoading ? "Preparing environment..." : containerError || "Waiting for container..."}
                  </div>
                )}
              </div>
            ))}
            {allTabs.length === 0 && (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                No terminal selected
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BrowserControls({
  previewUrl,
  iframeRef,
  repo,
  onSetProductionDomain,
  onPromoteDeployment,
}: {
  previewUrl: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  repo: RepoItem;
  onSetProductionDomain: (repoId: string, domain: string) => Promise<void>;
  onPromoteDeployment: (repoId: string, deploymentId: string) => Promise<void>;
}) {
  const [urlValue, setUrlValue] = useState(() => {
    try {
      return new URL(previewUrl).pathname;
    } catch {
      return "/";
    }
  });
  const [showRoutes, setShowRoutes] = useState(false);
  const [routes, setRoutes] = useState<RouteEntry[]>([]);
  const [routesLoaded, setRoutesLoaded] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setUrlValue(new URL(previewUrl).pathname);
    } catch {
      setUrlValue("/");
    }
  }, [previewUrl]);

  // Fetch routes when dropdown opens
  useEffect(() => {
    if (!showRoutes || routesLoaded) return;

    const fetchRoutes = async () => {
      try {
        const response = await fetch(`/api/repos/${repo.id}/routes`);
        if (response.ok) {
          const data = (await response.json()) as { routes?: RouteEntry[] };
          if (Array.isArray(data.routes)) {
            setRoutes(data.routes);
          }
        }
      } catch {
        // silently fail
      }
      setRoutesLoaded(true);
    };

    void fetchRoutes();
  }, [showRoutes, routesLoaded, repo.id]);

  // Refetch routes when routes panel is opened again
  useEffect(() => {
    if (showRoutes) {
      setRoutesLoaded(false);
    }
  }, [showRoutes]);

  // Close dropdown on click outside
  useEffect(() => {
    if (!showRoutes) return;
    const handleClick = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        urlInputRef.current &&
        !urlInputRef.current.contains(e.target as Node)
      ) {
        setShowRoutes(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showRoutes]);

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
    setShowRoutes(false);
  };

  const handleReload = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    iframe.src = iframe.src;
  };

  const handleBack = () => {
    try {
      iframeRef.current?.contentWindow?.history.back();
    } catch {}
  };

  const handleForward = () => {
    try {
      iframeRef.current?.contentWindow?.history.forward();
    } catch {}
  };

  const filteredRoutes = routes.filter((r) =>
    r.path.toLowerCase().includes(urlValue.toLowerCase()),
  );

  return (
    <>
      <button
        type="button"
        onClick={handleBack}
        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        title="Back"
      >
        <ArrowLeftIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={handleForward}
        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        title="Forward"
      >
        <ArrowRightIcon className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={handleReload}
        className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
        title="Reload"
      >
        <RotateCwIcon className="size-3.5" />
      </button>
      <div className="relative ml-1 flex-1">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate(urlValue);
          }}
        >
          <input
            ref={urlInputRef}
            type="text"
            value={urlValue}
            onChange={(e) => setUrlValue(e.target.value)}
            onFocus={() => setShowRoutes(true)}
            className="h-7 w-full rounded-lg bg-muted/40 px-2.5 text-xs text-foreground transition-all outline-none focus:bg-muted/60 focus:ring-1 focus:ring-ring/30"
            aria-label="URL path"
          />
        </form>

        {/* Route suggestions dropdown */}
        {showRoutes && filteredRoutes.length > 0 && (
          <div
            ref={dropdownRef}
            className="absolute top-full left-0 z-50 mt-1 w-full overflow-hidden rounded-xl border border-border/50 bg-popover shadow-xl shadow-black/20 animate-in fade-in slide-in-from-top-1 duration-150"
          >
            <div className="px-2 py-1.5">
              <p className="px-1 text-[10px] font-medium tracking-wider text-muted-foreground/60 uppercase">
                Routes
              </p>
            </div>
            <div className="max-h-48 overflow-y-auto px-1 pb-1">
              {filteredRoutes.map((route) => (
                <button
                  key={route.path}
                  type="button"
                  onClick={() => navigate(route.path)}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs transition-all hover:bg-accent",
                    urlValue === route.path
                      ? "bg-accent/50 text-foreground"
                      : "text-muted-foreground",
                  )}
                >
                  <FileTextIcon className="size-3 shrink-0 opacity-50" />
                  <span className="truncate font-mono">{route.path}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="ml-1.5">
        <PublishDialog
          repo={repo}
          onSetProductionDomain={onSetProductionDomain}
          onPromoteDeployment={onPromoteDeployment}
        />
      </div>
    </>
  );
}
