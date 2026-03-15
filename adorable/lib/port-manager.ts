import * as net from "net";

const BASE_PORT = 4100;
const MAX_PORT = 4199;

// Maps projectId -> allocated port
const portAllocations = new Map<string, number>();

async function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function allocatePort(projectId: string): Promise<number> {
  // Return existing allocation if still valid
  const existing = portAllocations.get(projectId);
  if (existing && (await isPortFree(existing))) {
    return existing;
  }

  // Find next free port in range
  const usedPorts = new Set(portAllocations.values());
  for (let port = BASE_PORT; port <= MAX_PORT; port++) {
    if (usedPorts.has(port)) continue;
    if (await isPortFree(port)) {
      portAllocations.set(projectId, port);
      return port;
    }
  }

  throw new Error(`No free ports available in range ${BASE_PORT}-${MAX_PORT}`);
}

export function getPortForProject(projectId: string): number | undefined {
  return portAllocations.get(projectId);
}

export function releasePort(projectId: string): void {
  portAllocations.delete(projectId);
}

export function getAllAllocations(): Map<string, number> {
  return new Map(portAllocations);
}
