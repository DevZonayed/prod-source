"use client";

import { useState, useCallback, useEffect, useRef } from "react";

export interface FileEntry {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileEntry[];
  expanded?: boolean;
}

export function useFileSystem(projectId: string | null) {
  const [tree, setTree] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const refreshTimerRef = useRef<NodeJS.Timeout | null>(null);

  const listDirectory = useCallback(
    async (dirPath: string): Promise<FileEntry[]> => {
      if (!projectId) return [];
      try {
        const res = await fetch(
          `/api/files?projectId=${projectId}&path=${encodeURIComponent(dirPath)}`,
        );
        if (!res.ok) return [];
        const data = await res.json();
        return (data.entries || []).map((e: FileEntry) => ({
          ...e,
          children: undefined,
          expanded: false,
        }));
      } catch {
        return [];
      }
    },
    [projectId],
  );

  const loadRoot = useCallback(async () => {
    setLoading(true);
    const entries = await listDirectory("/workspace");
    setTree(entries);
    setLoading(false);
  }, [listDirectory]);

  const toggleDirectory = useCallback(
    async (dirPath: string) => {
      const toggle = async (entries: FileEntry[]): Promise<FileEntry[]> => {
        const result: FileEntry[] = [];
        for (const entry of entries) {
          if (entry.path === dirPath && entry.type === "directory") {
            if (entry.expanded) {
              result.push({ ...entry, expanded: false, children: undefined });
            } else {
              const children = await listDirectory(dirPath);
              result.push({ ...entry, expanded: true, children });
            }
          } else if (entry.children) {
            result.push({
              ...entry,
              children: await toggle(entry.children),
            });
          } else {
            result.push(entry);
          }
        }
        return result;
      };
      const updated = await toggle(tree);
      setTree(updated);
    },
    [listDirectory, tree],
  );

  const readFile = useCallback(
    async (filePath: string): Promise<string | null> => {
      if (!projectId) return null;
      try {
        const res = await fetch(
          `/api/files?projectId=${projectId}&file=${encodeURIComponent(filePath)}`,
        );
        if (!res.ok) return null;
        const data = await res.json();
        return data.content ?? null;
      } catch {
        return null;
      }
    },
    [projectId],
  );

  const writeFile = useCallback(
    async (filePath: string, content: string): Promise<boolean> => {
      if (!projectId) return false;
      try {
        const res = await fetch(
          `/api/files?projectId=${projectId}&file=${encodeURIComponent(filePath)}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
          },
        );
        return res.ok;
      } catch {
        return false;
      }
    },
    [projectId],
  );

  // Refresh tree on file change events (debounced)
  useEffect(() => {
    const handler = () => {
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
      refreshTimerRef.current = setTimeout(() => loadRoot(), 500);
    };

    window.addEventListener("voxel:file-changed", handler);
    window.addEventListener("voxel:file-deleted", handler);
    return () => {
      window.removeEventListener("voxel:file-changed", handler);
      window.removeEventListener("voxel:file-deleted", handler);
      if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    };
  }, [loadRoot]);

  return { tree, loading, loadRoot, toggleDirectory, readFile, writeFile };
}
