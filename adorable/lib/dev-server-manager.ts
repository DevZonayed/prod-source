/**
 * Dev Server Manager
 *
 * Starts dev servers inside Docker containers (or locally as fallback).
 * The dev server runs on port 3000 inside the container, mapped to a
 * host port (4100-4199) via Docker port forwarding.
 */

import Docker from "dockerode";
import { getProject, updateProject } from "@/lib/local-storage";
import { getDevCommand } from "@/lib/templates";
import { allocatePort } from "@/lib/port-manager";
import { getActiveDockerVm } from "@/lib/docker-vm";
import { getOrCreateContainer } from "@/lib/docker-manager";

type LogSubscriber = (data: string) => void;

type DevServerEntry = {
  projectId: string;
  containerId: string;
  execId: string | null;
  port: number;
  stream: NodeJS.ReadableStream | null;
  logBuffer: string[];
  logSubscribers: Set<LogSubscriber>;
};

const activeServers = new Map<string, DevServerEntry>();

/**
 * Subscribe to live dev server logs for a project.
 * Returns existing buffered logs immediately, then streams new logs.
 * Call the returned function to unsubscribe.
 */
export function subscribeToDevServerLogs(
  projectId: string,
  callback: LogSubscriber,
): (() => void) | null {
  const entry = activeServers.get(projectId);
  if (!entry) return null;

  // Send buffered logs first
  for (const line of entry.logBuffer) {
    callback(line);
  }

  // Subscribe to new logs
  entry.logSubscribers.add(callback);

  return () => {
    entry.logSubscribers.delete(callback);
  };
}
const docker = new Docker();

// The dev server runs on port 3000 INSIDE the container
const CONTAINER_DEV_PORT = 3000;

export async function startDevServer(projectId: string): Promise<{
  port: number;
  previewUrl: string;
  alreadyRunning: boolean;
}> {
  // Already running?
  const existing = activeServers.get(projectId);
  if (existing) {
    return {
      port: existing.port,
      previewUrl: `http://localhost:${existing.port}`,
      alreadyRunning: true,
    };
  }

  const project = getProject(projectId);
  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  let hostPort: number;
  let containerId: string;

  // Check if container already exists and get its mapped port
  if (project.containerId) {
    try {
      const container = docker.getContainer(project.containerId);
      const info = await container.inspect();

      if (info.State.Running) {
        containerId = project.containerId;
        // Get the mapped host port from existing container
        const portBindings = info.NetworkSettings.Ports?.["3000/tcp"];
        hostPort = portBindings?.[0]?.HostPort
          ? parseInt(portBindings[0].HostPort, 10)
          : await allocatePort(projectId);
      } else {
        // Container exists but stopped — start it
        await container.start();
        containerId = project.containerId;
        const info2 = await container.inspect();
        const portBindings = info2.NetworkSettings.Ports?.["3000/tcp"];
        hostPort = portBindings?.[0]?.HostPort
          ? parseInt(portBindings[0].HostPort, 10)
          : await allocatePort(projectId);
      }
    } catch {
      // Container not found, create new
      hostPort = await allocatePort(projectId);
      containerId = await getOrCreateContainer(
        projectId,
        project.path,
        hostPort,
        null,
      );
    }
  } else {
    hostPort = await allocatePort(projectId);
    containerId = await getOrCreateContainer(
      projectId,
      project.path,
      hostPort,
      null,
    );
  }

  // Save container ID if new
  if (project.containerId !== containerId) {
    updateProject(projectId, { containerId });
  }

  // Dev command uses port 3000 inside container (Docker maps it to hostPort)
  const devCommand = getDevCommand(project.framework, CONTAINER_DEV_PORT);

  console.log(
    `[DevServer] Starting in container for ${project.name}: ${devCommand} (container:${CONTAINER_DEV_PORT} → host:${hostPort})`,
  );

  const container = docker.getContainer(containerId);

  // First, install dependencies if node_modules doesn't exist
  try {
    const checkResult = await container.exec({
      Cmd: ["bash", "-c", "[ -d /workspace/node_modules ] && echo 'exists' || echo 'missing'"],
      WorkingDir: "/workspace",
      AttachStdout: true,
      AttachStderr: true,
    });
    const checkStream = await checkResult.start({ hijack: true, stdin: false });
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve) => {
      checkStream.on("data", (c: Buffer) => chunks.push(c));
      checkStream.on("end", () => resolve());
    });
    const output = Buffer.concat(chunks).toString();

    if (output.includes("missing")) {
      console.log(`[DevServer] Installing dependencies for ${project.name}...`);
      const installExec = await container.exec({
        Cmd: ["bash", "-c", "cd /workspace && npm install 2>&1"],
        WorkingDir: "/workspace",
        AttachStdout: true,
        AttachStderr: true,
      });
      const installStream = await installExec.start({ hijack: true, stdin: false });
      await new Promise<void>((resolve) => {
        installStream.on("end", () => resolve());
        installStream.resume(); // Drain the stream
      });
    }
  } catch (err) {
    console.error("[DevServer] Dependency check failed:", err);
  }

  // Start dev server as a long-running exec
  const exec = await container.exec({
    Cmd: ["bash", "-c", `cd /workspace && ${devCommand}`],
    WorkingDir: "/workspace",
    AttachStdout: true,
    AttachStderr: true,
    Env: [
      `PORT=${CONTAINER_DEV_PORT}`,
      "NODE_ENV=development",
      "BROWSER=none",
    ],
  });

  const stream = await exec.start({ hijack: true, stdin: false });

  const inspectResult = await exec.inspect();

  const entry: DevServerEntry = {
    projectId,
    containerId,
    execId: inspectResult.ID || null,
    port: hostPort,
    stream,
    logBuffer: [],
    logSubscribers: new Set(),
  };

  // Capture logs — push to VM buffer, local buffer, and all live subscribers
  const vm = getActiveDockerVm(projectId);
  stream.on("data", (chunk: Buffer) => {
    const text = chunk.toString("utf-8");
    if (vm) {
      vm.appendLogs(text);
    }
    // Buffer last 500 lines for late subscribers
    entry.logBuffer.push(text);
    if (entry.logBuffer.length > 500) {
      entry.logBuffer.shift();
    }
    // Notify all live subscribers
    for (const sub of entry.logSubscribers) {
      try {
        sub(text);
      } catch {
        // subscriber error — ignore
      }
    }
  });

  activeServers.set(projectId, entry);

  // Update project record
  updateProject(projectId, {
    devPort: hostPort,
    previewUrl: `http://localhost:${hostPort}`,
  });

  return {
    port: hostPort,
    previewUrl: `http://localhost:${hostPort}`,
    alreadyRunning: false,
  };
}

export async function stopDevServer(projectId: string): Promise<boolean> {
  const entry = activeServers.get(projectId);
  if (!entry) return false;

  try {
    // Kill the dev server process inside the container
    const container = docker.getContainer(entry.containerId);
    await container.exec({
      Cmd: ["bash", "-c", "pkill -f 'next dev' 2>/dev/null; pkill -f 'vite' 2>/dev/null; true"],
      WorkingDir: "/workspace",
      AttachStdout: true,
      AttachStderr: true,
    });
  } catch {
    // Container might be gone
  }

  // Destroy the stream
  if (entry.stream) {
    try {
      (entry.stream as NodeJS.ReadableStream & { destroy?: () => void }).destroy?.();
    } catch {
      // Ignore
    }
  }

  activeServers.delete(projectId);
  return true;
}

export function getDevServerStatus(projectId: string): {
  running: boolean;
  port: number | null;
  previewUrl: string | null;
} {
  const entry = activeServers.get(projectId);
  if (!entry) {
    return { running: false, port: null, previewUrl: null };
  }
  return {
    running: true,
    port: entry.port,
    previewUrl: `http://localhost:${entry.port}`,
  };
}

export function stopAllDevServers(): void {
  for (const [id] of activeServers) {
    void stopDevServer(id);
  }
}
