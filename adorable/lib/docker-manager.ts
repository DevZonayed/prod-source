import Docker from "dockerode";
import * as path from "path";
import * as fs from "fs";

const docker = new Docker();
const SANDBOX_IMAGE = "voxel-sandbox:latest";
const CONTAINER_PREFIX = "voxel-";
const EXPECTED_IMAGE_VERSION = "2";

/**
 * Check if Docker is available.
 */
export async function isDockerAvailable(): Promise<boolean> {
  try {
    await docker.ping();
    return true;
  } catch {
    return false;
  }
}

/**
 * Ensure the sandbox image exists and is up-to-date. Build/rebuild if needed.
 */
export async function ensureSandboxImage(): Promise<void> {
  try {
    const imageInfo = await docker.getImage(SANDBOX_IMAGE).inspect();
    const currentVersion =
      imageInfo.Config?.Labels?.["voxel.image.version"] ?? "0";
    if (currentVersion === EXPECTED_IMAGE_VERSION) {
      return; // Image exists and is current
    }
    console.log(
      `[Docker] Image version mismatch (have=${currentVersion}, want=${EXPECTED_IMAGE_VERSION}), rebuilding...`,
    );
  } catch {
    // Image doesn't exist, build it
  }

  console.log("[Docker] Building sandbox image...");

  const dockerfilePath = path.resolve(
    process.cwd(),
    "docker",
    "Dockerfile.sandbox",
  );

  if (!fs.existsSync(dockerfilePath)) {
    throw new Error(
      `Sandbox Dockerfile not found at ${dockerfilePath}`,
    );
  }

  const contextDir = path.dirname(dockerfilePath);

  const stream = await docker.buildImage(
    {
      context: contextDir,
      src: ["Dockerfile.sandbox"],
    },
    {
      t: SANDBOX_IMAGE,
      dockerfile: "Dockerfile.sandbox",
    },
  );

  // Wait for build to complete
  await new Promise<void>((resolve, reject) => {
    docker.modem.followProgress(
      stream,
      (err: Error | null) => {
        if (err) {
          console.error("[Docker] Image build failed:", err);
          reject(err);
        } else {
          console.log("[Docker] Sandbox image built successfully");
          resolve();
        }
      },
      (event: { stream?: string }) => {
        if (event.stream) {
          process.stdout.write(event.stream);
        }
      },
    );
  });
}

/**
 * Create and start a container for a project.
 */
export async function createProjectContainer(
  projectId: string,
  hostProjectDir: string,
  hostPort: number,
): Promise<string> {
  const containerName = `${CONTAINER_PREFIX}${projectId.slice(0, 12)}`;

  // Remove existing container with same name if any
  try {
    const existing = docker.getContainer(containerName);
    const info = await existing.inspect();
    if (info.State.Running) {
      await existing.stop();
    }
    await existing.remove();
  } catch {
    // Container doesn't exist, that's fine
  }

  const container = await docker.createContainer({
    Image: SANDBOX_IMAGE,
    name: containerName,
    WorkingDir: "/workspace",
    Cmd: ["tail", "-f", "/dev/null"],
    HostConfig: {
      Binds: [`${hostProjectDir}:/workspace:rw`],
      PortBindings: {
        "3000/tcp": [{ HostPort: String(hostPort) }],
      },
      Memory: 2 * 1024 * 1024 * 1024, // 2GB
      CpuShares: 512,
      // Security: drop dangerous capabilities
      CapDrop: ["SYS_ADMIN", "NET_RAW"],
    },
    ExposedPorts: {
      "3000/tcp": {},
    },
    Env: [
      "NODE_ENV=development",
      "HOME=/root",
      "TERM=xterm-256color",
    ],
  });

  await container.start();
  console.log(
    `[Docker] Container ${containerName} started for project ${projectId}`,
  );

  return container.id;
}

/**
 * Get or create a container for a project.
 * Checks if a container with the given ID exists and is running.
 */
export async function getOrCreateContainer(
  projectId: string,
  hostProjectDir: string,
  hostPort: number,
  existingContainerId?: string | null,
): Promise<string> {
  // Try existing container first
  if (existingContainerId) {
    try {
      const container = docker.getContainer(existingContainerId);
      const info = await container.inspect();

      if (info.State.Running) {
        return existingContainerId;
      }

      // Container exists but stopped — start it
      await container.start();
      console.log(
        `[Docker] Restarted container ${existingContainerId} for project ${projectId}`,
      );
      return existingContainerId;
    } catch {
      // Container not found, create new one
    }
  }

  // Also try finding by name
  const containerName = `${CONTAINER_PREFIX}${projectId.slice(0, 12)}`;
  try {
    const container = docker.getContainer(containerName);
    const info = await container.inspect();

    if (info.State.Running) {
      return info.Id;
    }

    await container.start();
    return info.Id;
  } catch {
    // Not found by name either
  }

  // Create new container
  return createProjectContainer(projectId, hostProjectDir, hostPort);
}

/**
 * Stop a container.
 */
export async function stopContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.stop({ t: 10 });
    console.log(`[Docker] Container ${containerId.slice(0, 12)} stopped`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (!msg.includes("not running") && !msg.includes("No such container")) {
      throw error;
    }
  }
}

/**
 * Remove a container (force stop if running).
 */
export async function removeContainer(containerId: string): Promise<void> {
  try {
    const container = docker.getContainer(containerId);
    await container.remove({ force: true });
    console.log(`[Docker] Container ${containerId.slice(0, 12)} removed`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "";
    if (!msg.includes("No such container")) {
      throw error;
    }
  }
}

/**
 * Get container status.
 */
export async function getContainerStatus(
  containerId: string,
): Promise<"running" | "stopped" | "not_found"> {
  try {
    const container = docker.getContainer(containerId);
    const info = await container.inspect();
    return info.State.Running ? "running" : "stopped";
  } catch {
    return "not_found";
  }
}

/**
 * Clean up orphaned voxel containers (those not in the DB).
 */
export async function cleanupOrphanedContainers(
  knownContainerIds: Set<string>,
): Promise<void> {
  try {
    const containers = await docker.listContainers({
      all: true,
      filters: { name: [CONTAINER_PREFIX] },
    });

    for (const containerInfo of containers) {
      if (!knownContainerIds.has(containerInfo.Id)) {
        try {
          const container = docker.getContainer(containerInfo.Id);
          await container.remove({ force: true });
          console.log(
            `[Docker] Cleaned up orphaned container ${containerInfo.Names?.[0] ?? containerInfo.Id.slice(0, 12)}`,
          );
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  } catch {
    // Ignore if Docker not available
  }
}

/**
 * Get the Docker instance for direct API access.
 */
export function getDockerInstance(): Docker {
  return docker;
}
