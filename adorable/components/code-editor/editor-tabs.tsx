"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";

export interface EditorTab {
  path: string;
  name: string;
  modified: boolean;
}

interface EditorTabsProps {
  tabs: EditorTab[];
  activeTab: string | null;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
}

export function EditorTabs({
  tabs,
  activeTab,
  onSelect,
  onClose,
}: EditorTabsProps) {
  if (tabs.length === 0) return null;

  return (
    <div className="flex overflow-x-auto bg-[#252526]">
      {tabs.map((tab) => (
        <button
          key={tab.path}
          className={cn(
            "group flex shrink-0 items-center gap-1.5 border-t-2 px-3 py-1.5 text-xs",
            tab.path === activeTab
              ? "border-blue-500 bg-[#1e1e1e] text-white"
              : "border-transparent bg-[#2d2d2d] text-zinc-400 hover:bg-[#2a2a2a]",
          )}
          onClick={() => onSelect(tab.path)}
        >
          <span>{tab.name}</span>
          {tab.modified && (
            <span className="text-amber-400 group-hover:hidden">●</span>
          )}
          <span
            role="button"
            className={cn(
              "rounded p-0.5 hover:bg-zinc-600",
              tab.modified ? "hidden group-hover:inline-flex" : "",
            )}
            onClick={(e) => {
              e.stopPropagation();
              onClose(tab.path);
            }}
          >
            <X className="h-3 w-3" />
          </span>
        </button>
      ))}
    </div>
  );
}
