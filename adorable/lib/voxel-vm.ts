import { LocalVm, getOrCreateLocalVm } from "@/lib/local-vm";
import { DockerVm, getOrCreateDockerVm } from "@/lib/docker-vm";
import {
  isDockerAvailable,
  ensureSandboxImage,
  getOrCreateContainer,
} from "@/lib/docker-manager";
import { getProject, updateProject } from "@/lib/local-storage";
import { getProjectDir, APP_PORT } from "@/lib/vars";
import { allocatePort } from "@/lib/port-manager";
import type { Vm } from "@/lib/local-vm";

export type VmRuntimeMetadata = {
  vmId: string;
  previewUrl: string;
  devCommandTerminalUrl: string;
  additionalTerminalsUrl: string;
};

let _dockerAvailable: boolean | null = null;
let _imageReady = false;

async function checkDocker(): Promise<boolean> {
  if (_dockerAvailable !== null) return _dockerAvailable;
  _dockerAvailable = await isDockerAvailable();
  if (_dockerAvailable && !_imageReady) {
    try {
      await ensureSandboxImage();
      _imageReady = true;
    } catch (err) {
      console.error("[Docker] Failed to build sandbox image:", err);
      _dockerAvailable = false;
    }
  }
  if (!_dockerAvailable) {
    console.warn("[VM] Docker not available, falling back to LocalVm (no isolation)");
  }
  return _dockerAvailable;
}

/**
 * Create a VM (Docker container or local fallback) for a project.
 */
export const createVmForRepo = async (
  projectId: string,
  projectPath?: string,
): Promise<VmRuntimeMetadata> => {
  const projectDir = projectPath || getProjectDir(projectId);
  const port = await allocatePort(projectId);
  const useDocker = await checkDocker();

  if (useDocker) {
    // Get existing container ID from DB if available
    const project = getProject(projectId);
    const existingContainerId = project?.containerId;

    const containerId = await getOrCreateContainer(
      projectId,
      projectDir,
      port,
      existingContainerId,
    );

    // Save container ID to DB
    if (project && project.containerId !== containerId) {
      updateProject(projectId, { containerId });
    }

    getOrCreateDockerVm(projectId, containerId, projectDir);
  } else {
    getOrCreateLocalVm(projectId, projectDir);
  }

  return {
    vmId: projectId,
    previewUrl: `http://localhost:${port}`,
    devCommandTerminalUrl: `ws://localhost:${APP_PORT}/ws/terminal?projectId=${projectId}`,
    additionalTerminalsUrl: `ws://localhost:${APP_PORT}/ws/terminal?projectId=${projectId}&session=additional`,
  };
};

/**
 * Get a reference to an existing VM (Docker or Local).
 */
export const getVmRef = (
  projectId: string,
  projectPath?: string,
): Vm => {
  const projectDir = projectPath || getProjectDir(projectId);

  // Check if we already have an active DockerVm
  const { getActiveDockerVm } = require("@/lib/docker-vm");
  const existingDocker = getActiveDockerVm(projectId);
  if (existingDocker) return existingDocker;

  // Check if we have an active LocalVm
  const { getActiveVm } = require("@/lib/local-vm");
  const existingLocal = getActiveVm(projectId);
  if (existingLocal) return existingLocal;

  // No active VM — check if project has a container ID
  const project = getProject(projectId);
  if (project?.containerId) {
    return getOrCreateDockerVm(projectId, project.containerId, projectDir);
  }

  // Fallback to LocalVm
  return getOrCreateLocalVm(projectId, projectDir);
};
