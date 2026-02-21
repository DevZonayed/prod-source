"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { cn } from "@/lib/utils";
import {
  CheckIcon,
  ChevronRightIcon,
  CircleDashedIcon,
  GitCommitHorizontalIcon,
  TerminalIcon,
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
  icon?: React.ReactNode;
  label: string;
  detail?: string;
  status?: { type: string; reason?: string };
  expandContent?: React.ReactNode;
};

const StatusIcon = ({
  status,
}: {
  status?: { type: string; reason?: string };
}) => {
  const running = status?.type === "running";
  const failed = status?.type === "incomplete" && status.reason === "cancelled";
  if (running)
    return (
      <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
    );
  if (failed)
    return <XIcon className="size-3.5 shrink-0 text-muted-foreground" />;
  return <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />;
};

const ToolLine = ({
  icon,
  label,
  detail,
  status,
  expandContent,
}: ToolLineProps) => {
  const [open, setOpen] = useState(false);
  const failed = status?.type === "incomplete" && status.reason === "cancelled";

  return (
    <div className="my-0.5">
      <button
        type="button"
        onClick={() => expandContent && setOpen((v) => !v)}
        className={cn(
          "group inline-flex max-w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted/60",
          failed && "text-muted-foreground line-through",
        )}
      >
        <span className="flex w-4 shrink-0 items-center justify-center">
          {icon ?? <StatusIcon status={status} />}
        </span>

        <span className="shrink-0 font-medium">{label}</span>

        {detail && (
          <span className="min-w-0 truncate text-muted-foreground">
            {detail}
          </span>
        )}

        {expandContent && (
          <ChevronRightIcon
            className={cn(
              "size-3 shrink-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100",
              open && "rotate-90",
            )}
          />
        )}
      </button>

      {open && expandContent && (
        <div className="mt-1 mb-1 ml-7 max-h-64 overflow-auto rounded border bg-muted/30 px-3 py-2">
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
  const running = status?.type === "running";

  return (
    <ToolLine
      icon={
        running ? (
          <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )
      }
      label="Ran"
      detail={cmd}
      status={status}
      expandContent={
        cmd ? (
          <div className="space-y-2">
            <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
              {cmd}
            </pre>
            {(str(r.stdout) || str(r.stderr)) && (
              <DetailBlock data={r.stdout || r.stderr} />
            )}
          </div>
        ) : undefined
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

  return <ToolLine label="Wrote" detail={str(a.file)} status={status} />;
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

  return <ToolLine label="Edited" detail={str(a.file)} status={status} />;
};

export const AppendToFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return <ToolLine label="Appended" detail={str(a.file)} status={status} />;
};

export const MakeDirectoryToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return <ToolLine label="Created dir" detail={str(a.path)} status={status} />;
};

export const MovePathToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);

  return (
    <ToolLine
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

  return <ToolLine label="Deleted" detail={str(a.path)} status={status} />;
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
    <div className="my-0.5 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm">
      <span className="flex w-4 shrink-0 items-center justify-center">
        {running ? (
          <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <GitCommitHorizontalIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )}
      </span>
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

export const CheckAppToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);
  const running = status?.type === "running";
  const path = str(a.path) ?? "/";
  const isOk = r.ok === true;
  const statusCode = typeof r.statusCode === "number" ? r.statusCode : null;

  return (
    <div className="my-0.5 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm">
      <span className="flex w-4 shrink-0 items-center justify-center">
        {running ? (
          <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : isOk ? (
          <CheckIcon className="size-3.5 shrink-0 text-green-500" />
        ) : (
          <XIcon className="size-3.5 shrink-0 text-red-500" />
        )}
      </span>
      <span className="font-medium">
        {running
          ? "Checking app…"
          : isOk
            ? "App is healthy"
            : "App returned an error"}
      </span>
      {!running && statusCode !== null && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-xs",
            isOk
              ? "bg-green-500/10 text-green-500"
              : "bg-red-500/10 text-red-500",
          )}
        >
          {statusCode}
        </span>
      )}
      <span className="min-w-0 truncate text-muted-foreground">{path}</span>
    </div>
  );
};

export const DevServerLogsToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);
  const maxLines =
    typeof a.maxLines === "number" ? `${a.maxLines} lines` : undefined;

  return (
    <ToolLine
      label="Dev logs"
      detail={maxLines ? `last ${maxLines}` : undefined}
      status={status}
      expandContent={r.logs ? <DetailBlock data={r.logs} /> : undefined}
    />
  );
};

export const DeploymentStatusToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);
  const path = str(a.path) ?? "/";
  const state = str(r.state) ?? "idle";
  const commitSha = str(r.commitSha);
  const domain =
    str(r.url)
      ?.replace(/^https?:\/\//, "")
      .split("/")[0] ?? null;
  const running = status?.type === "running" || state === "deploying";
  const isLive = r.isLive === true;
  const statusCode = typeof r.statusCode === "number" ? r.statusCode : null;

  return (
    <div className="my-0.5 inline-flex items-center gap-2 rounded-md px-2 py-1 text-sm">
      <span className="flex w-4 shrink-0 items-center justify-center">
        {running ? (
          <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : isLive ? (
          <CheckIcon className="size-3.5 shrink-0 text-green-500" />
        ) : (
          <XIcon className="size-3.5 shrink-0 text-red-500" />
        )}
      </span>
      <span className="font-medium">
        {running
          ? "Deploying…"
          : isLive
            ? "Deployment is live"
            : "Deployment pending"}
      </span>
      {!running && statusCode !== null && (
        <span
          className={cn(
            "rounded px-1.5 py-0.5 font-mono text-xs",
            isLive
              ? "bg-green-500/10 text-green-500"
              : "bg-red-500/10 text-red-500",
          )}
        >
          {statusCode}
        </span>
      )}
      <span className="min-w-0 truncate text-muted-foreground">
        {domain ? `${domain}${path}` : path}
      </span>
      {commitSha && (
        <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {commitSha.slice(0, 7)}
        </span>
      )}
    </div>
  );
};
