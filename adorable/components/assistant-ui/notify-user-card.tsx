"use client";

import type { ToolCallMessagePartComponent } from "@assistant-ui/react";
import {
  BellIcon,
  FileTextIcon,
  AlertCircleIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj =>
  v && typeof v === "object" ? (v as Obj) : {};
const str = (v: unknown): string | undefined =>
  typeof v === "string" && v.length > 0 ? v : undefined;

/**
 * Renders the notify_user tool result as a notification card.
 * Shows the message, files to review, confidence score, and blocked state.
 */
export const NotifyUserCard: ToolCallMessagePartComponent = ({
  result,
  status,
}) => {
  const r = obj(result);
  const running = status?.type === "running";

  const message = str(r.message) ?? "";
  const pathsToReview = Array.isArray(r.pathsToReview)
    ? (r.pathsToReview as string[])
    : [];
  const confidenceScore =
    typeof r.confidenceScore === "number" ? r.confidenceScore : null;
  const blockedOnUser = r.blockedOnUser === true;

  return (
    <div
      className={cn(
        "my-2 rounded-lg border p-3",
        blockedOnUser
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-border bg-card",
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        {blockedOnUser ? (
          <AlertCircleIcon className="size-4 shrink-0 text-amber-500" />
        ) : (
          <BellIcon className="size-4 shrink-0 text-muted-foreground" />
        )}
        <span
          className={cn(
            "text-xs font-semibold uppercase tracking-wider",
            blockedOnUser ? "text-amber-500" : "text-muted-foreground",
          )}
        >
          {blockedOnUser ? "Waiting for your response" : "Update"}
        </span>
        {confidenceScore !== null && (
          <span
            className={cn(
              "ml-auto rounded-full px-2 py-0.5 text-[10px] font-medium",
              confidenceScore >= 0.8
                ? "bg-green-500/10 text-green-500"
                : confidenceScore >= 0.5
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-red-500/10 text-red-500",
            )}
          >
            {Math.round(confidenceScore * 100)}% confident
          </span>
        )}
      </div>

      {/* Message */}
      {message && (
        <p className="mt-2 text-sm text-foreground whitespace-pre-wrap">
          {message}
        </p>
      )}

      {/* Files to review */}
      {pathsToReview.length > 0 && (
        <div className="mt-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1">
            Files to review
          </p>
          <div className="flex flex-col gap-0.5">
            {pathsToReview.map((path) => (
              <div
                key={path}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <FileTextIcon className="size-3 shrink-0" />
                <span className="font-mono truncate">{path}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
