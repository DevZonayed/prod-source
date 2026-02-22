import { NextResponse } from "next/server";
import { freestyle } from "freestyle-sandboxes";
import { createVmForRepo, adorableVmSpec } from "@/lib/adorable-vm";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import { readRepoMetadata, writeRepoMetadata } from "@/lib/repo-storage";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ repoId: string }> },
) {
  const { repoId } = await params;

  const { identity } = await getOrCreateIdentitySession();
  const { repositories } = await identity.permissions.git.list({ limit: 200 });
  const hasAccess = repositories.some((repo) => repo.id === repoId);

  if (!hasAccess) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const metadata = await readRepoMetadata(repoId);
  if (!metadata) {
    return NextResponse.json(
      { error: "Repository metadata not found" },
      { status: 404 },
    );
  }

  const currentVmId = metadata.vm?.vmId;

  // If we have a VM ID, try to check its status
  if (currentVmId) {
    try {
      const { vm } = await freestyle.vms.get({
        vmId: currentVmId,
        spec: adorableVmSpec,
      });
      const info = await vm.getInfo();

      if (info.state === "stopped") {
        // VM exists but is stopped – start it
        await vm.start();
        return NextResponse.json({
          status: "started",
          vmId: currentVmId,
          vm: metadata.vm,
        });
      }

      // VM is running or starting – it's healthy
      return NextResponse.json({
        status: "healthy",
        vmId: currentVmId,
        vmState: info.state,
        vm: metadata.vm,
      });
    } catch {
      // VM doesn't exist or is broken – fall through to recreate
      console.log(
        `[vm-health] VM ${currentVmId} for repo ${repoId} is broken, recreating...`,
      );
    }
  }

  // Recreate the VM
  try {
    const newVm = await createVmForRepo(repoId);

    await identity.permissions.vms.grant({
      vmId: newVm.vmId,
    });

    const updatedMetadata = {
      ...metadata,
      vm: newVm,
    };
    await writeRepoMetadata(repoId, updatedMetadata);

    return NextResponse.json({
      status: "recreated",
      vmId: newVm.vmId,
      vm: newVm,
    });
  } catch (err) {
    console.error(`[vm-health] Failed to recreate VM for repo ${repoId}:`, err);
    return NextResponse.json(
      { error: "Failed to recreate VM" },
      { status: 500 },
    );
  }
}
