import * as React from "react";
import { useAuiState } from "@assistant-ui/react";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { ThreadListPrimitive } from "@assistant-ui/react";
import { PlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

type AdorableMetadata = {
  repoId?: string;
};

type DeploymentTimelineEntry = {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  domain: string;
  url: string;
  deploymentId: string | null;
  state: "idle" | "deploying" | "live" | "failed";
};

const AdorableLogo = () => (
  <svg
    viewBox="0 0 347 280"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="size-5"
  >
    <path
      d="M70 267V235.793C37.4932 229.296 13 200.594 13 166.177C13 134.93 33.1885 108.399 61.2324 98.9148C61.9277 51.3467 100.705 13 148.438 13C183.979 13 214.554 34.2582 228.143 64.7527C234.182 63.4301 240.454 62.733 246.89 62.733C295.058 62.733 334.105 101.781 334.105 149.949C334.105 182.845 315.893 211.488 289 226.343V267"
      className="stroke-foreground"
      strokeWidth="25"
      strokeLinecap="round"
    />
    <path
      d="M146 237V267"
      className="stroke-foreground"
      strokeWidth="25"
      strokeLinecap="round"
    />
    <path
      d="M215 237V267"
      className="stroke-foreground"
      strokeWidth="25"
      strokeLinecap="round"
    />
  </svg>
);

export function ThreadListSidebar({
  ...props
}: React.ComponentProps<typeof Sidebar>) {
  const [tab, setTab] = React.useState<"threads" | "deployments">("threads");
  const metadata = useAuiState<AdorableMetadata | undefined>(({ thread }) => {
    for (let i = thread.messages.length - 1; i >= 0; i -= 1) {
      const m = thread.messages[i]?.metadata?.custom?.adorable as
        | AdorableMetadata
        | undefined;
      if (m) return m;
    }
    return undefined;
  });

  return (
    <Sidebar {...props}>
      <SidebarHeader className="relative border-b px-3 py-2.5">
        <ThreadListPrimitive.New asChild>
          <Button
            variant="ghost"
            className="flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-muted-foreground hover:text-foreground"
          >
            <span className="flex items-center gap-2">
              <AdorableLogo />
              <span className="text-[13px] font-medium">Adorable</span>
            </span>
            <PlusIcon className="size-3.5" />
          </Button>
        </ThreadListPrimitive.New>
      </SidebarHeader>
      <SidebarContent className="px-1.5 pt-1.5">
        <div className="mb-1 flex items-center gap-1 px-1">
          <button
            type="button"
            onClick={() => setTab("threads")}
            className={`h-7 rounded-md px-2 text-xs transition-colors ${
              tab === "threads"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            Threads
          </button>
          <button
            type="button"
            onClick={() => setTab("deployments")}
            className={`h-7 rounded-md px-2 text-xs transition-colors ${
              tab === "deployments"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            Deployments
          </button>
        </div>
        {tab === "threads" ? (
          <ThreadList />
        ) : (
          <DeploymentTimelineList repoId={metadata?.repoId} />
        )}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}

function DeploymentTimelineList({ repoId }: { repoId?: string }) {
  const [items, setItems] = React.useState<DeploymentTimelineEntry[]>([]);

  React.useEffect(() => {
    if (!repoId) {
      setItems([]);
      return;
    }

    let cancelled = false;

    const poll = async () => {
      try {
        const params = new URLSearchParams({ repoId, limit: "10" });
        const response = await fetch(
          `/api/deployment-timeline?${params.toString()}`,
        );
        if (!response.ok) return;
        const data = await response.json();
        if (cancelled) return;
        setItems(Array.isArray(data.timeline) ? data.timeline : []);
      } catch {}
    };

    poll();
    const interval = window.setInterval(poll, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [repoId]);

  if (!repoId) {
    return (
      <div className="px-2 py-3 text-xs text-muted-foreground">
        No project yet.
      </div>
    );
  }

  return (
    <div className="space-y-3 overflow-x-hidden overflow-y-auto px-1 pb-2">
      {items.map((entry) => (
        <div
          key={entry.commitSha}
          className="space-y-1.5 rounded-md border p-2"
        >
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-xs font-medium text-foreground hover:underline"
            title={entry.url}
          >
            {entry.domain}
          </a>
          <div
            className="truncate text-[10px] text-muted-foreground"
            title={entry.commitMessage}
          >
            {entry.commitMessage}
          </div>
          <a
            href={entry.url}
            target="_blank"
            rel="noreferrer"
            className="block h-20 cursor-pointer overflow-hidden rounded border bg-background"
            title={`Open ${entry.domain}`}
          >
            <iframe
              src={entry.url}
              className="pointer-events-none block h-[500%] w-[500%] origin-top-left scale-[0.2] border-0"
              loading="lazy"
              scrolling="no"
              title={`deployment-${entry.commitSha}`}
            />
          </a>
        </div>
      ))}
      {items.length === 0 && (
        <div className="px-2 py-3 text-xs text-muted-foreground">
          No deployments yet.
        </div>
      )}
    </div>
  );
}
