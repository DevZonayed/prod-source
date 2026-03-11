"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import {
  CircleDashedIcon,
  ClipboardListIcon,
  CodeIcon,
  CheckCircle2Icon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" ? (v as Obj) : {};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

const modeConfig = {
  PLANNING: {
    icon: ClipboardListIcon,
    color: "text-blue-500",
    bg: "bg-blue-500/10",
    border: "border-blue-500/20",
    label: "Planning",
  },
  EXECUTION: {
    icon: CodeIcon,
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    label: "Executing",
  },
  VERIFICATION: {
    icon: CheckCircle2Icon,
    color: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
    label: "Verifying",
  },
} as const;

/**
 * Renders the task_boundary tool result as a structured progress card.
 * Shows task name, summary, status, and current mode (PLANNING/EXECUTION/VERIFICATION).
 */
export const TaskViewCard: ToolCallMessagePartComponent = ({
  result,
  status,
}) => {
  const r = obj(result);
  const running = status?.type === "running";

  const taskName = str(r.taskName) ?? "Task";
  const taskSummary = str(r.taskSummary) ?? "";
  const taskStatus = str(r.taskStatus) ?? "";
  const mode = (str(r.mode) ?? "PLANNING") as keyof typeof modeConfig;
  const config = modeConfig[mode] ?? modeConfig.PLANNING;
  const Icon = config.icon;

  return (
    <div
      className={cn(
        "my-2 rounded-lg border p-3",
        config.border,
        config.bg,
      )}
    >
      <div className="flex items-center gap-2">
        {running ? (
          <CircleDashedIcon
            className={cn("size-4 shrink-0 animate-spin", config.color)}
          />
        ) : (
          <Icon className={cn("size-4 shrink-0", config.color)} />
        )}
        <span className={cn("text-xs font-semibold uppercase tracking-wider", config.color)}>
          {config.label}
        </span>
      </div>

      <h3 className="mt-1.5 text-sm font-semibold text-foreground">
        {taskName}
      </h3>

      {taskSummary && (
        <p className="mt-1 text-xs text-muted-foreground">{taskSummary}</p>
      )}

      {taskStatus && (
        <div className="mt-2 flex items-start gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Next:
          </span>
          <span className="text-xs text-foreground">{taskStatus}</span>
        </div>
      )}
    </div>
  );
};
