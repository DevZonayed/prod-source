"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { useFileSystem } from "@/hooks/use-file-system";
import { FileExplorer } from "./file-explorer";
import { EditorTabs, type EditorTab } from "./editor-tabs";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center bg-[#1e1e1e] text-sm text-zinc-500">
      Loading editor...
    </div>
  ),
});

function getLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "ts":
    case "tsx":
      return "typescript";
    case "js":
    case "jsx":
      return "javascript";
    case "json":
      return "json";
    case "css":
      return "css";
    case "scss":
      return "scss";
    case "html":
      return "html";
    case "md":
    case "mdx":
      return "markdown";
    default:
      return "plaintext";
  }
}

interface CodeEditorProps {
  projectId: string;
}

export function CodeEditor({ projectId }: CodeEditorProps) {
  const { tree, loading, loadRoot, toggleDirectory, readFile, writeFile } =
    useFileSystem(projectId);

  const [tabs, setTabs] = useState<EditorTab[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [fileContents, setFileContents] = useState<Map<string, string>>(
    new Map(),
  );
  const saveTimerRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const openFile = useCallback(
    async (filePath: string) => {
      // Add tab if not already open
      if (!tabs.find((t) => t.path === filePath)) {
        const name = filePath.split("/").pop() || filePath;
        setTabs((prev) => [...prev, { path: filePath, name, modified: false }]);
      }
      setActiveTab(filePath);

      // Load content if not cached
      if (!fileContents.has(filePath)) {
        const content = await readFile(filePath);
        if (content !== null) {
          setFileContents((prev) => new Map(prev).set(filePath, content));
        }
      }
    },
    [tabs, fileContents, readFile],
  );

  const closeTab = useCallback(
    (filePath: string) => {
      setTabs((prev) => prev.filter((t) => t.path !== filePath));
      setFileContents((prev) => {
        const next = new Map(prev);
        next.delete(filePath);
        return next;
      });
      if (activeTab === filePath) {
        setActiveTab((prev) => {
          const remaining = tabs.filter((t) => t.path !== filePath);
          return remaining.length > 0
            ? remaining[remaining.length - 1].path
            : null;
        });
      }
    },
    [activeTab, tabs],
  );

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (!activeTab || value === undefined) return;

      setFileContents((prev) => new Map(prev).set(activeTab, value));
      setTabs((prev) =>
        prev.map((t) =>
          t.path === activeTab ? { ...t, modified: true } : t,
        ),
      );

      // Debounced save (1s)
      const existing = saveTimerRef.current.get(activeTab);
      if (existing) clearTimeout(existing);

      const filePath = activeTab;
      const timer = setTimeout(async () => {
        const ok = await writeFile(filePath, value);
        if (ok) {
          setTabs((prev) =>
            prev.map((t) =>
              t.path === filePath ? { ...t, modified: false } : t,
            ),
          );
        }
        saveTimerRef.current.delete(filePath);
      }, 1000);
      saveTimerRef.current.set(activeTab, timer);
    },
    [activeTab, writeFile],
  );

  // Ctrl+S / Cmd+S immediate save
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (!activeTab) return;
        const content = fileContents.get(activeTab);
        if (content === undefined) return;

        // Cancel pending debounced save
        const existing = saveTimerRef.current.get(activeTab);
        if (existing) {
          clearTimeout(existing);
          saveTimerRef.current.delete(activeTab);
        }

        const ok = await writeFile(activeTab, content);
        if (ok) {
          setTabs((prev) =>
            prev.map((t) =>
              t.path === activeTab ? { ...t, modified: false } : t,
            ),
          );
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [activeTab, fileContents, writeFile]);

  // Listen for AI file change events
  useEffect(() => {
    const handler = async (e: Event) => {
      const detail = (e as CustomEvent).detail as {
        path: string;
        content?: string;
      };
      if (!detail?.path) return;

      const filePath = detail.path.startsWith("/workspace")
        ? detail.path
        : `/workspace/${detail.path.replace(/^\//, "")}`;
      const name = filePath.split("/").pop() || filePath;

      // Open tab if not already open
      setTabs((prev) => {
        if (prev.find((t) => t.path === filePath)) return prev;
        return [...prev, { path: filePath, name, modified: false }];
      });
      setActiveTab(filePath);

      // Update content
      if (detail.content !== undefined) {
        setFileContents((prev) => new Map(prev).set(filePath, detail.content!));
      } else {
        // Fetch content from API
        const content = await readFile(filePath);
        if (content !== null) {
          setFileContents((prev) => new Map(prev).set(filePath, content));
        }
      }
    };

    window.addEventListener("voxel:file-changed", handler);
    return () => window.removeEventListener("voxel:file-changed", handler);
  }, [readFile]);

  const activeContent = activeTab ? fileContents.get(activeTab) ?? "" : "";

  return (
    <div className="flex h-full flex-col bg-[#1e1e1e]">
      <EditorTabs
        tabs={tabs}
        activeTab={activeTab}
        onSelect={openFile}
        onClose={closeTab}
      />
      <div className="flex min-h-0 flex-1">
        <FileExplorer
          tree={tree}
          loading={loading}
          onLoadRoot={loadRoot}
          onToggleDir={toggleDirectory}
          onOpenFile={openFile}
          activeFile={activeTab}
        />
        <div className="flex-1">
          {activeTab ? (
            <MonacoEditor
              height="100%"
              language={getLanguage(activeTab)}
              theme="vs-dark"
              value={activeContent}
              onChange={handleEditorChange}
              options={{
                fontSize: 13,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                automaticLayout: true,
                padding: { top: 8 },
              }}
            />
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-zinc-500">
              Select a file to edit
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
