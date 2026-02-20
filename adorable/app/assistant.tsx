"use client";

import {
  AssistantRuntimeProvider,
  AssistantCloud,
  useAuiState,
} from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Loader2Icon,
  PlusIcon,
  RotateCwIcon,
  XIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type AdorableMetadata = {
  previewUrl?: string;
  devCommandTerminalUrl?: string;
  additionalTerminalsUrl?: string;
};

const cloud = new AssistantCloud({
  baseUrl: process.env["NEXT_PUBLIC_ASSISTANT_BASE_URL"]!,
  anonymous: true,
});

export const Assistant = () => {
  const runtime = useChatRuntime({
    cloud,
    transport: new AssistantChatTransport({
      api: "/api/chat", // API route
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <ThreadListSidebar />
          <SidebarInset>
            <MainContent />
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};

function MainContent() {
  const isEmpty = useAuiState(({ thread }) => thread.isEmpty);
  const hasPreview = useAuiState(({ thread }) =>
    thread.messages.some((message) => message.metadata?.custom?.adorable),
  );

  return (
    <div
      className="grid h-dvh transition-[grid-template-columns] duration-500 ease-in-out"
      style={{
        gridTemplateColumns: !isEmpty ? "1fr 1fr" : "1fr 0fr",
      }}
    >
      <div className="min-w-0 overflow-hidden">
        <Thread />
      </div>
      <div
        className={cn(
          "min-w-0 overflow-hidden border-l transition-opacity duration-500",
          !isEmpty ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {!isEmpty && (hasPreview ? <AppPreview /> : <PreviewPlaceholder />)}
      </div>
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

function AppPreview() {
  const metadata = useAuiState<AdorableMetadata | undefined>(({ thread }) => {
    for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
      const metadata = thread.messages[i]?.metadata?.custom?.adorable as
        | AdorableMetadata
        | undefined;
      if (metadata) return metadata;
    }
    return undefined;
  });

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
            <div className="flex shrink-0 items-center gap-0 border-y bg-muted/30 px-1">
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`group flex items-center gap-1 px-3 py-1.5 text-xs transition-colors ${
                    activeTab === tab.id
                      ? "border-b-2 border-foreground bg-background text-foreground"
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
}: {
  previewUrl: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
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
    </div>
  );
}
