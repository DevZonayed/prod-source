import { freestyle } from "freestyle-sandboxes";
import { voxelVmSpec } from "@/lib/voxel-vm";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import { readRepoMetadata } from "@/lib/repo-storage";
import { WORKDIR } from "@/lib/vars";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;

  const { identity } = await getOrCreateIdentitySession();
  const { repositories } = await identity.permissions.git.list({ limit: 200 });
  const hasAccess = repositories.some((repo) => repo.id === repoId);

  if (!hasAccess) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const metadata = await readRepoMetadata(repoId);
  if (!metadata) {
    return Response.json(
      { error: "Repository metadata not found." },
      { status: 404 },
    );
  }

  const vm = freestyle.vms.ref({
    vmId: metadata.vm.vmId,
    spec: voxelVmSpec,
  });

  try {
    const result = await vm.exec({
      command: `find ${WORKDIR}/app -type f \\( -name "page.tsx" -o -name "page.jsx" -o -name "page.ts" -o -name "page.js" -o -name "route.ts" -o -name "route.js" \\) 2>/dev/null | sort`,
    });

    const stdout =
      typeof result === "string"
        ? result
        : result && typeof result === "object" && "stdout" in result
          ? String((result as Record<string, unknown>).stdout ?? "")
          : "";

    const files = stdout
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    const routes: { path: string; type: "page" | "api" }[] = [];

    for (const file of files) {
      // Strip workdir prefix and /app prefix
      let relative = file.replace(`${WORKDIR}/app`, "");

      // Remove the filename (page.tsx, route.ts, etc.)
      const isApi = /\/route\.(ts|js)$/.test(file);
      relative = relative.replace(/\/(page|route)\.(tsx?|jsx?)$/, "");

      // Convert Next.js dynamic segments for display
      let routePath = relative || "/";

      // Skip api routes from display
      if (routePath.startsWith("/api")) continue;

      // Handle route groups - remove (groupName) segments
      routePath = routePath.replace(/\/\([^)]+\)/g, "");

      // Normalize empty to /
      if (!routePath) routePath = "/";

      // Avoid duplicates
      if (!routes.some((r) => r.path === routePath)) {
        routes.push({ path: routePath, type: isApi ? "api" : "page" });
      }
    }

    // Sort with / first, then alphabetically
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
