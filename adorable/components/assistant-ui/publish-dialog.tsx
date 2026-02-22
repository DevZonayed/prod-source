"use client";

import * as React from "react";
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
import { GlobeIcon, Loader2Icon, RocketIcon, SettingsIcon } from "lucide-react";
import type { RepoItem } from "@/lib/repo-types";

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

/* ------------------------------------------------------------------ */
/*  Publish dialog                                                     */
/* ------------------------------------------------------------------ */

export function PublishDialog({
  repo,
  onSetProductionDomain,
  onPromoteDeployment,
}: {
  repo: RepoItem;
  onSetProductionDomain: (repoId: string, domain: string) => Promise<void>;
  onPromoteDeployment: (repoId: string, deploymentId: string) => Promise<void>;
}) {
  const [isPromotingId, setIsPromotingId] = React.useState<string | null>(null);

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
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center gap-1.5 rounded-md bg-foreground px-3 py-1.5 text-xs font-medium text-background transition-colors hover:bg-foreground/90"
        >
          <RocketIcon className="size-3" />
          Publish
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Publish</DialogTitle>
          <DialogDescription>
            Manage your production domain and deployments.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Domain section */}
          <div>
            <div className="flex items-center justify-between pb-2">
              <span className="text-[11px] font-medium tracking-wider text-muted-foreground/50 uppercase">
                Domain
              </span>
              <ConfigureDomainDialog
                repo={repo}
                onSetProductionDomain={onSetProductionDomain}
              />
            </div>
            <div>
              {repo.productionDomain ? (
                <a
                  href={`https://${repo.productionDomain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-md py-1 text-sm text-foreground transition-colors hover:underline"
                >
                  <GlobeIcon className="size-3.5 shrink-0 text-emerald-500" />
                  <span className="truncate">{repo.productionDomain}</span>
                </a>
              ) : (
                <p className="py-1 text-sm text-muted-foreground/40">
                  Not configured
                </p>
              )}
            </div>
          </div>

          {/* Deployments section */}
          <div>
            <div className="pb-2">
              <span className="text-[11px] font-medium tracking-wider text-muted-foreground/50 uppercase">
                Deployments
              </span>
            </div>

            {items.length === 0 ? (
              <div className="py-2 text-sm text-muted-foreground/40">
                No deployments yet
              </div>
            ) : (
              <div className="max-h-64 space-y-px overflow-y-auto">
                {items.map((entry) => {
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
                      className="flex items-start gap-2 rounded-md px-2 py-2 transition-colors hover:bg-accent"
                    >
                      {/* Status dot */}
                      <span className="mt-[5px] flex size-3.5 shrink-0 items-center justify-center">
                        {entry.state === "deploying" ? (
                          <Loader2Icon className="size-3 animate-spin text-amber-400" />
                        ) : entry.state === "live" ? (
                          <span className="size-[7px] rounded-full bg-emerald-500" />
                        ) : entry.state === "failed" ? (
                          <span className="size-[7px] rounded-full bg-red-500" />
                        ) : (
                          <span className="size-[7px] rounded-full bg-muted-foreground/25" />
                        )}
                      </span>

                      {/* Text */}
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm leading-snug text-foreground">
                          {entry.commitMessage}
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground/60">
                          <span>{formatRelativeTime(entry.commitDate)}</span>
                          {isProduction && (
                            <>
                              <span className="opacity-40">·</span>
                              <span className="font-medium text-emerald-400">
                                prod
                              </span>
                            </>
                          )}
                          {canPromote && (
                            <>
                              <span className="opacity-40">·</span>
                              <button
                                type="button"
                                className="text-xs text-muted-foreground/60 underline-offset-2 transition-colors hover:text-foreground hover:underline disabled:opacity-50"
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
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ------------------------------------------------------------------ */
/*  Domain config dialog (nested)                                      */
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
          className="inline-flex size-5 items-center justify-center rounded text-muted-foreground/40 transition-colors hover:text-foreground"
          title="Configure production domain"
        >
          <SettingsIcon className="size-3" />
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
