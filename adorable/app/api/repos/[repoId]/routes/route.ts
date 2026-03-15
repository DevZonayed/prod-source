import { getVmRef } from "@/lib/voxel-vm";
import { readRepoMetadata } from "@/lib/repo-storage";
import { getProject } from "@/lib/local-storage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;

  const metadata = await readRepoMetadata(repoId);
  if (!metadata) {
    return Response.json(
      { error: "Repository metadata not found." },
      { status: 404 },
    );
  }

  const project = getProject(repoId);
  if (!project) {
    return Response.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  const vm = getVmRef(repoId, project.path);

  try {
    const result = await vm.exec({
      command: `find app -type f \\( -name "page.tsx" -o -name "page.jsx" -o -name "page.ts" -o -name "page.js" -o -name "route.ts" -o -name "route.js" \\) 2>/dev/null | sort`,
    });

    const stdout = result.stdout ?? "";

    const files = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const routes: { path: string; type: "page" | "api" }[] = [];

    for (const file of files) {
      let relative = file.replace(/^app/, "");

      const isApi = /\/route\.(ts|js)$/.test(file);
      relative = relative.replace(/\/(page|route)\.(tsx?|jsx?)$/, "");

      let routePath = relative || "/";

      if (routePath.startsWith("/api")) continue;

      routePath = routePath.replace(/\/\([^)]+\)/g, "");

      if (!routePath) routePath = "/";

      if (!routes.some((r) => r.path === routePath)) {
        routes.push({ path: routePath, type: isApi ? "api" : "page" });
      }
    }

    routes.sort((a, b) => {
      if (a.path === "/") return -1;
      if (b.path === "/") return 1;
      return a.path.localeCompare(b.path);
    });

    return Response.json({ routes });
  } catch {
    return Response.json({ routes: [{ path: "/", type: "page" }] });
  }
}
