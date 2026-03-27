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
import { useEffect, useRef, useState } from "react";

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

/** Pick the first defined string from multiple keys (handles legacy + CodeMine naming) */
const pick = (o: Obj, ...keys: string[]): string | undefined => {
  for (const k of keys) {
    const v = str(o[k]);
    if (v) return v;
  }
  return undefined;
};

/** Extract text from MCP-style result (content array or plain object) */
const resultText = (r: unknown): string | undefined => {
  if (!r) return undefined;
  if (typeof r === "string") return r;
  const o = obj(r);
  // MCP returns { content: [{ text: "..." }] }
  if (Array.isArray(o.content)) {
    return (o.content as Array<{ text?: string }>)
      .map((c) => c.text ?? "")
      .filter(Boolean)
      .join("\n") || undefined;
  }
  return str(o.stdout) || str(o.stderr) || str(o.content) || str(o.results) || str(o.result) || str(o.data);
};

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
  failed?: boolean;
  expandContent?: React.ReactNode;
};

const StatusIcon = ({
  status,
  failed,
}: {
  status?: { type: string; reason?: string };
  failed?: boolean;
}) => {
  const running = status?.type === "running";
  const cancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  if (running)
    return (
      <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
    );
  if (failed || cancelled)
    return <XIcon className="size-3.5 shrink-0 text-red-500" />;
  return <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />;
};

const ToolLine = ({
  icon,
  label,
  detail,
  status,
  failed,
  expandContent,
}: ToolLineProps) => {
  const [open, setOpen] = useState(false);
  const cancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const isFailed = failed || cancelled;

  return (
    <div className="my-0.5 block w-full">
      <button
        type="button"
        onClick={() => expandContent && setOpen((v) => !v)}
        className={cn(
          "group flex w-full max-w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm transition-colors hover:bg-muted/60",
          isFailed && "text-red-500",
        )}
      >
        <span className="flex w-4 shrink-0 items-center justify-center">
          {icon ?? <StatusIcon status={status} failed={failed} />}
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
        <div className="mt-1 mb-1 ml-7 max-h-80 overflow-auto rounded border bg-muted/30 px-3 py-2">
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
  const text = preview(data, 30);
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
  const cmd = pick(a, "command", "Command");
  const output = resultText(result) || str(r.stdout) || str(r.stderr);
  const running = status?.type === "running";

  const bashDispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || bashDispatched.current) return;
    if (r.ok === false && (str(r.stderr) || str(r.stdout))) {
      bashDispatched.current = true;
      window.dispatchEvent(
        new CustomEvent("voxel:tool-error", {
          detail: { toolName: "bashTool", result: r },
        }),
      );
    }
  }, [status, r]);

  return (
    <ToolLine
      icon={
        running ? (
          <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <TerminalIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )
      }
      label={running ? "Running" : "Ran"}
      detail={cmd}
      status={status}
      expandContent={
        (cmd || output) ? (
          <div className="space-y-2">
            {cmd && (
              <pre className="text-xs leading-relaxed whitespace-pre-wrap text-foreground">
                {cmd}
              </pre>
            )}
            {output && <DetailBlock data={output} />}
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
  const running = status?.type === "running";
  const filePath = pick(a, "file", "AbsolutePath", "Path", "path", "file_path");
  const output = resultText(result);

  return (
    <ToolLine
      label={running ? "Reading" : "Read"}
      detail={filePath}
      status={status}
      expandContent={output ? <DetailBlock data={output} /> : undefined}
    />
  );
};

export const WriteFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";
  const filePath = pick(a, "file", "AbsolutePath", "path", "file_path");
  const content = pick(a, "content", "Content");
  const output = resultText(result);

  const dispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || dispatched.current) return;
    dispatched.current = true;
    if (filePath) {
      window.dispatchEvent(
        new CustomEvent("voxel:file-changed", {
          detail: { path: filePath, content: content || undefined },
        }),
      );
    }
  }, [status, filePath, content]);

  return (
    <ToolLine
      label={running ? "Writing" : "Wrote"}
      detail={filePath}
      status={status}
      expandContent={output ? <DetailBlock data={output} /> : undefined}
    />
  );
};

export const BatchWriteFilesToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";
  const files = Array.isArray(a.files) ? a.files : [];
  const count = files.length;

  const dispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || dispatched.current) return;
    dispatched.current = true;
    for (const f of files) {
      const filePath = str((f as Obj).file);
      const content = str((f as Obj).content);
      if (filePath) {
        window.dispatchEvent(
          new CustomEvent("voxel:file-changed", {
            detail: { path: filePath, content: content || undefined },
          }),
        );
      }
    }
  }, [status, files]);

  return (
    <ToolLine
      label={running ? "Writing" : "Wrote"}
      detail={`${count} file${count !== 1 ? "s" : ""}`}
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
  const running = status?.type === "running";
  const dirPath = pick(a, "path", "DirectoryPath", "SearchPattern");
  const output = resultText(result);

  return (
    <ToolLine
      label={running ? "Listing" : "Listed"}
      detail={dirPath}
      status={status}
      expandContent={output ? <DetailBlock data={output} /> : undefined}
    />
  );
};

export const SearchFilesToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";
  const query = pick(a, "query", "Query", "SearchPattern", "q");
  const output = resultText(result);

  return (
    <ToolLine
      label={running ? "Searching" : "Searched"}
      detail={query ? `"${query}"` : undefined}
      status={status}
      expandContent={output ? <DetailBlock data={output} /> : undefined}
    />
  );
};

export const ReplaceInFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";
  const filePath = pick(a, "file", "AbsolutePath", "path", "file_path");
  const oldStr = pick(a, "old_string", "OldString");
  const newStr = pick(a, "new_string", "NewString");
  const output = resultText(result);

  const dispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || dispatched.current) return;
    dispatched.current = true;
    if (filePath) {
      window.dispatchEvent(
        new CustomEvent("voxel:file-changed", {
          detail: { path: filePath },
        }),
      );
    }
  }, [status, filePath]);

  const hasDiff = oldStr || newStr;

  return (
    <ToolLine
      label={running ? "Editing" : "Edited"}
      detail={filePath}
      status={status}
      expandContent={
        (hasDiff || output) ? (
          <div className="space-y-2">
            {oldStr && (
              <div>
                <p className="mb-0.5 text-[10px] font-medium tracking-wider text-red-400/80 uppercase">Removed</p>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap text-red-400/70">{preview(oldStr, 8)}</pre>
              </div>
            )}
            {newStr && (
              <div>
                <p className="mb-0.5 text-[10px] font-medium tracking-wider text-green-400/80 uppercase">Added</p>
                <pre className="text-xs leading-relaxed whitespace-pre-wrap text-green-400/70">{preview(newStr, 8)}</pre>
              </div>
            )}
            {output && <DetailBlock data={output} />}
          </div>
        ) : undefined
      }
    />
  );
};

export const AppendToFileToolCard: ToolCallMessagePartComponent = ({
  argsText,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";

  const dispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || dispatched.current) return;
    dispatched.current = true;
    const filePath = str(a.file);
    if (filePath) {
      window.dispatchEvent(
        new CustomEvent("voxel:file-changed", {
          detail: { path: filePath },
        }),
      );
    }
  }, [status, a]);

  return (
    <ToolLine
      label={running ? "Appending" : "Appended"}
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
  const running = status?.type === "running";

  return (
    <ToolLine
      label={running ? "Creating dir" : "Created dir"}
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
  const running = status?.type === "running";

  const dispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || dispatched.current) return;
    dispatched.current = true;
    const fromPath = str(a.from);
    const toPath = str(a.to);
    if (fromPath) {
      window.dispatchEvent(
        new CustomEvent("voxel:file-deleted", { detail: { path: fromPath } }),
      );
    }
    if (toPath) {
      window.dispatchEvent(
        new CustomEvent("voxel:file-changed", { detail: { path: toPath } }),
      );
    }
  }, [status, a]);

  return (
    <ToolLine
      label={running ? "Moving" : "Moved"}
      detail={str(a.from) && str(a.to) ? `${a.from} → ${a.to}` : str(a.from)}
      status={status}
    />
  );
};

export const DeletePathToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";
  const filePath = pick(a, "path", "AbsolutePath");
  const output = resultText(result);

  const dispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || dispatched.current) return;
    dispatched.current = true;
    if (filePath) {
      window.dispatchEvent(
        new CustomEvent("voxel:file-deleted", { detail: { path: filePath } }),
      );
    }
  }, [status, filePath]);

  return (
    <ToolLine
      label={running ? "Deleting" : "Deleted"}
      detail={filePath}
      status={status}
      expandContent={output ? <DetailBlock data={output} /> : undefined}
    />
  );
};

export const CommitToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);
  const running = status?.type === "running";
  const cancelled =
    status?.type === "incomplete" && status.reason === "cancelled";
  const message = pick(a, "message", "Message");
  const commitOutput = resultText(result) || [str(r.stderr), str(r.stdout)].filter(Boolean).join("\n");
  const output = commitOutput || "";
  const hasFailureText = /\berror:\b|\bfatal:\b|\bfailed\b/i.test(output);
  const failed = !running && (r.ok === false || cancelled || hasFailureText);

  return (
    <ToolLine
      icon={
        running ? (
          <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : failed ? (
          <XIcon className="size-3.5 shrink-0 text-red-500" />
        ) : (
          <GitCommitHorizontalIcon className="size-3.5 shrink-0 text-muted-foreground" />
        )
      }
      label={running ? "Committing…" : failed ? "Commit failed" : "Committed"}
      detail={message}
      status={status}
      failed={failed}
      expandContent={
        output ? <DetailBlock data={output} /> : undefined
      }
    />
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

  const checkDispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || checkDispatched.current) return;
    if (r.ok === false) {
      checkDispatched.current = true;
      window.dispatchEvent(
        new CustomEvent("voxel:tool-error", {
          detail: { toolName: "checkAppTool", result: r },
        }),
      );
    }
  }, [status, r]);

  return (
    <div className="my-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm">
      <span className="flex w-4 shrink-0 items-center justify-center">
        {running ? (
          <CircleDashedIcon className="size-3.5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <CheckIcon className="size-3.5 shrink-0 text-muted-foreground" />
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
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-xs text-muted-foreground">
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
  const running = status?.type === "running";
  const maxLines =
    typeof a.maxLines === "number" ? `${a.maxLines} lines` : undefined;

  const logsDispatched = useRef(false);
  useEffect(() => {
    if (status?.type === "running" || logsDispatched.current) return;
    if (typeof r.logs === "string") {
      const hasErrors =
        /(error|failed to compile|module not found|unhandled runtime|typeerror|syntaxerror|referenceerror)/i.test(
          r.logs as string,
        );
      if (hasErrors) {
        logsDispatched.current = true;
        window.dispatchEvent(
          new CustomEvent("voxel:tool-error", {
            detail: { toolName: "devServerLogsTool", result: r },
          }),
        );
      }
    }
  }, [status, r]);

  return (
    <ToolLine
      label={running ? "Reading dev logs" : "Dev logs"}
      detail={maxLines ? `last ${maxLines}` : undefined}
      status={status}
      expandContent={r.logs ? <DetailBlock data={r.logs} /> : undefined}
    />
  );
};

export const MemoryQueryToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const r = obj(result);
  const running = status?.type === "running";
  const query = str(a.query) ?? str(a.category);

  return (
    <ToolLine
      label={running ? "Querying memory" : "Queried memory"}
      detail={query ? `"${query}"` : undefined}
      status={status}
      expandContent={r.results ? <DetailBlock data={r.results} /> : undefined}
    />
  );
};

export const MemorySyncToolCard: ToolCallMessagePartComponent = ({
  argsText,
  result,
  status,
}) => {
  const a = parse(argsText);
  const running = status?.type === "running";
  const action = str(a.action) ?? str(a.category);

  return (
    <ToolLine
      label={running ? "Syncing memory" : "Memory synced"}
      detail={action}
      status={status}
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
    <div className="my-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm">
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
