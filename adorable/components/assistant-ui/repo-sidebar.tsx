import * as React from "react";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  GlobeIcon,
  ListTreeIcon,
  Loader2Icon,
  MessageSquareIcon,
  PlusIcon,
  RocketIcon,
  SettingsIcon,
} from "lucide-react";

export type RepoDeployment = {
  commitSha: string;
  commitMessage: string;
  commitDate: string;
  domain: string;
  url: string;
  deploymentId: string | null;
  state: "idle" | "deploying" | "live" | "failed";
};

export type RepoConversation = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type RepoVmInfo = {
  vmId: string;
  previewUrl: string;
  devCommandTerminalUrl: string;
  additionalTerminalsUrl: string;
};

export type RepoItem = {
  id: string;
  name: string;
  vm: RepoVmInfo | null;
  conversations: RepoConversation[];
  deployments: RepoDeployment[];
  productionDomain: string | null;
  productionDeploymentId: string | null;
};

const toDisplayConversationTitle = (title: string) => {
  return /^Conversation\s+\d+$/i.test(title.trim()) ? "" : title;
};

const formatRelativeTime = (dateString: string) => {
  const date = new Date(dateString);
  const now = Date.now();
  const diffSeconds = Math.floor((now - date.getTime()) / 1000);
  if (diffSeconds < 60) return "just now";
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
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

/* ------------------------------------------------------------------ */
/*  Main sidebar                                                       */
/* ------------------------------------------------------------------ */

export function RepoSidebar({
  repos,
  selectedRepoId,
  selectedConversationId,
  onSelectConversation,
  onCreateRepo,
  onCreateConversation,
  onSetProductionDomain,
  onPromoteDeployment,
  collapsible = "icon",
}: {
  repos: RepoItem[];
  selectedRepoId: string | null;
  selectedConversationId: string | null;
  onSelectConversation: (repoId: string, conversationId: string) => void;
  onCreateRepo: () => Promise<void>;
  onCreateConversation: (repoId: string) => Promise<void>;
  onSetProductionDomain: (repoId: string, domain: string) => Promise<void>;
  onPromoteDeployment: (repoId: string, deploymentId: string) => Promise<void>;
  collapsible?: "icon" | "offcanvas";
}) {
  const [tab, setTab] = React.useState<"threads" | "deployments">("threads");
  const [creatingRepo, setCreatingRepo] = React.useState(false);
  const [creatingConversationRepoId, setCreatingConversationRepoId] =
    React.useState<string | null>(null);
  const { open, setOpen } = useSidebar();

  const onTabClick = (nextTab: "threads" | "deployments") => {
    if (open && tab === nextTab) {
      setOpen(false);
      return;
    }
    setTab(nextTab);
    setOpen(true);
  };

  const handleCreateRepo = async () => {
    setCreatingRepo(true);
    try {
      await onCreateRepo();
    } finally {
      setCreatingRepo(false);
    }
  };

  const selectedRepo = repos.find((repo) => repo.id === selectedRepoId) ?? null;

  return (
    <Sidebar collapsible={collapsible}>
      <div className="flex h-full">
        {/* Icon rail */}
        <div className="flex w-12 shrink-0 flex-col items-center border-r py-2">
          <button
            type="button"
            onClick={() => onTabClick("threads")}
            title="Projects"
            aria-label="Projects"
            className={`mb-1 inline-flex size-8 items-center justify-center rounded-md transition-colors ${
              open && tab === "threads"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <ListTreeIcon className="size-4" />
          </button>
          <button
            type="button"
            onClick={() => onTabClick("deployments")}
            title="Deployments"
            aria-label="Deployments"
            className={`inline-flex size-8 items-center justify-center rounded-md transition-colors ${
              open && tab === "deployments"
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
            }`}
          >
            <RocketIcon className="size-4" />
          </button>
        </div>

        {/* Panel */}
        <div className="min-h-0 min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div className="flex h-full min-h-0 flex-col">
            {/* Brand header */}
            <div className="border-b px-3 py-2">
              <button
                type="button"
                className="flex h-8 w-full items-center justify-between gap-2 rounded-md px-1 text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
                onClick={handleCreateRepo}
                disabled={creatingRepo}
              >
                <span className="flex items-center gap-2">
                  <AdorableLogo />
                  <span className="text-[13px] font-medium">Adorable</span>
                </span>
                <PlusIcon className="size-4" />
              </button>
            </div>

            {/* Content */}
            <div className="min-h-0 flex-1 overflow-y-auto">
              {tab === "threads" ? (
                <ThreadsList
                  repos={repos}
                  selectedRepoId={selectedRepoId}
                  selectedConversationId={selectedConversationId}
                  onSelectConversation={onSelectConversation}
                  onCreateConversation={onCreateConversation}
                  creatingConversationRepoId={creatingConversationRepoId}
                  setCreatingConversationRepoId={setCreatingConversationRepoId}
                />
              ) : (
                <DeploymentsList
                  repo={selectedRepo}
                  onSetProductionDomain={onSetProductionDomain}
                  onPromoteDeployment={onPromoteDeployment}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Sidebar>
  );
}

/* ------------------------------------------------------------------ */
/*  Threads tab                                                        */
/* ------------------------------------------------------------------ */

function ThreadsList({
  repos,
  selectedRepoId,
  selectedConversationId,
  onSelectConversation,
  onCreateConversation,
  creatingConversationRepoId,
  setCreatingConversationRepoId,
}: {
  repos: RepoItem[];
  selectedRepoId: string | null;
  selectedConversationId: string | null;
  onSelectConversation: (repoId: string, conversationId: string) => void;
  onCreateConversation: (repoId: string) => Promise<void>;
  creatingConversationRepoId: string | null;
  setCreatingConversationRepoId: (id: string | null) => void;
}) {
  if (repos.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <p className="text-xs text-muted-foreground/50">
          No projects yet. Create one to start.
        </p>
      </div>
    );
  }

  return (
    <div>
      {repos.map((repo) => (
        <div key={repo.id}>
          {/* Repo header */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-[13px] font-medium text-foreground"
              onClick={() => {
                const first = repo.conversations[0];
                if (first) onSelectConversation(repo.id, first.id);
              }}
              title={repo.name}
            >
              {repo.name}
            </button>
            <button
              type="button"
              className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              onClick={async () => {
                setCreatingConversationRepoId(repo.id);
                try {
                  await onCreateConversation(repo.id);
                } finally {
                  setCreatingConversationRepoId(null);
                }
              }}
              disabled={creatingConversationRepoId === repo.id}
              title="New conversation"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>

          {/* Conversations */}
          {repo.conversations.length === 0 ? (
            <div className="border-b px-3 py-3 text-xs text-muted-foreground/50">
              No conversations yet.
            </div>
          ) : (
            repo.conversations.map((conversation) => {
              const isActive =
                selectedRepoId === repo.id &&
                selectedConversationId === conversation.id;
              const displayTitle = toDisplayConversationTitle(
                conversation.title,
              );

              return (
                <button
                  key={conversation.id}
                  type="button"
                  onClick={() => onSelectConversation(repo.id, conversation.id)}
                  className={`flex w-full items-center gap-2 border-b px-3 py-2 text-left transition-colors ${
                    isActive
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"
                  }`}
                >
                  <MessageSquareIcon className="size-3.5 shrink-0 opacity-40" />
                  {displayTitle ? (
                    <span className="min-w-0 flex-1 truncate text-[13px]">
                      {displayTitle}
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 truncate text-[13px] opacity-30">
                      Untitled
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Deployments tab                                                    */
/* ------------------------------------------------------------------ */

function DeploymentsList({
  repo,
  onSetProductionDomain,
  onPromoteDeployment,
}: {
  repo: RepoItem | null;
  onSetProductionDomain: (repoId: string, domain: string) => Promise<void>;
  onPromoteDeployment: (repoId: string, deploymentId: string) => Promise<void>;
}) {
  const [isPromotingId, setIsPromotingId] = React.useState<string | null>(null);

  if (!repo) {
    return (
      <div className="flex flex-1 items-center justify-center px-4 py-8">
        <p className="text-xs text-muted-foreground/50">
          Select a project to view deployments.
        </p>
      </div>
    );
  }

  const items = repo.deployments;

  const handlePromote = async (deploymentId: string) => {
    setIsPromotingId(deploymentId);
    try {
      await onPromoteDeployment(repo.id, deploymentId);
    } catch {
      // visible from state
    } finally {
      setIsPromotingId(null);
    }
  };

  return (
    <div>
      {/* Domain row — mirrors repo header style */}
      <div className="flex items-center gap-2 border-b px-3 py-2">
        {repo.productionDomain ? (
          <>
            <GlobeIcon className="size-3.5 shrink-0 text-emerald-500" />
            <a
              href={`https://${repo.productionDomain}`}
              target="_blank"
              rel="noreferrer"
              className="min-w-0 flex-1 truncate text-[13px] text-foreground hover:underline"
            >
              {repo.productionDomain}
            </a>
          </>
        ) : (
          <span className="min-w-0 flex-1 text-[13px] text-muted-foreground/50">
            No domain
          </span>
        )}
        <ConfigureDomainDialog
          repo={repo}
          onSetProductionDomain={onSetProductionDomain}
        />
      </div>

      {/* Deployment rows — same row rhythm as conversations */}
      {items.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground/50">
          No deployments yet.
        </div>
      ) : (
        items.map((entry) => {
          const isProduction =
            !!entry.deploymentId &&
            repo.productionDeploymentId === entry.deploymentId;
          const isPromoting = isPromotingId === entry.deploymentId;
          const canPromote =
            !!entry.deploymentId &&
            !!repo.productionDomain &&
            entry.state === "live" &&
            !isProduction;

          return (
            <a
              key={`${entry.commitSha}-${entry.url}`}
              href={entry.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 border-b px-3 py-2 transition-colors last:border-b-0 hover:bg-muted/30"
            >
              {/* Status indicator */}
              {entry.state === "deploying" ? (
                <Loader2Icon className="size-3.5 shrink-0 animate-spin text-amber-400" />
              ) : entry.state === "live" ? (
                <span className="flex size-3.5 shrink-0 items-center justify-center">
                  <span className="size-2 rounded-full bg-emerald-500" />
                </span>
              ) : entry.state === "failed" ? (
                <span className="flex size-3.5 shrink-0 items-center justify-center">
                  <span className="size-2 rounded-full bg-red-500" />
                </span>
              ) : (
                <span className="flex size-3.5 shrink-0 items-center justify-center">
                  <span className="size-2 rounded-full bg-muted-foreground/30" />
                </span>
              )}

              {/* Content */}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] text-foreground">
                  {entry.commitMessage}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span>{formatRelativeTime(entry.commitDate)}</span>
                  {isProduction && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <span className="text-emerald-400">prod</span>
                    </>
                  )}
                  {canPromote && (
                    <>
                      <span className="text-muted-foreground/30">·</span>
                      <button
                        type="button"
                        className="text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!entry.deploymentId) return;
                          void handlePromote(entry.deploymentId);
                        }}
                        disabled={isPromoting}
                      >
                        {isPromoting ? "promoting…" : "promote"}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </a>
          );
        })
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Domain config dialog                                               */
/* ------------------------------------------------------------------ */

function ConfigureDomainDialog({
  repo,
  onSetProductionDomain,
}: {
  repo: RepoItem;
  onSetProductionDomain: (repoId: string, domain: string) => Promise<void>;
}) {
  const [open, setOpen] = React.useState(false);
  const [domainInput, setDomainInput] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setDomainInput(repo.productionDomain ?? "");
      setError(null);
    }
  }, [open, repo.productionDomain]);

  const handleSave = async () => {
    const nextDomain = domainInput.trim().toLowerCase();
    if (!nextDomain.endsWith(".style.dev")) {
      setError("Domain must end in .style.dev");
      return;
    }

    setError(null);
    setIsSaving(true);
    try {
      await onSetProductionDomain(repo.id, nextDomain);
      setOpen(false);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save domain",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          className="shrink-0 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          title="Configure production domain"
        >
          <SettingsIcon className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Production Domain</DialogTitle>
          <DialogDescription>
            Set a custom <span className="font-medium">.style.dev</span> domain
            for your production deployments.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Input
            value={domainInput}
            onChange={(event) => {
              setDomainInput(event.target.value);
              setError(null);
            }}
            placeholder="my-app.style.dev"
            onKeyDown={(event) => {
              if (event.key === "Enter") void handleSave();
            }}
          />
          {error && <p className="text-[13px] text-destructive">{error}</p>}
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2Icon className="size-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
