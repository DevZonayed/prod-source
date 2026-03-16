import { NextRequest, NextResponse } from "next/server";
import { getContainerForProject } from "@/lib/docker-manager";

function sanitizePath(filePath: string): string | null {
  const normalized = filePath.replace(/\\/g, "/");
  if (normalized.includes("..") || !normalized.startsWith("/workspace")) {
    return null;
  }
  return normalized;
}

const EXCLUDED_DIRS = new Set([
  "node_modules",
  ".next",
  ".git",
  ".cache",
  "__pycache__",
]);

/**
 * Strip Docker stream multiplexing headers from exec output.
 * Docker prefixes each frame with an 8-byte header when AttachStdout is used.
 */
function stripDockerHeaders(raw: string): string {
  if (raw.length === 0) return raw;
  const firstByte = raw.charCodeAt(0);
  if (firstByte !== 1 && firstByte !== 2) return raw;

  let result = "";
  let offset = 0;
  const buf = Buffer.from(raw, "binary");
  while (offset < buf.length) {
    if (offset + 8 > buf.length) break;
    const size = buf.readUInt32BE(offset + 4);
    offset += 8;
    if (offset + size > buf.length) {
      result += buf.subarray(offset).toString("utf-8");
      break;
    }
    result += buf.subarray(offset, offset + size).toString("utf-8");
    offset += size;
  }
  return result;
}

async function execInContainer(
  container: Awaited<ReturnType<typeof getContainerForProject>>,
  cmd: string[],
): Promise<string> {
  const exec = await container!.exec({
    Cmd: cmd,
    AttachStdout: true,
    AttachStderr: true,
  });
  const stream = await exec.start({});
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve) => {
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", resolve);
  });
  return stripDockerHeaders(Buffer.concat(chunks).toString("utf-8"));
}

export async function GET(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const dirPath = req.nextUrl.searchParams.get("path");
  const filePath = req.nextUrl.searchParams.get("file");

  if (!projectId) {
    return NextResponse.json({ error: "projectId required" }, { status: 400 });
  }

  const container = await getContainerForProject(projectId);
  if (!container) {
    return NextResponse.json(
      { error: "Container not found" },
      { status: 404 },
    );
  }

  // Read file content
  if (filePath) {
    const safe = sanitizePath(filePath);
    if (!safe) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    try {
      const content = await execInContainer(container, ["cat", safe]);
      return NextResponse.json({ content });
    } catch {
      return NextResponse.json(
        { error: "Failed to read file" },
        { status: 500 },
      );
    }
  }

  // List directory
  if (dirPath) {
    const safe = sanitizePath(dirPath);
    if (!safe) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }

    try {
      const output = await execInContainer(container, [
        "bash",
        "-c",
        `find ${safe} -maxdepth 1 -mindepth 1 -printf '%y %p\\n' 2>/dev/null | sort`,
      ]);
      const entries = output
        .trim()
        .split("\n")
        .filter(Boolean)
        .map((line) => {
          const type = line.charAt(0) === "d" ? "directory" : "file";
          const fullPath = line.substring(2);
          const name = fullPath.split("/").pop() || "";
          return { name, path: fullPath, type };
        })
        .filter((e) => !EXCLUDED_DIRS.has(e.name));

      return NextResponse.json({ entries });
    } catch {
      return NextResponse.json(
        { error: "Failed to list directory" },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: "Provide path or file parameter" },
    { status: 400 },
  );
}

export async function PUT(req: NextRequest) {
  const projectId = req.nextUrl.searchParams.get("projectId");
  const filePath = req.nextUrl.searchParams.get("file");

  if (!projectId || !filePath) {
    return NextResponse.json(
      { error: "projectId and file required" },
      { status: 400 },
    );
  }

  const safe = sanitizePath(filePath);
  if (!safe) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const body = await req.json();
  const { content } = body;

  if (typeof content !== "string") {
    return NextResponse.json(
      { error: "content must be a string" },
      { status: 400 },
    );
  }

  const container = await getContainerForProject(projectId);
  if (!container) {
    return NextResponse.json(
      { error: "Container not found" },
      { status: 404 },
    );
  }

  try {
    // Write file content using base64 to avoid shell escaping issues
    const b64 = Buffer.from(content, "utf-8").toString("base64");
    await execInContainer(container, [
      "bash",
      "-c",
      `echo '${b64}' | base64 -d > ${safe}`,
    ]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to write file" },
      { status: 500 },
    );
  }
}
