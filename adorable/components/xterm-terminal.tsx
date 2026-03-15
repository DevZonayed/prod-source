"use client";

import { useEffect, useRef, useCallback } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import "@xterm/xterm/css/xterm.css";

const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 1000;

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
  const terminalRef = useRef<Terminal | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const reconnectAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connectWebSocket = useCallback(
    (terminal: Terminal) => {
      const protocol =
        window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws/terminal?projectId=${encodeURIComponent(projectId)}&session=${encodeURIComponent(sessionId)}`;

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectAttemptRef.current = 0;

        // Send initial size
        ws.send(
          JSON.stringify({
            type: "resize",
            cols: terminal.cols,
            rows: terminal.rows,
          }),
        );
      };

      ws.onmessage = (event) => {
        terminal.write(event.data);
      };

      ws.onclose = (event) => {
        // Normal closure or max attempts exhausted — don't reconnect
        if (
          event.code === 1000 ||
          reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS
        ) {
          terminal.write(
            "\r\n\x1b[33mTerminal session ended.\x1b[0m\r\n",
          );
          return;
        }

        const attempt = reconnectAttemptRef.current;
        const delay = Math.min(
          BASE_RECONNECT_DELAY * Math.pow(2, attempt),
          30000,
        );
        const delaySec = Math.round(delay / 1000);

        terminal.write(
          `\r\n\x1b[33mConnection lost. Reconnecting in ${delaySec}s... (attempt ${attempt + 1}/${MAX_RECONNECT_ATTEMPTS})\x1b[0m\r\n`,
        );

        reconnectAttemptRef.current = attempt + 1;
        reconnectTimerRef.current = setTimeout(() => {
          connectWebSocket(terminal);
        }, delay);
      };

      ws.onerror = () => {
        terminal.write(
          "\r\n\x1b[31mFailed to connect to terminal server.\x1b[0m\r\n",
        );
      };

      // Forward terminal input to WebSocket
      terminal.onData((data) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      // Handle resize
      terminal.onResize(({ cols, rows }) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "resize", cols, rows }));
        }
      });
    },
    [projectId, sessionId],
  );

  const connect = useCallback(() => {
    if (!containerRef.current) return;

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
    const webLinksAddon = new WebLinksAddon();

    terminal.loadAddon(fitAddon);
    terminal.loadAddon(webLinksAddon);

    terminal.open(containerRef.current);
    fitAddon.fit();

    terminalRef.current = terminal;
    fitAddonRef.current = fitAddon;

    connectWebSocket(terminal);
  }, [connectWebSocket]);

  // Initialize
  useEffect(() => {
    connect();

    return () => {
      // Clear any pending reconnect timer
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // Close with 1000 so onclose won't trigger reconnect
      wsRef.current?.close(1000);
      terminalRef.current?.dispose();
    };
  }, [connect]);

  // Handle container resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      fitAddonRef.current?.fit();
    });

    if (containerRef.current) {
      observer.observe(containerRef.current);
    }

    return () => observer.disconnect();
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
