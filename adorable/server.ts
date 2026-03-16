/**
 * Custom Next.js server with WebSocket support for terminal.
 *
 * Terminal sessions use Docker exec to run shells inside project containers.
 * Falls back to node-pty for projects without Docker containers.
 */

import { createServer } from "http";
import { parse } from "url";
import next from "next";
import Docker from "dockerode";
import { WebSocketServer, WebSocket } from "ws";

import { getProject } from "./lib/local-storage";

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const docker = new Docker();

function getProjectRecord(
  projectId: string,
): { path: string; containerId: string | null } | null {
  try {
    const project = getProject(projectId);
    if (!project) return null;
    return { path: project.path, containerId: project.containerId };
  } catch (err) {
    console.error("[Terminal] Failed to load project record:", err);
    return null;
  }
}

app.prepare().then(() => {
  // Get Next.js upgrade handler so we can forward non-terminal upgrades
  // (HMR, etc.) to it. We handle all upgrades ourselves to prevent Next.js
  // from also registering its own upgrade listener that would conflict with
  // our terminal WebSocket connections.
  const nextUpgradeHandler = app.getUpgradeHandler();

  // Prevent Next.js from registering a duplicate upgrade handler on first
  // HTTP request (setupWebSocketHandler checks this flag).
  (app as unknown as { didWebSocketSetup: boolean }).didWebSocketSetup = true;

  const server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true);
      await handle(req, res, parsedUrl);
    } catch (err) {
      console.error("Error handling request:", err);
      res.statusCode = 500;
      res.end("Internal Server Error");
    }
  });

  // ─── WebSocket Server for Terminal ───
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${hostname}:${port}`);

    if (url.pathname === "/ws/terminal") {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request);
      });
    } else {
      // Pass non-terminal upgrades (HMR, etc.) to Next.js
      nextUpgradeHandler(request, socket, head);
    }
  });

  wss.on("connection", (ws: WebSocket, request) => {
    const url = new URL(
      request.url || "/",
      `http://${hostname}:${port}`,
    );
    const projectId = url.searchParams.get("projectId");
    const sessionId = url.searchParams.get("session") || "default";

    // Wrap the entire handler in a promise to catch all async errors
    void (async () => {
    console.log(`[Terminal] Connection for project=${projectId} session=${sessionId}`);

    if (!projectId) {
      ws.send("\r\n\x1b[31mError: projectId is required\x1b[0m\r\n");
      ws.close(1000, "projectId required");
      return;
    }

    const project = getProjectRecord(projectId);
    if (!project) {
      ws.send(
        `\r\n\x1b[31mError: Project ${projectId} not found\x1b[0m\r\n`,
      );
      ws.close(1000, "project not found");
      return;
    }

    // ─── Resolve container: by ID from DB, or by name convention ───
    let resolvedContainerId = project.containerId;
    if (!resolvedContainerId) {
      // Container might exist but DB hasn't been updated yet — try by name
      const containerName = `voxel-${projectId.slice(0, 12)}`;
      try {
        const c = docker.getContainer(containerName);
        const info = await c.inspect();
        if (info.State.Running) {
          resolvedContainerId = info.Id;
        }
      } catch {
        // Container doesn't exist by name either
      }
    }

    console.log(`[Terminal] Container resolved: ${resolvedContainerId ? resolvedContainerId.slice(0, 12) : 'NONE'}, path: ${project.path}`);

    // ─── "Dev Server" session: run dev server in an interactive TTY ───
    if (resolvedContainerId && sessionId === "dev-server") {
      try {
        const container = docker.getContainer(resolvedContainerId);
        const containerInfo = await container.inspect();
        if (!containerInfo.State.Running) {
          await container.start();
        }

        // The dev server writes to /tmp/dev-server.log inside the container.
        // Tail that log file to stream output to the terminal.
        // If the log doesn't exist yet (dev server hasn't started), wait for it.
        const exec = await container.exec({
          Cmd: [
            "/bin/bash",
            "-c",
            [
              'echo "\\033[36m▶ Dev Server Logs\\033[0m"',
              'echo "\\033[90m─────────────────────────────────────\\033[0m"',
              // Wait up to 30s for the log file to appear
              'for i in $(seq 1 60); do',
              '  if [ -f /tmp/dev-server.log ]; then break; fi',
              '  if [ "$i" = "1" ]; then echo "\\033[33mWaiting for dev server to start...\\033[0m"; fi',
              '  sleep 0.5',
              'done',
              // Use tail -F (capital F) to follow by filename, not fd.
              // This handles log file replacement when dev server restarts.
              'if [ -f /tmp/dev-server.log ]; then',
              '  tail -n 50 -F /tmp/dev-server.log 2>/dev/null',
              'else',
              '  echo "\\033[31mDev server log not found. Opening shell...\\033[0m"',
              '  cd /workspace && exec /bin/bash',
              'fi',
            ].join('\n'),
          ],
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          Env: ["TERM=xterm-256color"],
        });

        const stream = await exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        });

        console.log(`[Terminal] Dev server terminal started for ${projectId}`);

        // Container output → WebSocket
        stream.on("data", (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString("utf-8"));
          }
        });

        stream.on("end", () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send("\r\n\x1b[33mDev server process ended.\x1b[0m\r\n");
            ws.close(1000, "session ended");
          }
        });

        stream.on("error", (err: Error) => {
          console.error(`[Terminal] Dev server stream error:`, err.message);
        });

        // WebSocket input → container (Ctrl+C to stop, etc.)
        ws.on("message", (rawData: Buffer | string) => {
          const message = typeof rawData === "string" ? rawData : rawData.toString("utf-8");
          if (message.startsWith("{")) {
            try {
              const parsed = JSON.parse(message);
              if (parsed.type === "resize" && parsed.cols && parsed.rows) {
                exec.resize({ h: parsed.rows, w: parsed.cols }).catch(() => {});
                return;
              }
            } catch {
              // Not JSON
            }
          }
          stream.write(message);
        });

        ws.on("close", () => stream.end());
        ws.on("error", () => stream.end());
        return;
      } catch (error) {
        console.error("[Terminal] Dev server terminal failed:", error);
        // Fall through to interactive bash
      }
    }

    // ─── Docker container interactive terminal ───
    if (resolvedContainerId) {
      try {
        const container = docker.getContainer(resolvedContainerId);

        const info = await container.inspect();
        if (!info.State.Running) {
          await container.start();
        }

        const exec = await container.exec({
          Cmd: ["/bin/bash"],
          AttachStdin: true,
          AttachStdout: true,
          AttachStderr: true,
          Tty: true,
          Env: ["TERM=xterm-256color"],
        });

        const stream = await exec.start({
          hijack: true,
          stdin: true,
          Tty: true,
        });

        // Send initial cd to workspace
        stream.write("cd /workspace && clear\n");

        // Container output → WebSocket (send as string, not binary)
        stream.on("data", (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data.toString("utf-8"));
          }
        });

        stream.on("end", () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              "\r\n\x1b[33mContainer session ended.\x1b[0m\r\n",
            );
            ws.close(1000, "session ended");
          }
        });

        stream.on("error", (err: Error) => {
          console.error(`[Terminal] Docker stream error:`, err.message);
        });

        // WebSocket input → container
        ws.on("message", (rawData: Buffer | string) => {
          const message = typeof rawData === "string" ? rawData : rawData.toString("utf-8");

          // Handle resize messages (JSON)
          if (message.startsWith("{")) {
            try {
              const parsed = JSON.parse(message);
              if (
                parsed.type === "resize" &&
                parsed.cols &&
                parsed.rows
              ) {
                exec.resize({ h: parsed.rows, w: parsed.cols }).catch(
                  () => {},
                );
                return;
              }
            } catch {
              // Not valid JSON — treat as terminal input
            }
          }

          // Write terminal input to container stdin
          stream.write(message);
        });

        ws.on("close", () => {
          stream.end();
        });

        ws.on("error", () => {
          stream.end();
        });

        return;
      } catch (error) {
        console.error("[Terminal] Docker exec failed:", error);
        ws.send(
          `\r\n\x1b[31mDocker terminal failed: ${error instanceof Error ? error.message : "Unknown error"}\x1b[0m\r\n`,
        );
        ws.close(1000, "docker exec failed");
        return;
      }
    }

    // ─── Fallback: node-pty local terminal ───
    try {
      const pty = await import("node-pty");
      const shell = process.env.SHELL || "/bin/bash";

      const ptyProcess = pty.spawn(shell, [], {
        name: "xterm-256color",
        cols: 120,
        rows: 30,
        cwd: project.path,
        env: {
          ...process.env,
          TERM: "xterm-256color",
        } as Record<string, string>,
      });

      ptyProcess.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(data);
        }
      });

      ptyProcess.onExit(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.close();
        }
      });

      ws.on("message", (data: Buffer | string) => {
        const message = data.toString();
        try {
          const parsed = JSON.parse(message);
          if (parsed.type === "resize" && parsed.cols && parsed.rows) {
            ptyProcess.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch {
          // Not JSON
        }
        ptyProcess.write(message);
      });

      ws.on("close", () => ptyProcess.kill());
      ws.on("error", () => ptyProcess.kill());
    } catch (error) {
      console.error("[Terminal] node-pty fallback failed:", error);
      ws.send(
        `\r\n\x1b[31mTerminal unavailable: ${error instanceof Error ? error.message : "Unknown error"}\x1b[0m\r\n`,
      );
      ws.close(1000, "terminal unavailable");
    }
    })().catch((err) => {
      console.error("[Terminal] Unhandled error in WebSocket handler:", err);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(
          `\r\n\x1b[31mTerminal error: ${err instanceof Error ? err.message : "Unknown error"}\x1b[0m\r\n`,
        );
        ws.close(1000, "terminal error");
      }
    });
  });

  server.listen(port, () => {
    console.log(`> Voxel ready on http://${hostname}:${port}`);
    console.log(
      `> Terminal WebSocket at ws://${hostname}:${port}/ws/terminal`,
    );
  });
});
