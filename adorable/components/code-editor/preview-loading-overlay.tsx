"use client";

import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface PreviewLoadingOverlayProps {
  containerLoading: boolean;
  devServerLoading: boolean;
  visible: boolean;
}

export function PreviewLoadingOverlay({
  containerLoading,
  devServerLoading,
  visible,
}: PreviewLoadingOverlayProps) {
  const message = containerLoading
    ? "Preparing environment..."
    : devServerLoading
      ? "Starting dev server..."
      : "Almost ready...";

  return (
    <div
      className={cn(
        "absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950 transition-opacity duration-500",
        visible ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <Loader2 className="mb-4 h-8 w-8 animate-spin text-blue-500" />
      <p className="text-sm font-medium text-white">{message}</p>
      <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-zinc-800">
        <div
          className={cn(
            "h-full rounded-full bg-blue-500 transition-all duration-1000",
            containerLoading ? "w-1/3" : devServerLoading ? "w-2/3" : "w-full",
          )}
        />
      </div>
    </div>
  );
}
