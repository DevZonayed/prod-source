"use client";

import { useEffect } from "react";
import { cn } from "@/lib/utils";
import {
  FileText,
  FileCode,
  FileJson,
  FileType,
  Palette,
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Folder,
} from "lucide-react";
import type { FileEntry } from "@/hooks/use-file-system";

interface FileExplorerProps {
  tree: FileEntry[];
  loading: boolean;
  onLoadRoot: () => void;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  activeFile: string | null;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "tsx":
    case "ts":
    case "jsx":
    case "js":
      return <FileCode className="h-3.5 w-3.5 shrink-0 text-blue-400" />;
    case "json":
      return <FileJson className="h-3.5 w-3.5 shrink-0 text-yellow-400" />;
    case "css":
    case "scss":
      return <Palette className="h-3.5 w-3.5 shrink-0 text-purple-400" />;
    case "md":
    case "mdx":
      return <FileText className="h-3.5 w-3.5 shrink-0 text-zinc-400" />;
    default:
      return <FileType className="h-3.5 w-3.5 shrink-0 text-zinc-500" />;
  }
}

function FileTreeNode({
  entry,
  depth,
  onToggleDir,
  onOpenFile,
  activeFile,
}: {
  entry: FileEntry;
  depth: number;
  onToggleDir: (path: string) => void;
  onOpenFile: (path: string) => void;
  activeFile: string | null;
}) {
  const isDir = entry.type === "directory";
  const isActive = entry.path === activeFile;

  return (
    <>
      <button
        className={cn(
          "flex w-full items-center gap-1 rounded-sm px-1 py-0.5 text-left text-xs hover:bg-zinc-700/50",
          isActive && "bg-blue-600/30 text-white",
        )}
        style={{ paddingLeft: `${depth * 12 + 4}px` }}
        onClick={() => {
          if (isDir) {
            onToggleDir(entry.path);
          } else {
            onOpenFile(entry.path);
          }
        }}
      >
        {isDir ? (
          entry.expanded ? (
            <ChevronDown className="h-3 w-3 shrink-0 text-zinc-400" />
          ) : (
            <ChevronRight className="h-3 w-3 shrink-0 text-zinc-400" />
          )
        ) : (
          <span className="w-3" />
        )}
        {isDir ? (
          entry.expanded ? (
            <FolderOpen className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          ) : (
            <Folder className="h-3.5 w-3.5 shrink-0 text-amber-400" />
          )
        ) : (
          getFileIcon(entry.name)
        )}
        <span className="truncate">{entry.name}</span>
      </button>
      {isDir && entry.expanded && entry.children && (
        <>
          {entry.children.map((child) => (
            <FileTreeNode
              key={child.path}
              entry={child}
              depth={depth + 1}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              activeFile={activeFile}
            />
          ))}
        </>
      )}
    </>
  );
}

export function FileExplorer({
  tree,
  loading,
  onLoadRoot,
  onToggleDir,
  onOpenFile,
  activeFile,
}: FileExplorerProps) {
  useEffect(() => {
    onLoadRoot();
  }, [onLoadRoot]);

  return (
    <div className="flex h-full w-44 shrink-0 flex-col border-r border-zinc-700 bg-[#252526]">
      <div className="px-3 py-2 text-[9px] font-semibold uppercase tracking-wider text-zinc-500">
        Explorer
      </div>
      <div className="flex-1 overflow-y-auto px-1">
        {loading ? (
          <div className="px-2 py-4 text-xs text-zinc-500">Loading...</div>
        ) : tree.length === 0 ? (
          <div className="px-2 py-4 text-xs text-zinc-500">No files</div>
        ) : (
          tree.map((entry) => (
            <FileTreeNode
              key={entry.path}
              entry={entry}
              depth={0}
              onToggleDir={onToggleDir}
              onOpenFile={onOpenFile}
              activeFile={activeFile}
            />
          ))
        )}
      </div>
    </div>
  );
}
