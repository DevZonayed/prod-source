"use client";

import { useEffect, useState, useRef } from "react";

type ContainerState = {
  containerReady: boolean;
  loading: boolean;
  error: string | null;
};

export function useContainer(projectId: string | null): ContainerState {
  const [state, setState] = useState<ContainerState>({
    containerReady: false,
    loading: false,
    error: null,
  });
  const attemptedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setState({ containerReady: false, loading: false, error: null });
      attemptedRef.current = null;
      return;
    }

    // Don't re-attempt for the same project
    if (attemptedRef.current === projectId && state.containerReady) {
      return;
    }

    let cancelled = false;

    const ensureContainer = async () => {
      setState({ containerReady: false, loading: true, error: null });

      try {
        // Check current container status
        const checkRes = await fetch(
          `/api/containers?projectId=${encodeURIComponent(projectId)}`,
        );
        const checkData = await checkRes.json();

        if (checkData.status === "running") {
          // Container already running
          if (!cancelled) {
            attemptedRef.current = projectId;
            setState({ containerReady: true, loading: false, error: null });
          }
          return;
        }

        // Create/start container
        const createRes = await fetch("/api/containers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId, action: "create" }),
        });
        const createData = await createRes.json();

        if (!cancelled) {
          if (createData.ok) {
            attemptedRef.current = projectId;
            setState({ containerReady: true, loading: false, error: null });
          } else {
            setState({
              containerReady: false,
              loading: false,
              error: createData.error || "Failed to create container",
            });
          }
        }
      } catch (err) {
        if (!cancelled) {
          setState({
            containerReady: false,
            loading: false,
            error: err instanceof Error ? err.message : "Network error",
          });
        }
      }
    };

    void ensureContainer();

    return () => {
      cancelled = true;
    };
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  return state;
}
