"use client";

import { useState } from "react";
import {
  FolderIcon,
  FolderOpenIcon,
  GithubIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";

type DirectoryPickerMode = "default" | "custom" | "github";

type DirectoryPickerResult = {
  mode: DirectoryPickerMode;
  customDir?: string;
  githubRepoName?: string;
};

export function DirectoryPicker({
  projectName,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  onConfirm: (result: DirectoryPickerResult) => void;
  onCancel: () => void;
}) {
  const [mode, setMode] = useState<DirectoryPickerMode>("default");
  const [customPath, setCustomPath] = useState("");
  const [githubRepo, setGithubRepo] = useState("");

  const slug = projectName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    || "my-project";
  const defaultPath = `~/.voxel/projects/${slug}/`;

  const handleConfirm = () => {
    switch (mode) {
      case "default":
        onConfirm({ mode: "default" });
        break;
      case "custom":
        if (!customPath.trim()) return;
        onConfirm({ mode: "custom", customDir: customPath.trim() });
        break;
      case "github":
        if (!githubRepo.trim()) return;
        onConfirm({ mode: "github", githubRepoName: githubRepo.trim() });
        break;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="mx-4 w-full max-w-md rounded-2xl border border-border/50 bg-background p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Project Location</h2>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <XIcon className="size-4" />
          </button>
        </div>

        <p className="mb-4 text-sm text-muted-foreground">
          Choose where to create your project files.
        </p>

        <div className="space-y-2">
          {/* Default */}
          <button
            type="button"
            onClick={() => setMode("default")}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
              mode === "default"
                ? "border-primary bg-primary/5"
                : "border-border/50 hover:border-border"
            }`}
          >
            <SparklesIcon className="size-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Default location</p>
              <p className="truncate text-xs text-muted-foreground font-mono">
                {defaultPath}
              </p>
            </div>
          </button>

          {/* Custom path */}
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
              mode === "custom"
                ? "border-primary bg-primary/5"
                : "border-border/50 hover:border-border"
            }`}
          >
            <FolderOpenIcon className="size-5 shrink-0 text-orange-500" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Custom path</p>
              <p className="text-xs text-muted-foreground">
                Specify an absolute path on your machine
              </p>
            </div>
          </button>

          {mode === "custom" && (
            <input
              type="text"
              value={customPath}
              onChange={(e) => setCustomPath(e.target.value)}
              placeholder="/home/user/projects/my-app"
              className="w-full rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm font-mono outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/30"
              autoFocus
            />
          )}

          {/* GitHub */}
          <button
            type="button"
            onClick={() => setMode("github")}
            className={`flex w-full items-center gap-3 rounded-xl border p-3 text-left transition-all ${
              mode === "github"
                ? "border-primary bg-primary/5"
                : "border-border/50 hover:border-border"
            }`}
          >
            <GithubIcon className="size-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Clone from GitHub</p>
              <p className="text-xs text-muted-foreground">
                Import an existing repository
              </p>
            </div>
          </button>

          {mode === "github" && (
            <input
              type="text"
              value={githubRepo}
              onChange={(e) => setGithubRepo(e.target.value)}
              placeholder="owner/repo or https://github.com/owner/repo"
              className="w-full rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm font-mono outline-none transition-all placeholder:text-muted-foreground/40 focus:border-primary focus:ring-1 focus:ring-primary/30"
              autoFocus
            />
          )}
        </div>

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-border/50 px-4 py-2.5 text-sm font-medium text-muted-foreground transition-all hover:bg-accent hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              (mode === "custom" && !customPath.trim()) ||
              (mode === "github" && !githubRepo.trim())
            }
            className="flex-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}
