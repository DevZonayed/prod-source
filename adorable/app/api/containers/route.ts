import { NextResponse } from "next/server";
import {
  getOrCreateContainer,
  stopContainer,
  removeContainer,
  getContainerStatus,
  isDockerAvailable,
} from "@/lib/docker-manager";
import { getProject, updateProject } from "@/lib/local-storage";
import { allocatePort } from "@/lib/port-manager";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const projectId = searchParams.get("projectId");

  if (!projectId) {
    const dockerUp = await isDockerAvailable();
    return NextResponse.json({ dockerAvailable: dockerUp });
  }

  const project = getProject(projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Project not found" },
      { status: 404 },
    );
  }

  if (!project.containerId) {
    return NextResponse.json({
      status: "no_container",
      containerId: null,
    });
  }

  const status = await getContainerStatus(project.containerId);
  return NextResponse.json({
    status,
    containerId: project.containerId,
  });
}

export async function POST(req: Request) {
  try {
    const payload = (await req.json()) as {
      projectId: string;
      action: "create" | "start" | "stop" | "remove";
    };

    if (!payload.projectId) {
      return NextResponse.json(
        { error: "projectId is required" },
        { status: 400 },
      );
    }

    const project = getProject(payload.projectId);
    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 },
      );
    }

    const dockerUp = await isDockerAvailable();
    if (!dockerUp) {
      return NextResponse.json(
        { error: "Docker is not available" },
        { status: 503 },
      );
    }

    switch (payload.action) {
      case "create":
      case "start": {
        const port = await allocatePort(payload.projectId);
        const containerId = await getOrCreateContainer(
          payload.projectId,
          project.path,
          port,
          project.containerId,
        );

        if (project.containerId !== containerId) {
          updateProject(payload.projectId, { containerId });
        }

        return NextResponse.json({
          ok: true,
          containerId,
          status: "running",
        });
      }

      case "stop": {
        if (project.containerId) {
          await stopContainer(project.containerId);
        }
        return NextResponse.json({ ok: true, status: "stopped" });
      }

      case "remove": {
        if (project.containerId) {
          await removeContainer(project.containerId);
          updateProject(payload.projectId, { containerId: "" });
        }
        return NextResponse.json({ ok: true, status: "removed" });
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${payload.action}` },
          { status: 400 },
        );
    }
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Container operation failed",
      },
      { status: 500 },
    );
  }
}
