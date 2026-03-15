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

const dev = process.env.NODE_ENV !== "production";
const hostname = process.env.HOSTNAME || "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();
const docker = new Docker();

// Lazy-load project lookup
async function getProjectRecord(
  projectId: string,
): Promise<{ path: string; containerId: string | null } | null> {
  try {
    const { getProject } = await import("./lib/local-storage");
    const project = getProject(projectId);
    if (!project) return null;
    return { path: project.path, containerId: project.containerId };
  } catch {
    return null;
  }
}

app.prepare().then(() => {
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
    }
    // Other upgrades (HMR) handled by Next.js
  });

  wss.on("connection", async (ws: WebSocket, request) => {
    const url = new URL(
      request.url || "/",
      `http://${hostname}:${port}`,
    );
    const projectId = url.searchParams.get("projectId");
    const sessionId = url.searchParams.get("session") || "default";

    if (!projectId) {
      ws.send("\r\n\x1b[31mError: projectId is required\x1b[0m\r\n");
      ws.close();
      return;
    }

    const project = await getProjectRecord(projectId);
    if (!project) {
      ws.send(
        `\r\n\x1b[31mError: Project ${projectId} not found\x1b[0m\r\n`,
      );
      ws.close();
      return;
    }

    // ─── Docker container terminal ───
    if (project.containerId) {
      try {
        const container = docker.getContainer(project.containerId);

        // Verify container is running
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

        // Container output → WebSocket
        stream.on("data", (data: Buffer) => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(data);
          }
        });

        stream.on("end", () => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(
              "\r\n\x1b[33mContainer session ended.\x1b[0m\r\n",
            );
            ws.close();
          }
        });

        // WebSocket input → container
        ws.on("message", (data: Buffer | string) => {
          const message = data.toString();

          // Handle resize messages
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
            // Not JSON — regular terminal input
          }

          stream.write(data);
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
      ws.close();
    }
  });

  server.listen(port, () => {
    console.log(`> Voxel ready on http://${hostname}:${port}`);
    console.log(
      `> Terminal WebSocket at ws://${hostname}:${port}/ws/terminal`,
    );
  });
});
