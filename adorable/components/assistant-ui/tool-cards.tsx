import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import { CheckIcon, XCircleIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type GenericObject = Record<string, unknown>;

const asObject = (value: unknown): GenericObject => {
  if (value && typeof value === "object") return value as GenericObject;
  return {};
};

const parseArgs = (argsText: string): GenericObject => {
  try {
    const parsed = JSON.parse(argsText) as unknown;
    return asObject(parsed);
  } catch {
    return { raw: argsText };
  }
};

const previewText = (value: unknown, maxLines = 10): string | null => {
  if (value == null) return null;
  const text =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return `${lines.slice(0, maxLines).join("\n")}\n…`;
};

type ToolCardProps = {
  title: string;
  subtitle?: string;
  toolName: string;
  status?: { type: string; reason?: string; error?: unknown };
  args?: GenericObject;
  result?: unknown;
  children?: React.ReactNode;
};

const ToolCard = ({
  title,
  subtitle,
  toolName,
  status,
  args,
  result,
  children,
}: ToolCardProps) => {
  const isCancelled =
    status?.type === "incomplete" && status.reason === "cancelled";

  return (
    <div
      className={cn(
        "mb-4 flex w-full flex-col gap-3 rounded-lg border px-4 py-3",
        isCancelled && "border-muted-foreground/30 bg-muted/30",
      )}
    >
      <div className="flex items-center gap-2">
        {isCancelled ? (
          <XCircleIcon className="size-4 text-muted-foreground" />
        ) : (
          <CheckIcon className="size-4" />
        )}
        <p
          className={cn("grow text-sm", isCancelled && "text-muted-foreground")}
        >
          {title}
        </p>
        <span className="rounded bg-muted px-2 py-0.5 text-xs text-muted-foreground">
          {toolName}
        </span>
      </div>

      {subtitle ? (
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      ) : null}

      {children}

      {args && Object.keys(args).length > 0 ? (
        <div className="rounded border border-dashed p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Input
          </p>
          <pre className="text-xs whitespace-pre-wrap">
            {JSON.stringify(args, null, 2)}
          </pre>
        </div>
      ) : null}

      {result !== undefined ? (
        <div className="rounded border border-dashed p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Result
          </p>
          <pre className="text-xs whitespace-pre-wrap">
            {previewText(result) ?? "(empty)"}
          </pre>
        </div>
      ) : null}
    </div>
  );
};

export const BashToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);
  const command = typeof args.command === "string" ? args.command : undefined;

  return (
    <ToolCard
      title="Executed shell command"
      subtitle={command}
      toolName={toolName}
      status={status}
      args={args}
      result={result}
    />
  );
};

export const ReadFileToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);
  const resultObj = asObject(result);
  const contentPreview = previewText(resultObj.content, 16);

  return (
    <ToolCard
      title="Read file"
      subtitle={typeof args.file === "string" ? args.file : undefined}
      toolName={toolName}
      status={status}
      args={args}
      result={undefined}
    >
      {contentPreview ? (
        <div className="rounded border border-dashed p-2">
          <p className="mb-1 text-xs font-medium text-muted-foreground">
            Content preview
          </p>
          <pre className="text-xs whitespace-pre-wrap">{contentPreview}</pre>
        </div>
      ) : null}
    </ToolCard>
  );
};

export const WriteFileToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);
  const resultObj = asObject(result);

  return (
    <ToolCard
      title="Wrote file"
      subtitle={typeof args.file === "string" ? args.file : undefined}
      toolName={toolName}
      status={status}
      args={{ file: args.file }}
      result={{ ok: resultObj.ok }}
    />
  );
};

export const ListFilesToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);
  const resultObj = asObject(result);

  return (
    <ToolCard
      title="Listed files"
      subtitle={typeof args.path === "string" ? args.path : undefined}
      toolName={toolName}
      status={status}
      args={args}
      result={{
        stdout: resultObj.stdout,
        stderr: resultObj.stderr,
        ok: resultObj.ok,
      }}
    />
  );
};

export const SearchFilesToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);
  const resultObj = asObject(result);

  return (
    <ToolCard
      title="Searched files"
      subtitle={
        typeof args.query === "string" ? `query: ${args.query}` : undefined
      }
      toolName={toolName}
      status={status}
      args={args}
      result={{
        stdout: resultObj.stdout,
        stderr: resultObj.stderr,
        ok: resultObj.ok,
      }}
    />
  );
};

export const ReplaceInFileToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);
  return (
    <ToolCard
      title="Replaced text in file"
      subtitle={typeof args.file === "string" ? args.file : undefined}
      toolName={toolName}
      status={status}
      args={{ file: args.file, search: args.search, all: args.all }}
      result={result}
    />
  );
};

export const AppendToFileToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);

  return (
    <ToolCard
      title="Appended to file"
      subtitle={typeof args.file === "string" ? args.file : undefined}
      toolName={toolName}
      status={status}
      args={{ file: args.file }}
      result={result}
    />
  );
};

export const MakeDirectoryToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);

  return (
    <ToolCard
      title="Created directory"
      subtitle={typeof args.path === "string" ? args.path : undefined}
      toolName={toolName}
      status={status}
      args={args}
      result={result}
    />
  );
};

export const MovePathToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);

  return (
    <ToolCard
      title="Moved path"
      subtitle={
        typeof args.from === "string" && typeof args.to === "string"
          ? `${args.from} → ${args.to}`
          : undefined
      }
      toolName={toolName}
      status={status}
      args={args}
      result={result}
    />
  );
};

export const DeletePathToolCard: ToolCallMessagePartComponent = ({
  toolName,
  argsText,
  result,
  status,
}) => {
  const args = parseArgs(argsText);

  return (
    <ToolCard
      title="Deleted path"
      subtitle={typeof args.path === "string" ? args.path : undefined}
      toolName={toolName}
      status={status}
      args={args}
      result={result}
    />
  );
};
