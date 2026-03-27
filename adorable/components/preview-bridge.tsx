"use client";

import { useEffect, useRef, useCallback } from "react";
import type { BridgeCommand } from "@/lib/browser-bridge";

type PreviewBridgeProps = {
  projectId: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
};

const POLL_INTERVAL = 300; // ms

/**
 * Invisible component that bridges the server-side browser_action tool
 * with the iframe via postMessage.
 *
 * - Polls /api/browser-bridge for pending commands
 * - Forwards them to the iframe via postMessage
 * - Listens for results from the iframe
 * - POSTs results back to the API to resolve the tool's Promise
 */
export function PreviewBridge({ projectId, iframeRef }: PreviewBridgeProps) {
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bridgeReadyRef = useRef(false);

  // Send result back to server
  const sendResult = useCallback(
    async (commandId: string, result: Record<string, unknown>) => {
      try {
        await fetch("/api/browser-bridge", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ commandId, result }),
        });
      } catch (err) {
        console.error("[PreviewBridge] Failed to send result:", err);
      }
    },
    [],
  );

  // Listen for messages from the iframe
  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (!event.data || typeof event.data !== "object") return;

      if (event.data.type === "bridge:ready") {
        bridgeReadyRef.current = true;
        return;
      }

      if (event.data.type === "bridge:result" && event.data.id) {
        sendResult(event.data.id, {
          success: event.data.success ?? false,
          data: event.data.data,
          error: event.data.error,
          screenshot: event.data.screenshot,
        });
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [sendResult]);

  // Poll for pending commands and forward to iframe
  useEffect(() => {
    async function pollCommands() {
      try {
        const res = await fetch(
          `/api/browser-bridge?projectId=${encodeURIComponent(projectId)}`,
        );
        if (!res.ok) return;

        const data = (await res.json()) as { commands: BridgeCommand[] };
        if (!data.commands?.length) return;

        const iframe = iframeRef.current;
        if (!iframe?.contentWindow) {
          // Iframe not ready — reject all commands
          for (const cmd of data.commands) {
            await sendResult(cmd.id, {
              success: false,
              error: "Preview iframe not loaded yet.",
            });
          }
          return;
        }

        // Forward each command to the iframe
        for (const cmd of data.commands) {
          iframe.contentWindow.postMessage(
            { type: "bridge:command", ...cmd },
            "*",
          );
        }
      } catch {
        // Polling errors are expected during page transitions
      }
    }

    pollingRef.current = setInterval(pollCommands, POLL_INTERVAL);
    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [projectId, iframeRef, sendResult]);

  // Reset bridge ready state when iframe navigates
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    function handleLoad() {
      bridgeReadyRef.current = false;
    }

    iframe.addEventListener("load", handleLoad);
    return () => iframe.removeEventListener("load", handleLoad);
  }, [iframeRef]);

  // Invisible — no UI
  return null;
}
