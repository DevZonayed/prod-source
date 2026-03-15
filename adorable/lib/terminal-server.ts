/**
 * Terminal WebSocket Server
 *
 * Provides pseudo-terminal access to project directories via WebSocket.
 * Uses node-pty to create terminal sessions and streams I/O over WebSocket.
 *
 * This runs as a separate WebSocket server on the same port as Next.js,
 * handling upgrade requests at /ws/terminal.
 */

import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { getProject } from "@/lib/local-storage";

// Lazy-load node-pty to avoid build-time issues
let ptyModule: typeof import("node-pty") | null = null;

async function getPty() {
  if (!ptyModule) {
    ptyModule = await import("node-pty");
  }
  return ptyModule;
}

type TerminalSession = {
  projectId: string;
  sessionId: string;
  pty: ReturnType<typeof import("node-pty").spawn> | null;
  ws: WebSocket;
};

const sessions = new Map<string, TerminalSession>();

export function setupTerminalWebSocket(server: Server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request: IncomingMessage, socket, head) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);

    if (url.pathname === "/ws/terminal") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    }
  });

  wss.on("connection", async (ws: WebSocket, request: IncomingMessage) => {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    const projectId = url.searchParams.get("projectId");
    const sessionId = url.searchParams.get("session") || "default";

    if (!projectId) {
      ws.send(JSON.stringify({ error: "projectId required" }));
      ws.close();
      return;
    }

    const project = getProject(projectId);
    if (!project) {
      ws.send(JSON.stringify({ error: "Project not found" }));
      ws.close();
      return;
    }

    const sessionKey = `${projectId}:${sessionId}`;

    try {
      const pty = await getPty();
      const shell = process.env.SHELL || "/bin/bash";

      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd: project.path,
        env: {
          ...process.env,
          TERM: "xterm-256color",
          HOME: process.env.HOME || "/root",
        } as Record<string, string>,
      });

      const session: TerminalSession = {
        projectId,
        sessionId,
        pty: ptyProcess,
        ws,
      };
      sessions.set(sessionKey, session);

      // Forward pty output to WebSocket
      ptyProcess.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ptyProcess.onExit(() => {
        sessions.delete(sessionKey);
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      // Forward WebSocket input to pty
      ws.on("message", (data: Buffer | string) => {
        const message = data.toString();

        // Handle resize messages
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === "resize" && parsed.cols && parsed.rows) {
            ptyProcess.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch {
          // Not JSON, treat as terminal input
        }

        ptyProcess.write(message);
      });

      ws.on("close", () => {
        ptyProcess.kill();
        sessions.delete(sessionKey);
      });

      ws.on("error", () => {
        ptyProcess.kill();
        sessions.delete(sessionKey);
      });
    } catch (error) {
      console.error("Failed to create terminal session:", error);
      ws.send(
        JSON.stringify({
          error: "Failed to create terminal session",
          details: error instanceof Error ? error.message : "Unknown error",
        }),
      );
      ws.close();
    }
  });

  return wss;
}

export function getActiveSessions(): Map<string, TerminalSession> {
  return sessions;
}
