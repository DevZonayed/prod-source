"use client";

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
import { cn } from "@/lib/utils";
import { useRepos } from "@/lib/repos-context";
import { type FC, useState } from "react";

export const HomeWelcome: FC = () => {
  const { repos, onSelectProject } = useRepos();
  const [githubDialogOpen, setGithubDialogOpen] = useState(false);
  const [githubRepoInput, setGithubRepoInput] = useState("");
  const [githubRepoError, setGithubRepoError] = useState<string | null>(null);

  const handleUseGithubRepo = () => {
    const githubRepoName = githubRepoInput.trim();
    if (!githubRepoName.includes("/")) {
      setGithubRepoError("Repository must be in owner/repo format");
      return;
    }

    setGithubRepoError(null);
    window.dispatchEvent(
      new CustomEvent("adorable:create-from-github", {
        detail: { githubRepoName },
      }),
    );
    setGithubDialogOpen(false);
    setGithubRepoInput("");
  };

  const hasProjects = repos.length > 0;

  return (
    <div className="aui-thread-welcome-root mx-auto my-auto flex w-full max-w-(--thread-max-width) grow flex-col">
      <div className="aui-thread-welcome-center flex w-full grow flex-col items-center justify-center">
        <div className="aui-thread-welcome-message flex flex-col items-center justify-center px-4 text-center">
          <svg
            viewBox="0 0 347 280"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="mb-6 h-12 w-auto animate-in duration-500 fade-in"
          >
            <path
              d="M70 267V235.793C37.4932 229.296 13 200.594 13 166.177C13 134.93 33.1885 108.399 61.2324 98.9148C61.9277 51.3467 100.705 13 148.438 13C183.979 13 214.554 34.2582 228.143 64.7527C234.182 63.4301 240.454 62.733 246.89 62.733C295.058 62.733 334.105 101.781 334.105 149.949C334.105 182.845 315.893 211.488 289 226.343V267"
              className="stroke-foreground/15"
              strokeWidth="25"
              strokeLinecap="round"
            />
            <path
              d="M146 237V267"
              className="stroke-foreground/15"
              strokeWidth="25"
              strokeLinecap="round"
            />
            <path
              d="M215 237V267"
              className="stroke-foreground/15"
              strokeWidth="25"
              strokeLinecap="round"
            />
          </svg>
          <h1 className="aui-thread-welcome-message-inner animate-in text-2xl font-semibold tracking-tight duration-300 fade-in slide-in-from-bottom-2 md:text-3xl">
            What do you want to build?
          </h1>
          <Dialog open={githubDialogOpen} onOpenChange={setGithubDialogOpen}>
            <DialogTrigger asChild>
              <Button type="button" variant="outline" className="mt-4">
                Use GitHub Repo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Use GitHub Repo</DialogTitle>
                <DialogDescription>
                  Enter a repository in owner/repo format. If you haven't
                  installed the GitHub App yet, install it first.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  value={githubRepoInput}
                  onChange={(event) => {
                    setGithubRepoInput(event.target.value);
                    setGithubRepoError(null);
                  }}
                  placeholder="owner/repository"
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      handleUseGithubRepo();
                    }
                  }}
                />
                {githubRepoError && (
                  <p className="text-[13px] text-destructive">
                    {githubRepoError}
                  </p>
                )}
                <a
                  href="https://dash.freestyle.sh/"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block text-xs text-muted-foreground underline-offset-2 hover:underline"
                >
                  Install GitHub App (Dashboard → Git → Sync)
                </a>
              </div>
              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setGithubDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleUseGithubRepo}>
                  Create Project
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {hasProjects && (
          <div className="mt-8 w-full max-w-md animate-in px-4 delay-100 duration-300 fade-in slide-in-from-bottom-2">
            <p className="mb-3 text-center text-xs font-medium text-muted-foreground/50">
              Your projects
            </p>
            <div
              className={cn(
                "grid gap-2",
                repos.length === 1
                  ? "grid-cols-1"
                  : "grid-cols-1 sm:grid-cols-2",
              )}
            >
              {repos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  onClick={() => onSelectProject(repo.id)}
                  className="flex flex-col items-start rounded-xl border border-border/50 bg-card p-4 text-left transition-colors hover:border-border hover:bg-accent"
                >
                  <span className="w-full truncate text-sm font-medium text-foreground">
                    {repo.name}
                  </span>
                  <span className="mt-1 text-xs text-muted-foreground/60">
                    {repo.conversations.length} conversation
                    {repo.conversations.length !== 1 ? "s" : ""}
                    {repo.deployments.length > 0 && (
                      <>
                        {" "}
                        · {repo.deployments.length} deployment
                        {repo.deployments.length !== 1 ? "s" : ""}
                      </>
                    )}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
