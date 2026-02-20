"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  FileIcon,
  FileEditIcon,
  FilePlusIcon,
  FolderIcon,
  FolderPlusIcon,
  GitCommitHorizontalIcon,
  MoveIcon,
  SearchIcon,
  TerminalIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react";
import { useState } from "react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

type Obj = Record<string, unknown>;

const obj = (v: unknown): Obj => (v && typeof v === "object" ? (v as Obj) : {});

const parse = (argsText: string): Obj => {
  try {
    return obj(JSON.parse(argsText));
  } catch {
    return {};
  }
};

const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const preview = (v: unknown, max = 12): string | null => {
  if (v == null) return null;
  const t = typeof v === "string" ? v : JSON.stringify(v, null, 2);
  const lines = t.split("\n");
  if (lines.length <= max) return t;
  return lines.slice(0, max).join("\n") + "\n…";
};

/* ------------------------------------------------------------------ */
/*  Shared single-line tool component                                 */
/* ------------------------------------------------------------------ */

type ToolLineProps = {
  icon: React.ReactNode;
  label: string;
  detail?: string;
  status?: { type: string; reason?: string };
  expandContent?: React.ReactNode;
};

const ToolLine = ({
  icon,
  label,
  detail,
  status,
  expandContent,
}: ToolLineProps) => {
  const [open, setOpen] = useState(false);
  const running = status?.type === "running";
  const failed = status?.type === "incomplete" && status.reason === "cancelled";

  return (
    <div className="my-0.5">
      <button
        type="button"
        onClick={() => expandContent && setOpen((v) => !v)}
        className={cn(
          "group flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted/60",
          failed && "text-muted-foreground line-through",
        )}
      >
        {/* status dot / spinner */}
        {running ? (
          <CircleDashedIcon className="size-3 shrink-0 animate-spin text-muted-foreground" />
        ) : failed ? (
          <XIcon className="size-3 shrink-0 text-muted-foreground" />
        ) : (
          <CheckIcon className="size-3 shrink-0 text-muted-foreground" />
        )}

        {/* tool icon */}
        <span className="shrink-0 text-muted-foreground">{icon}</span>

        {/* label */}
        <span className="shrink-0 font-medium">{label}</span>

        {/* detail (file path, command, etc.) */}
        {detail && (
          <span className="min-w-0 truncate text-muted-foreground">
            {detail}
          </span>
        )}

        {/* expand hint */}
        {expandContent && (
          <ChevronRightIcon
            className={cn(
              "ml-auto size-3 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100",
              open && "rotate-90",
            )}
          />
        )}
      </button>

      {open && expandContent && (
        <div className="mt-1 mb-1 ml-9 max-h-64 overflow-auto rounded border bg-muted/30 px-3 py-2">
          {expandContent}
        </div>
      )}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Detail block (shared for expanded view)                           */
/* ------------------------------------------------------------------ */

const DetailBlock = ({ data }: { data: unknown }) => {
  if (data == null) return null;
  const text = preview(data, 20);
  if (!text) return null;
  return (
    <pre className="text-xs leading-relaxed whitespace-pre-wrap text-muted-foreground">
      {text}
    </pre>
  );
};

/* ------------------------------------------------------------------ */
/*  Per-tool cards                                                    */
/* ------------------------------------------------------------------ */

export const BashToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);
  const cmd = str(a.command);
  const hasOutput = str(r.stdout) || str(r.stderr);

  return (
    <ToolLine
      icon={<TerminalIcon className="size-3.5" />}
      label="Ran"
      detail={cmd}
      status={status}
      expandContent={
        hasOutput ? <DetailBlock data={r.stdout || r.stderr} /> : undefined
      }
    />
  );
};

export const ReadFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);

  return (
    <ToolLine
      icon={<FileIcon className="size-3.5" />}
      label="Read"
      detail={str(a.file)}
      status={status}
      expandContent={r.content ? <DetailBlock data={r.content} /> : undefined}
    />
  );
};

export const WriteFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return (
    <ToolLine
      icon={<FileEditIcon className="size-3.5" />}
      label="Wrote"
      detail={str(a.file)}
      status={status}
    />
  );
};

export const ListFilesToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);

  return (
    <ToolLine
      icon={<FolderIcon className="size-3.5" />}
      label="Listed"
      detail={str(a.path)}
      status={status}
      expandContent={r.stdout ? <DetailBlock data={r.stdout} /> : undefined}
    />
  );
};

export const SearchFilesToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);

  return (
    <ToolLine
      icon={<SearchIcon className="size-3.5" />}
      label="Searched"
      detail={str(a.query) ? `"${a.query}"` : undefined}
      status={status}
      expandContent={r.stdout ? <DetailBlock data={r.stdout} /> : undefined}
    />
  );
};

export const ReplaceInFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return (
    <ToolLine
      icon={<FileEditIcon className="size-3.5" />}
      label="Edited"
      detail={str(a.file)}
      status={status}
    />
  );
};

export const AppendToFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return (
    <ToolLine
      icon={<FilePlusIcon className="size-3.5" />}
      label="Appended"
      detail={str(a.file)}
      status={status}
    />
  );
};

export const MakeDirectoryToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return (
    <ToolLine
      icon={<FolderPlusIcon className="size-3.5" />}
      label="Created dir"
      detail={str(a.path)}
      status={status}
    />
  );
};

export const MovePathToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return (
    <ToolLine
      icon={<MoveIcon className="size-3.5" />}
      label="Moved"
      detail={str(a.from) && str(a.to) ? `${a.from} → ${a.to}` : str(a.from)}
      status={status}
    />
  );
};

export const DeletePathToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return (
    <ToolLine
      icon={<Trash2Icon className="size-3.5" />}
      label="Deleted"
      detail={str(a.path)}
      status={status}
    />
  );
};

export const CommitToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";
  const message = str(a.message);

  return (
    <div className="my-0.5 flex items-center gap-2 px-2 py-1 text-sm">
      {running ? (
        <CircleDashedIcon className="size-4 shrink-0 animate-spin text-muted-foreground" />
      ) : (
        <GitCommitHorizontalIcon className="size-4 shrink-0 text-muted-foreground" />
      )}
      <span className="font-medium">
        {running ? "Committing…" : "Committed"}
      </span>
      {message && (
        <span className="min-w-0 truncate text-muted-foreground">
          {message}
        </span>
      )}
    </div>
  );
};
