"use client";

import { useMessage } from "@assistant-ui/react";
import { useMessageTiming } from "@assistant-ui/react";
import { ClockIcon, ZapIcon, CoinsIcon } from "lucide-react";
import type { FC } from "react";

/**
 * Displays response time, tokens/sec, and token usage below each assistant message.
 * Only shown when the message is complete (not while streaming).
 */
export const MessageMetrics: FC = () => {
  const isComplete = useMessage(
    (s) => s.role === "assistant" && s.status?.type === "complete",
  );

  if (!isComplete) return null;

  return <MessageMetricsInner />;
};

function MessageMetricsInner() {
  const timing = useMessageTiming();
  const steps = useMessage((s) =>
    s.role === "assistant" ? s.metadata?.steps : undefined,
  );

  // Aggregate usage across all steps
  const totalUsage = steps?.reduce(
    (acc, step) => {
      if (step.usage) {
        acc.input += step.usage.inputTokens ?? 0;
        acc.output += step.usage.outputTokens ?? 0;
      }
      return acc;
    },
    { input: 0, output: 0 },
  );

  const hasUsage = totalUsage && (totalUsage.input > 0 || totalUsage.output > 0);
  const hasTiming = timing && timing.totalStreamTime;

  if (!hasUsage && !hasTiming) return null;

  const durationSec = hasTiming ? timing.totalStreamTime! / 1000 : null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground/60">
      {/* Response time */}
      {durationSec !== null && (
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="size-3" />
          {formatDuration(durationSec)}
        </span>
      )}

      {/* Tokens per second */}
      {timing?.tokensPerSecond != null && timing.tokensPerSecond > 0 && (
        <span className="inline-flex items-center gap-1">
          <ZapIcon className="size-3" />
          {timing.tokensPerSecond.toFixed(1)} tok/s
        </span>
      )}

      {/* Token usage */}
      {hasUsage && (
        <span className="inline-flex items-center gap-1">
          <CoinsIcon className="size-3" />
          {formatTokenCount(totalUsage.input + totalUsage.output)} tokens
          <span className="text-muted-foreground/40">
            ({formatTokenCount(totalUsage.input)} in / {formatTokenCount(totalUsage.output)} out)
          </span>
        </span>
      )}
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatTokenCount(count: number): string {
  if (count < 1000) return count.toString();
  if (count < 10_000) return `${(count / 1000).toFixed(1)}k`;
  return `${Math.round(count / 1000)}k`;
}
