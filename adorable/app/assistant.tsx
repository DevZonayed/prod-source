"use client";

import {
  AssistantRuntimeProvider,
  AssistantCloud,
  AssistantIf,
  useAuiState,
} from "@assistant-ui/react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";

import { useState, useCallback } from "react";
import { PlusIcon, XIcon } from "lucide-react";

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
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
            </header>
            <div className="grid h-[calc(100dvh-3rem)] grid-cols-2">
              <div className="flex-1 overflow-hidden">
                <Thread />
              </div>
              <AssistantIf
                condition={({ thread }) =>
                  thread.messages.some(
                    (message) => message.metadata?.custom?.adorable,
                  )
                }
              >
                <AppPreview />
              </AssistantIf>
            </div>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};

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
          {/* Preview */}
          <div className="h-[70%] min-h-0">
            <iframe src={metadata.previewUrl} className="h-full w-full" />
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
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">loading...</p>
        </div>
      )}
    </div>
  );
}
