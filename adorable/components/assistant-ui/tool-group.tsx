"use client";

import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ChevronRightIcon,
  FileEditIcon,
  FileIcon,
  FolderIcon,
  SearchIcon,
  TerminalIcon,
  WrenchIcon,
} from "lucide-react";
import { type FC, type PropsWithChildren, useState } from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

type MessagePartGroup = { groupKey: string | undefined; indices: number[] };
type GroupingFunction = (parts: readonly any[]) => MessagePartGroup[];

/* ------------------------------------------------------------------ */
/*  Grouping function – groups consecutive tool-call parts            */
/*  Encodes tool info into the groupKey so the Group component        */
/*  doesn't need to access message context.                           */
/* ------------------------------------------------------------------ */

type ToolInfo = { toolName: string; args: Record<string, unknown> };

const encodeToolGroup = (tools: ToolInfo[]): string => {
  // Compact JSON encoding of tools for the group key
  return JSON.stringify(tools);
};

export const groupConsecutiveToolCalls: GroupingFunction = (parts) => {
  const groups: MessagePartGroup[] = [];
  let currentToolIndices: number[] | null = null;
  let currentToolInfos: ToolInfo[] | null = null;

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i];
    if (part && part.type === "tool-call") {
      if (!currentToolIndices) {
        currentToolIndices = [];
        currentToolInfos = [];
      }
      currentToolIndices.push(i);
      currentToolInfos!.push({
        toolName: part.toolName ?? "",
        args: part.args ?? {},
      });
    } else {
      if (currentToolIndices && currentToolInfos) {
        groups.push({
          groupKey: encodeToolGroup(currentToolInfos),
          indices: currentToolIndices,
        });
        currentToolIndices = null;
        currentToolInfos = null;
      }
      groups.push({ groupKey: undefined, indices: [i] });
    }
  }

  if (currentToolIndices && currentToolInfos) {
    groups.push({
      groupKey: encodeToolGroup(currentToolInfos),
      indices: currentToolIndices,
    });
  }

  return groups;
};

/* ------------------------------------------------------------------ */
/*  Summarisation helpers                                             */
/* ------------------------------------------------------------------ */

type SummaryItem = { icon: React.ReactNode; text: string };

const buildSummary = (tools: ToolInfo[]): SummaryItem[] => {
  const items: SummaryItem[] = [];

  const reads: string[] = [];
  const writes: string[] = [];
  const edits: string[] = [];
  const searches: string[] = [];
  const commands: string[] = [];
  const listings: string[] = [];
  const other: string[] = [];

  for (const t of tools) {
    const file = typeof t.args.file === "string" ? t.args.file : undefined;
    const path = typeof t.args.path === "string" ? t.args.path : undefined;

    switch (t.toolName) {
      case "readFileTool":
        reads.push(file ?? "file");
        break;
      case "writeFileTool":
        writes.push(file ?? "file");
        break;
      case "replaceInFileTool":
      case "appendToFileTool":
        edits.push(file ?? "file");
        break;
      case "searchFilesTool":
        searches.push(
          typeof t.args.query === "string" ? `"${t.args.query}"` : "files",
        );
        break;
      case "listFilesTool":
        listings.push(path ?? ".");
        break;
      case "bashTool":
        commands.push(
          typeof t.args.command === "string"
            ? t.args.command.split("\n")[0]!
            : "command",
        );
        break;
      case "makeDirectoryTool":
      case "movePathTool":
      case "deletePathTool":
        other.push(
          t.toolName
            .replace(/Tool$/, "")
            .replace(/([A-Z])/g, " $1")
            .trim()
            .toLowerCase(),
        );
        break;
      default:
        other.push(t.toolName);
    }
  }

  if (reads.length > 0) {
    items.push({
      icon: <FileIcon className="size-3.5" />,
      text:
        reads.length === 1 ? `Read ${reads[0]}` : `Read ${reads.length} files`,
    });
  }

  if (writes.length > 0) {
    items.push({
      icon: <FileEditIcon className="size-3.5" />,
      text:
        writes.length === 1
          ? `Wrote ${writes[0]}`
          : `Updated ${writes.length} files`,
    });
  }

  if (edits.length > 0) {
    items.push({
      icon: <FileEditIcon className="size-3.5" />,
      text:
        edits.length === 1
          ? `Edited ${edits[0]}`
          : `Edited ${edits.length} files`,
    });
  }

  if (searches.length > 0) {
    items.push({
      icon: <SearchIcon className="size-3.5" />,
      text:
        searches.length === 1
          ? `Searched ${searches[0]}`
          : `Searched ${searches.length} queries`,
    });
  }

  if (listings.length > 0) {
    items.push({
      icon: <FolderIcon className="size-3.5" />,
      text:
        listings.length === 1
          ? `Listed ${listings[0]}`
          : `Listed ${listings.length} directories`,
    });
  }

  if (commands.length > 0) {
    items.push({
      icon: <TerminalIcon className="size-3.5" />,
      text:
        commands.length === 1
          ? `Ran ${commands[0]}`
          : `Ran ${commands.length} commands`,
    });
  }

  if (other.length > 0) {
    items.push({
      icon: <WrenchIcon className="size-3.5" />,
      text: other.length === 1 ? other[0]! : `${other.length} other operations`,
    });
  }

  return items;
};

/* ------------------------------------------------------------------ */
/*  Group component                                                   */
/* ------------------------------------------------------------------ */

export const ToolCallGroup: FC<
  PropsWithChildren<{ groupKey: string | undefined; indices: number[] }>
> = ({ groupKey, indices, children }) => {
  const [open, setOpen] = useState(false);

  // Ungrouped parts render normally
  if (!groupKey) return <>{children}</>;

  // Single tool call — don't group, render directly
  if (indices.length === 1) {
    return <>{children}</>;
  }

  // Decode tool info from the groupKey
  let tools: ToolInfo[] = [];
  try {
    tools = JSON.parse(groupKey) as ToolInfo[];
  } catch {
    // fallback
  }

  const summaryItems = buildSummary(tools);

  return (
    <div className="my-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
      >
        <CheckIcon className="size-3 shrink-0 text-muted-foreground" />

        <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5">
          {summaryItems.map((item, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 text-muted-foreground"
            >
              {item.icon}
              <span className="truncate">{item.text}</span>
            </span>
          ))}
        </div>

        <ChevronRightIcon
          className={cn(
            "ml-auto size-3 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
      </button>

      {open && (
        <div className="ml-2 border-l border-border pl-2">{children}</div>
      )}
    </div>
  );
};
