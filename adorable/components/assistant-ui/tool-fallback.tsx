"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  WrenchIcon,
  XIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Prettify raw tool names for display.
 * e.g. "mcp__voxel-vm__view_file" → "View File"
 *      "run_command" → "Run Command"
 *      "ToolSearch" → "Tool Search"
 */
const prettifyToolName = (name: string): string => {
  // Strip MCP prefixes
  let clean = name.replace(/^mcp__[^_]+__/, "");
  // Convert snake_case or camelCase to words
  clean = clean
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/Tool$/i, "");
  // Capitalize first letter of each word
  return clean
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ")
    .trim() || name;
};

export const ToolFallback: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const [open, setOpen] = useState(false);
  const running = status?.type === "running";
  const failed = status?.type === "incomplete" && status.reason === "cancelled";
  const displayName = prettifyToolName(toolName);

  return (
    <div className="my-0.5 block w-full">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "group flex w-full max-w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted/60",
          failed && "text-red-500",
        )}
      >
        <span className="flex w-4 shrink-0 items-center justify-center">
          {running ? (
            <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
          ) : failed ? (
            <XIcon className="size-3.5 shrink-0 text-red-500" />
          ) : (
            <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
          )}
        </span>

        <WrenchIcon className="size-3.5 shrink-0 text-muted-foreground" />
        <span className="shrink-0 font-medium">{displayName}</span>

        {(argsText || result !== undefined) && (
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100",
              open && "rotate-90",
            )}
          />
        )}
      </button>

      {open && (
        <div className="mt-1 mb-1 ml-7 flex max-h-64 flex-col gap-2 overflow-auto rounded border bg-muted/30 px-3 py-2">
          {argsText && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium tracking-wider text-muted-foreground/60 uppercase">
                Input
              </p>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {argsText}
              </pre>
            </div>
          )}
          {result !== undefined && (
            <div>
              <p className="mb-0.5 text-[10px] font-medium tracking-wider text-muted-foreground/60 uppercase">
                Result
              </p>
              <pre className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
                {typeof result === "string"
                  ? result
                  : JSON.stringify(result, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
