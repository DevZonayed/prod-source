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
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";

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
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator
                orientation="vertical"
                className="mr-2 h-4 border-border"
              />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="https://www.assistant-ui.com/docs/getting-started"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Build Your Own ChatGPT UX
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Starter Template</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
            <div className="grid h-[calc(100dvh-4rem)] grid-cols-2">
              <div className="flex-1 overflow-hidden">
                <Thread />
              </div>
              {/* <AssistantIf
                condition={({ thread }) =>
                  thread.messages.some((message) =>
                    message.parts.some((part) => part.type === "tool-call"),
                  )
                }
              > */}
              <AssistantIf
                condition={({ thread }) =>
                  thread.messages[0]?.metadata?.adorable
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

function AppPreview() {
  // const toolCall = useAuiState(({ thread }) =>
  //   thread.messages
  //     .find((message) =>
  //       message.parts.find((part) => part.type === "tool-call"),
  //     )
  //     ?.parts.find((part) => part.type === "tool-call"),
  // );

  const toolCall = useAuiState(
    ({ thread }) => thread.messages[0]?.metadata?.adorable,
  );

  return (
    <div className="h-full">
      {toolCall?.url ? (
        <div className="grid h-full grid-rows-2">
          <iframe src={toolCall?.url} className="h-full w-full" />
          <iframe
            src={`https://${toolCall?.vmId}.vm.freestyle.sh/__console`}
            className="h-full w-full"
          />
        </div>
      ) : (
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">loading...</p>
        </div>
      )}
    </div>
  );
}
