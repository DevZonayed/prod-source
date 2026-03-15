"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { AlertTriangleIcon, WrenchIcon, XIcon } from "lucide-react";
import type { DetectedError } from "@/hooks/use-error-detection";

export function ErrorPopup({
  error,
  onFix,
  onDismiss,
}: {
  error: DetectedError | null;
  onFix: (error: DetectedError) => void;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (error && !error.dismissed) {
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [error]);

  if (!error || !visible) return null;

  const typeLabel = {
    terminal: "Terminal Error",
    runtime: "Runtime Error",
    build: "Build Error",
    visual: "Visual Error",
  }[error.type];

  const typeColor = {
    terminal: "border-orange-500/30 bg-orange-500/5",
    runtime: "border-red-500/30 bg-red-500/5",
    build: "border-red-500/30 bg-red-500/5",
    visual: "border-yellow-500/30 bg-yellow-500/5",
  }[error.type];

  return (
    <div
      className={cn(
        "fixed right-4 bottom-4 z-50 w-96 max-w-[calc(100vw-2rem)] animate-in fade-in slide-in-from-bottom-4 duration-300",
        "rounded-xl border shadow-2xl shadow-black/20 backdrop-blur-sm",
        typeColor,
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <AlertTriangleIcon className="mt-0.5 size-5 shrink-0 text-red-400" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{typeLabel}</p>
            <button
              type="button"
              onClick={() => onDismiss(error.id)}
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <XIcon className="size-3.5" />
            </button>
          </div>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {error.message}
          </p>
          {error.details && (
            <pre className="mt-2 max-h-20 overflow-auto rounded-md bg-black/20 p-2 text-xs text-muted-foreground">
              {error.details.slice(0, 300)}
            </pre>
          )}
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={() => onFix(error)}
              className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <WrenchIcon className="size-3" />
              Fix it
            </button>
            <button
              type="button"
              onClick={() => onDismiss(error.id)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              Ignore
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
