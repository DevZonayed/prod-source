"use client";

import { useEffect, useState, useCallback, useRef } from "react";

type DevServerStatus = {
  running: boolean;
  port: number | null;
  previewUrl: string | null;
  loading: boolean;
  error: string | null;
};

export function useDevServer(projectId: string | null, enabled: boolean = true) {
  const [status, setStatus] = useState<DevServerStatus>({
    running: false,
    port: null,
    previewUrl: null,
    loading: false,
    error: null,
  });
  const startAttemptedRef = useRef(false);

  const startServer = useCallback(async () => {
    if (!projectId) return;

    setStatus((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const res = await fetch("/api/dev-server", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, action: "start" }),
      });

      const data = await res.json();

      if (data.ok) {
        setStatus({
          running: true,
          port: data.port,
          previewUrl: data.previewUrl,
          loading: false,
          error: null,
        });
      } else {
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: data.error || "Failed to start dev server",
        }));
      }
    } catch (err) {
      setStatus((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : "Network error",
      }));
    }
  }, [projectId]);

  const checkStatus = useCallback(async () => {
    if (!projectId) return;

    try {
      const res = await fetch(
        `/api/dev-server?projectId=${encodeURIComponent(projectId)}`,
      );
      const data = await res.json();
      if (data.running && data.previewUrl) {
        setStatus({
          running: true,
          port: data.port,
          previewUrl: data.previewUrl,
          loading: false,
          error: null,
        });
        return true; // Server is running
      }
      return false;
    } catch {
      return false;
    }
  }, [projectId]);

  // Auto-start dev server when projectId changes and enabled is true
  useEffect(() => {
    if (!projectId || !enabled) return;
    startAttemptedRef.current = false;

    let cancelled = false;

    (async () => {
      // First check if already running
      const isRunning = await checkStatus();
      if (isRunning || cancelled) return;

      // Start the server
      startAttemptedRef.current = true;
      await startServer();
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, enabled, startServer, checkStatus]);

  // Poll for dev server readiness while loading or not yet running
  // This catches cases where the dev server takes time to start (npm install, etc.)
  useEffect(() => {
    if (!projectId || !enabled || status.running) return;

    const interval = setInterval(async () => {
      const isRunning = await checkStatus();
      if (isRunning) {
        clearInterval(interval);
      }
    }, 3000); // Check every 3 seconds

    return () => clearInterval(interval);
  }, [projectId, enabled, status.running, checkStatus]);

  // Also re-check when AI finishes work (repos-updated event)
  useEffect(() => {
    if (!projectId || !enabled) return;

    const handleReposUpdated = () => {
      void checkStatus();
    };

    window.addEventListener("voxel:repos-updated", handleReposUpdated);
    return () => {
      window.removeEventListener("voxel:repos-updated", handleReposUpdated);
    };
  }, [projectId, enabled, checkStatus]);

  return { ...status, startServer, checkStatus };
}
