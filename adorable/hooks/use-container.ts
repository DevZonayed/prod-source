"use client";

import { useEffect, useState, useCallback } from "react";

type ContainerState = {
  containerReady: boolean;
  loading: boolean;
  error: string | null;
};

// Module-level lock to prevent concurrent container creation for the same project
const pendingCreations = new Map<string, Promise<boolean>>();

export function useContainer(projectId: string | null): ContainerState {
  const [state, setState] = useState<ContainerState>({
    containerReady: false,
    loading: false,
    error: null,
  });

  const ensureContainer = useCallback(async (pid: string): Promise<boolean> => {
    // Deduplicate concurrent calls for the same project
    const existing = pendingCreations.get(pid);
    if (existing) return existing;

    const promise = (async (): Promise<boolean> => {
      // 1. Check if container is already running
      const checkRes = await fetch(`/api/containers?projectId=${encodeURIComponent(pid)}`);
      const checkData = await checkRes.json();
      if (checkData.status === "running") return true;

      // 2. Create/start container
      const createRes = await fetch("/api/containers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: pid, action: "create" }),
      });
      const createData = await createRes.json();
      return !!createData.ok;
    })();

    pendingCreations.set(pid, promise);
    try {
      return await promise;
    } finally {
      pendingCreations.delete(pid);
    }
  }, []);

  useEffect(() => {
    if (!projectId) {
      setState({ containerReady: false, loading: false, error: null });
      return;
    }

    let cancelled = false;
    setState({ containerReady: false, loading: true, error: null });

    ensureContainer(projectId)
      .then((ok) => {
        if (!cancelled) {
          setState({
            containerReady: ok,
            loading: false,
            error: ok ? null : "Failed to create container",
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setState({
            containerReady: false,
            loading: false,
            error: err instanceof Error ? err.message : "Network error",
          });
        }
      });

    return () => { cancelled = true; };
  }, [projectId, ensureContainer]);

  return state;
}
