import { randomUUID } from "crypto";
import { NextResponse } from "next/server";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import {
  createProject,
  listProjects,
  getGitHubToken,
} from "@/lib/local-storage";
import {
  createConversationInRepo,
  readRepoMetadata,
  type RepoMetadata,
} from "@/lib/repo-storage";
import { getProjectDir, PROJECTS_DIR, HOST_PROJECTS_DIR, APP_PORT } from "@/lib/vars";
import { getTemplate, getDevCommand } from "@/lib/templates";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

export async function GET() {
  const { identityId } = await getOrCreateIdentitySession();
  const projects = listProjects();

  const items = await Promise.all(
    projects.map(async (project) => {
      const metadata = await readRepoMetadata(project.id);
      return {
        id: project.id,
        name: project.name,
        metadata,
      };
    }),
  );

  return NextResponse.json({
    identityId,
    repositories: items,
  });
}

export async function POST(req: Request) {
  let requestedName: string | undefined;
  let requestedConversationTitle: string | undefined;
  let githubRepoName: string | undefined;
  let framework: string = "nextjs";
  let existingPath: string | undefined;
  let githubTokenId: string | undefined;

  try {
    const payload = (await req.json()) as {
      name?: string;
      conversationTitle?: string;
      githubRepoName?: string;
      framework?: string;
      existingPath?: string;
      customDir?: string;
      githubTokenId?: string;
    };
    requestedName = payload?.name?.trim() || undefined;
    requestedConversationTitle = payload?.conversationTitle?.trim() || undefined;
    githubRepoName = payload?.githubRepoName?.trim() || undefined;
    framework = payload?.framework?.trim() || "nextjs";
    existingPath = payload?.existingPath?.trim() || payload?.customDir?.trim() || undefined;
    githubTokenId = payload?.githubTokenId?.trim() || undefined;
  } catch {
    // Defaults
  }

  const projectId = randomUUID();
  let projectPath: string;
  let projectSource: "new" | "existing" | "github" = "new";
  let githubUrl: string | undefined;

  if (existingPath) {
    // ─── Existing directory mode ───
    // The path should be under /host-projects (mounted from host)
    projectPath = existingPath.startsWith("/")
      ? existingPath
      : path.join(HOST_PROJECTS_DIR, existingPath);

    if (!fs.existsSync(projectPath)) {
      return NextResponse.json(
        { error: `Directory not found: ${existingPath}` },
        { status: 400 },
      );
    }

    projectSource = "existing";

    // Initialize git if not already a repo
    if (!fs.existsSync(path.join(projectPath, ".git"))) {
      try {
        execSync("git init", { cwd: projectPath, stdio: "pipe" });
        execSync("git add -A && git commit -m 'Initial commit' --allow-empty", {
          cwd: projectPath,
          stdio: "pipe",
        });
      } catch {
        // Non-fatal
      }
    }
  } else if (githubRepoName) {
    // ─── GitHub import mode ───
    projectPath = getProjectDir(projectId);
    projectSource = "github";
    githubUrl = githubRepoName.includes("://")
      ? githubRepoName
      : `https://github.com/${githubRepoName}`;

    fs.mkdirSync(projectPath, { recursive: true });

    // Get token if provided
    let cloneUrl = githubUrl;
    if (githubTokenId) {
      const tokenRecord = getGitHubToken(githubTokenId);
      if (tokenRecord) {
        cloneUrl = githubUrl.replace(
          "https://",
          `https://${tokenRecord.token}@`,
        );
      }
    }

    try {
      execSync(`git clone ${cloneUrl} .`, {
        cwd: projectPath,
        stdio: "pipe",
        timeout: 120_000,
      });
    } catch (e) {
      return NextResponse.json(
        { error: `Failed to clone: ${e instanceof Error ? e.message : "Unknown error"}` },
        { status: 500 },
      );
    }
  } else {
    // ─── New project from template ───
    projectPath = getProjectDir(projectId);
    fs.mkdirSync(projectPath, { recursive: true });

    const template = getTemplate(framework);

    if (template && template.templateRepo) {
      try {
        execSync(`git clone ${template.templateRepo} .`, {
          cwd: projectPath,
          stdio: "pipe",
          timeout: 120_000,
        });
        // Remove .git and reinitialize for fresh history
        fs.rmSync(path.join(projectPath, ".git"), { recursive: true, force: true });
        execSync("git init && git add -A && git commit -m 'Initial commit'", {
          cwd: projectPath,
          stdio: "pipe",
        });
      } catch (e) {
        return NextResponse.json(
          { error: `Failed to set up template: ${e instanceof Error ? e.message : "Unknown error"}` },
          { status: 500 },
        );
      }
    } else if (framework === "react") {
      // Scaffold React+Vite project
      try {
        execSync(
          `npm create vite@latest . -- --template react-ts`,
          { cwd: projectPath, stdio: "pipe", timeout: 120_000 },
        );
        execSync("git init && git add -A && git commit -m 'Initial commit'", {
          cwd: projectPath,
          stdio: "pipe",
        });
      } catch (e) {
        return NextResponse.json(
          { error: `Failed to scaffold React project: ${e instanceof Error ? e.message : "Unknown error"}` },
          { status: 500 },
        );
      }
    }
  }

  // Derive name and dev command (no container or port allocation here —
  // containers are created on-the-fly when the user visits the project page)
  const devCommand = getDevCommand(framework, 3000);

  const inferredName =
    requestedName ??
    githubRepoName?.split("/").pop()?.trim() ??
    (existingPath ? path.basename(existingPath) : "Project");

  // Create project record (no container yet — useContainer hook handles that)
  const project = createProject({
    id: projectId,
    name: inferredName,
    path: projectPath,
    hostPath: existingPath || undefined,
    source: projectSource,
    framework,
    devCommand,
    githubUrl,
    githubTokenId,
  });

  // Placeholder VM info — actual preview URL is set when container starts
  const vmPlaceholder = {
    vmId: projectId,
    previewUrl: `http://localhost:${APP_PORT}`,
    devCommandTerminalUrl: `ws://localhost:${APP_PORT}/ws/terminal?projectId=${projectId}`,
    additionalTerminalsUrl: `ws://localhost:${APP_PORT}/ws/terminal?projectId=${projectId}&session=additional`,
  };

  // Create initial metadata and conversation
  const initialMetadata: RepoMetadata = {
    version: 2,
    sourceRepoId: projectId,
    name: inferredName,
    vm: vmPlaceholder,
    conversations: [],
    deployments: [],
    productionDomain: null,
    productionDeploymentId: null,
  };

  const conversationId = randomUUID();
  const metadata = await createConversationInRepo(
    projectId,
    initialMetadata,
    conversationId,
    requestedConversationTitle,
  );

  return NextResponse.json({
    id: projectId,
    metadata,
    conversationId,
  });
}
