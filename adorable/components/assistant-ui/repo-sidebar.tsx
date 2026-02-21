import * as React from "react";
import { Sidebar, useSidebar } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckIcon,
  CircleDashedIcon,
  ListTreeIcon,
  PlusIcon,
  RocketIcon,
  XIcon,
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

  return (
    <Sidebar collapsible={collapsible}>
      <div className="flex h-full">
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

        <div className="min-h-0 min-w-0 flex-1 group-data-[collapsible=icon]:hidden">
          <div className="flex h-full min-h-0 flex-col">
            <div className="relative border-b px-3 py-2.5">
              <Button
                variant="ghost"
                className="flex h-9 w-full items-center justify-between gap-2 rounded-lg px-2.5 text-muted-foreground hover:text-foreground"
                onClick={handleCreateRepo}
                disabled={creatingRepo}
              >
                <span className="flex items-center gap-2">
                  <AdorableLogo />
                  <span className="text-[13px] font-medium">Adorable</span>
                </span>
                <PlusIcon className="size-3.5" />
              </Button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pt-1.5">
              {tab === "threads" ? (
                <div className="space-y-2 pb-2">
                  {repos.map((repo) => (
                    <div key={repo.id} className="rounded-md border">
                      <div className="flex items-center justify-between gap-1 border-b px-2 py-1.5">
                        <button
                          type="button"
                          className="truncate text-left text-xs font-medium text-foreground"
                          onClick={() => {
                            const firstConversation = repo.conversations[0];
                            if (firstConversation) {
                              onSelectConversation(
                                repo.id,
                                firstConversation.id,
                              );
                            }
                          }}
                          title={repo.name}
                        >
                          {repo.name}
                        </button>
                        <button
                          type="button"
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
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
                          <PlusIcon className="size-3" />
                        </button>
                      </div>

                      <div className="space-y-0.5 p-1">
                        {repo.conversations.map((conversation) => {
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
                              onClick={() =>
                                onSelectConversation(repo.id, conversation.id)
                              }
                              className={`flex h-8 w-full items-center rounded-md px-2 text-left text-[12px] transition-colors ${
                                isActive
                                  ? "bg-muted text-foreground"
                                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                              }`}
                            >
                              {displayTitle ? (
                                <span className="truncate">{displayTitle}</span>
                              ) : (
                                <span className="truncate text-muted-foreground/50">
                                  &nbsp;
                                </span>
                              )}
                            </button>
                          );
                        })}

                        {repo.conversations.length === 0 && (
                          <div className="px-2 py-2 text-[11px] text-muted-foreground">
                            No conversations yet.
                          </div>
                        )}
                      </div>
                    </div>
                  ))}

                  {repos.length === 0 && (
                    <div className="px-2 py-3 text-xs text-muted-foreground">
                      No projects yet. Create one to start.
                    </div>
                  )}
                </div>
              ) : (
                <DeploymentTimelineList
                  repo={
                    repos.find((repo) => repo.id === selectedRepoId) ?? null
                  }
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

function DeploymentTimelineList({
  repo,
  onSetProductionDomain,
  onPromoteDeployment,
}: {
  repo: RepoItem | null;
  onSetProductionDomain: (repoId: string, domain: string) => Promise<void>;
  onPromoteDeployment: (repoId: string, deploymentId: string) => Promise<void>;
}) {
  const [domainInput, setDomainInput] = React.useState("");
  const [isSavingDomain, setIsSavingDomain] = React.useState(false);
  const [isPromotingId, setIsPromotingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setDomainInput(repo?.productionDomain ?? "");
    setError(null);
  }, [repo?.id, repo?.productionDomain]);

  if (!repo) {
    return (
      <div className="px-2 py-3 text-xs text-muted-foreground">
        Select a project to view deployments.
      </div>
    );
  }

  const items = repo.deployments;

  const handleSaveDomain = async () => {
    const nextDomain = domainInput.trim().toLowerCase();
    if (!nextDomain.endsWith(".style.dev")) {
      setError("Domain must end in .style.dev");
      return;
    }

    setError(null);
    setIsSavingDomain(true);
    try {
      await onSetProductionDomain(repo.id, nextDomain);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save production domain",
      );
    } finally {
      setIsSavingDomain(false);
    }
  };

  const handlePromote = async (deploymentId: string) => {
    setError(null);
    setIsPromotingId(deploymentId);
    try {
      await onPromoteDeployment(repo.id, deploymentId);
    } catch (promoteError) {
      setError(
        promoteError instanceof Error
          ? promoteError.message
          : "Failed to promote deployment",
      );
    } finally {
      setIsPromotingId(null);
    }
  };

  if (!items.length) {
    return (
      <div className="space-y-2 px-1 pb-2">
        <div className="space-y-1.5 rounded-md border p-2">
          <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
            Production domain
          </div>
          <div className="flex items-center gap-1.5">
            <Input
              value={domainInput}
              onChange={(event) => setDomainInput(event.target.value)}
              placeholder="my-app.style.dev"
              className="h-8 text-xs"
            />
            <Button
              type="button"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={handleSaveDomain}
              disabled={isSavingDomain}
            >
              Save
            </Button>
          </div>
          {error ? (
            <div className="text-[10px] text-muted-foreground">{error}</div>
          ) : (
            <div className="text-[10px] text-muted-foreground">
              Domain must end in .style.dev
            </div>
          )}
        </div>
        <div className="px-1 py-2 text-xs text-muted-foreground">
          No deployments yet.
        </div>
      </div>
    );
  }

  return (
    <div className="h-full space-y-3 overflow-x-hidden overflow-y-auto px-1 pb-2">
      <div className="space-y-1.5 rounded-md border p-2">
        <div className="text-[10px] tracking-wide text-muted-foreground uppercase">
          Production domain
        </div>
        <div className="flex items-center gap-1.5">
          <Input
            value={domainInput}
            onChange={(event) => setDomainInput(event.target.value)}
            placeholder="my-app.style.dev"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            size="sm"
            className="h-8 px-2 text-xs"
            onClick={handleSaveDomain}
            disabled={isSavingDomain}
          >
            Save
          </Button>
        </div>
        <div className="text-[10px] text-muted-foreground">
          {error
            ? error
            : repo.productionDomain
              ? `Current: ${repo.productionDomain}`
              : "Domain must end in .style.dev"}
        </div>
      </div>
      {items.map((entry) => (
        <div
          key={`${entry.commitSha}-${entry.url}`}
          className="space-y-1.5 rounded-md border p-2"
        >
          <div className="flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
            {entry.state === "deploying" ? (
              <CircleDashedIcon className="size-3 animate-spin" />
            ) : entry.state === "live" ? (
              <CheckIcon className="size-3" />
            ) : entry.state === "failed" ? (
              <XIcon className="size-3" />
            ) : (
              <RocketIcon className="size-3" />
            )}
            <span>{entry.state}</span>
          </div>
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
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-[11px]"
              onClick={() => {
                if (!entry.deploymentId) return;
                void handlePromote(entry.deploymentId);
              }}
              disabled={
                !entry.deploymentId ||
                !repo.productionDomain ||
                isPromotingId === entry.deploymentId
              }
            >
              Promote
            </Button>
            {repo.productionDeploymentId === entry.deploymentId &&
            entry.deploymentId ? (
              <span className="text-[10px] tracking-wide text-muted-foreground uppercase">
                Production
              </span>
            ) : null}
          </div>
          {entry.state === "deploying" ? (
            <div className="flex h-20 items-center justify-center rounded border bg-background">
              <div className="flex items-center gap-1.5 text-[10px] tracking-wide text-muted-foreground uppercase">
                <CircleDashedIcon className="size-3 animate-spin" />
                <span>Deploying preview…</span>
              </div>
            </div>
          ) : (
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
          )}
        </div>
      ))}
    </div>
  );
}
