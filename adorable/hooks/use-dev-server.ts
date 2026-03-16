"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type DevServerStatus = {
  running: boolean;
  port: number | null;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
};

/**
 * Probe a URL to see if it responds (returns true if reachable).
 * Uses fetch with a short timeout. Catches all errors silently.
 */
async function probeUrl(url: string): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(url, {
      mode: "no-cors",
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return true; // any response (even opaque) means server is up
  } catch {
    return false;
  }
}

export function useDevServer(projectId: string | null, enabled: boolean = true) {
  const [status, setStatus] = useState<DevServerStatus>({
    running: false,
    port: null,
    previewUrl: null,
    loading: false,
    error: null,
  });
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startedRef = useRef(false);

  // Start the dev server via API
  const startServer = useCallback(async (): Promise<{
    port?: number;
    previewUrl?: string;
  } | null> => {
    if (!projectId) return null;

    setStatus((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch("/api/dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "start" }),
      });
      const data = await res.json();
      if (data.ok) {
        return { port: data.port, previewUrl: data.previewUrl };
      }
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: data.error || "Failed to start dev server",
      }));
      return null;
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Network error",
      }));
      return null;
    }
  }, [projectId]);

  // Check API status
  const checkStatus = useCallback(async (): Promise<{
    running: boolean;
    port?: number;
    previewUrl?: string;
  }> => {
    if (!projectId) return { running: false };
    try {
      const res = await fetch(
        `/api/dev-server?projectId=${encodeURIComponent(projectId)}`,
      );
      return await res.json();
    } catch {
      return { running: false };
    }
  }, [projectId]);

  // Main effect: start server and poll until it's actually reachable
  useEffect(() => {
    if (!projectId || !enabled) {
      setStatus({ running: false, port: null, previewUrl: null, loading: false, error: null });
      startedRef.current = false;
      return;
    }

    let cancelled = false;
    startedRef.current = false;

    (async () => {
      setStatus((prev) => ({ ...prev, loading: true, error: null }));

      // 1. Check if already running in dev-server-manager
      const current = await checkStatus();
      if (cancelled) return;

      let previewUrl: string | null = null;
      let port: number | null = null;

      if (current.running && current.previewUrl) {
        previewUrl = current.previewUrl;
        port = current.port ?? null;
      } else {
        // 2. Start the dev server
        const result = await startServer();
        if (cancelled) return;
        if (result?.previewUrl) {
          previewUrl = result.previewUrl;
          port = result.port ?? null;
        }
      }

      if (!previewUrl || cancelled) {
        if (!cancelled) {
          setStatus((prev) => ({
            ...prev,
            loading: false,
            error: prev.error || "Could not start dev server",
          }));
        }
        return;
      }

      startedRef.current = true;

      // 3. Poll until the preview URL actually responds
      const pollForReady = async () => {
        for (let i = 0; i < 60; i++) {
          // 60 attempts × 2s = 2 minutes max
          if (cancelled) return;
          const reachable = await probeUrl(previewUrl!);
          if (reachable) {
            if (!cancelled) {
              setStatus({
                running: true,
                port,
                previewUrl,
                loading: false,
                error: null,
              });
            }
            return;
          }
          await new Promise((r) => setTimeout(r, 2000));
        }
        // Timeout — show URL anyway, let user see the error
        if (!cancelled) {
          setStatus({
            running: true,
            port,
            previewUrl,
            loading: false,
            error: null,
          });
        }
      };

      await pollForReady();
    })();

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [projectId, enabled, startServer, checkStatus]);

  // Re-check when AI finishes work
  useEffect(() => {
    if (!projectId || !enabled) return;

    const handleReposUpdated = async () => {
      const current = await checkStatus();
      if (current.running && current.previewUrl) {
        const reachable = await probeUrl(current.previewUrl);
        if (reachable) {
          setStatus({
            running: true,
            port: current.port ?? null,
            previewUrl: current.previewUrl,
            loading: false,
            error: null,
          });
        }
      }
    };

    window.addEventListener("voxel:repos-updated", handleReposUpdated);
    return () => window.removeEventListener("voxel:repos-updated", handleReposUpdated);
  }, [projectId, enabled, checkStatus]);

  return { ...status, startServer, checkStatus };
}
