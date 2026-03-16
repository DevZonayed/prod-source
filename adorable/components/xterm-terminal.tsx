"use client";

import { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

type XTerminalProps = {
  projectId: string;
  sessionId?: string;
  className?: string;
};

export function XTerminal({
  projectId,
  sessionId = "default",
  className,
}: XTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // Use refs for stable identity — prevents effect re-runs
  const projectIdRef = useRef(projectId);
  const sessionIdRef = useRef(sessionId);
  projectIdRef.current = projectId;
  sessionIdRef.current = sessionId;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Create terminal
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily:
        "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: "#09090b",
        foreground: "#fafafa",
        cursor: "#fafafa",
        selectionBackground: "#27272a",
        black: "#09090b",
        red: "#ef4444",
        green: "#22c55e",
        yellow: "#eab308",
        blue: "#3b82f6",
        magenta: "#a855f7",
        cyan: "#06b6d4",
        white: "#fafafa",
      },
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.loadAddon(new WebLinksAddon());
    terminal.open(el);

    // Delay initial fit to ensure container has dimensions
    requestAnimationFrame(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore fit errors on unmount
      }
    });

    // Resize observer
    const resizeObserver = new ResizeObserver(() => {
      try {
        fitAddon.fit();
      } catch {
        // ignore
      }
    });
    resizeObserver.observe(el);

    // WebSocket connection
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let reconnectAttempt = 0;
    let disposed = false;
    const MAX_ATTEMPTS = 10;
    const BASE_DELAY = 1000;

    function connect() {
      if (disposed) return;

      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const url = `${protocol}//${window.location.host}/ws/terminal?projectId=${encodeURIComponent(projectIdRef.current)}&session=${encodeURIComponent(sessionIdRef.current)}`;

      ws = new WebSocket(url);
      // CRITICAL: receive data as arraybuffer so we can decode to string
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        // Reset reconnect counter after stable connection (3s)
        const stableTimer = setTimeout(() => {
          reconnectAttempt = 0;
        }, 3000);
        ws!.addEventListener("close", () => clearTimeout(stableTimer), {
          once: true,
        });

        // Send initial terminal size
        ws!.send(
          JSON.stringify({
            type: "resize",
            cols: terminal.cols,
            rows: terminal.rows,
          }),
        );
      };

      ws.onmessage = (event) => {
        if (event.data instanceof ArrayBuffer) {
          // Decode binary to string for xterm
          const text = new TextDecoder().decode(event.data);
          terminal.write(text);
        } else {
          // String message
          terminal.write(event.data as string);
        }
      };

      ws.onclose = (event) => {
        if (disposed) return;
        if (event.code === 1000 || reconnectAttempt >= MAX_ATTEMPTS) {
          terminal.write(
            "\r\n\x1b[33mTerminal session ended.\x1b[0m\r\n",
          );
          return;
        }

        const delay = Math.min(
          BASE_DELAY * Math.pow(2, reconnectAttempt),
          30000,
        );
        terminal.write(
          `\r\n\x1b[33mReconnecting in ${Math.round(delay / 1000)}s...\x1b[0m\r\n`,
        );
        reconnectAttempt++;
        reconnectTimer = setTimeout(connect, delay);
      };

      ws.onerror = () => {
        // onclose will handle reconnection
      };
    }

    // Terminal input → WebSocket
    const dataDisposable = terminal.onData((data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Terminal resize → WebSocket
    const resizeDisposable = terminal.onResize(({ cols, rows }) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: "resize", cols, rows }));
      }
    });

    // Start connection
    connect();

    // Cleanup function
    const cleanup = () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      dataDisposable.dispose();
      resizeDisposable.dispose();
      resizeObserver.disconnect();
      if (ws) {
        ws.onclose = null; // prevent reconnect on cleanup
        ws.close(1000);
      }
      terminal.dispose();
    };

    cleanupRef.current = cleanup;

    return cleanup;
    // Empty deps — we use refs for projectId/sessionId
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: "100%",
        height: "100%",
        backgroundColor: "#09090b",
      }}
    />
  );
}
