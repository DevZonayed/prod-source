import Docker from "dockerode";
import * as fs from "fs/promises";
import * as path from "path";
import type { ExecResult, Vm, VmFs, VmDevServer } from "@/lib/local-vm";

const MAX_LOG_LINES = 2000;

class RingBuffer {
  private lines: string[] = [];
  private maxLines: number;

  constructor(maxLines: number = MAX_LOG_LINES) {
    this.maxLines = maxLines;
  }

  append(text: string) {
    const newLines = text.split("\n");
    this.lines.push(...newLines);
    if (this.lines.length > this.maxLines) {
      this.lines = this.lines.slice(-this.maxLines);
    }
  }

  getAll(): string {
    return this.lines.join("\n");
  }

  clear() {
    this.lines = [];
  }
}

/**
 * Demultiplex a Docker exec stream (non-TTY mode).
 * Docker prefixes each chunk with 8 bytes: [streamType(1), padding(3), size(4)]
 * streamType: 1=stdout, 2=stderr
 */
function demuxDockerStream(
  buffer: Buffer,
): { stdout: string; stderr: string } {
  let stdout = "";
  let stderr = "";
  let offset = 0;

  while (offset < buffer.length) {
    if (offset + 8 > buffer.length) break;

    const streamType = buffer[offset];
    const size = buffer.readUInt32BE(offset + 4);
    offset += 8;

    if (offset + size > buffer.length) break;

    const chunk = buffer.slice(offset, offset + size).toString("utf-8");
    if (streamType === 1) {
      stdout += chunk;
    } else if (streamType === 2) {
      stderr += chunk;
    }
    offset += size;
  }

  return { stdout, stderr };
}

export class DockerVm implements Vm {
  private docker: Docker;
  private container: Docker.Container;
  private hostProjectDir: string;
  private logBuffer: RingBuffer;
  private containerId: string;
  fs: VmFs;
  devServer: VmDevServer;

  constructor(containerId: string, hostProjectDir: string) {
    this.docker = new Docker();
    this.container = this.docker.getContainer(containerId);
    this.containerId = containerId;
    this.hostProjectDir = hostProjectDir;
    this.logBuffer = new RingBuffer();

    this.fs = {
      readTextFile: async (filePath: string): Promise<string> => {
        const absPath = this.resolveHostPath(filePath);
        return fs.readFile(absPath, "utf-8");
      },
      readFile: async (filePath: string): Promise<string> => {
        const absPath = this.resolveHostPath(filePath);
        return fs.readFile(absPath, "utf-8");
      },
      writeTextFile: async (
        filePath: string,
        content: string,
      ): Promise<void> => {
        const absPath = this.resolveHostPath(filePath);
        await fs.mkdir(path.dirname(absPath), { recursive: true });
        await fs.writeFile(absPath, content, "utf-8");
      },
    };

    this.devServer = {
      getLogs: async (): Promise<string> => {
        return this.logBuffer.getAll();
      },
    };
  }

  async exec(opts: { command: string }): Promise<ExecResult> {
    try {
      const exec = await this.container.exec({
        Cmd: ["bash", "-c", opts.command],
        WorkingDir: "/workspace",
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ hijack: true, stdin: false });

      // Collect all output
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on("data", (chunk: Buffer) => {
          chunks.push(chunk);
        });
        stream.on("end", () => resolve());
        stream.on("error", (err: Error) => reject(err));
      });

      const fullBuffer = Buffer.concat(chunks);
      const { stdout, stderr } = demuxDockerStream(fullBuffer);

      const inspectResult = await exec.inspect();
      const exitCode =
        typeof inspectResult.ExitCode === "number"
          ? inspectResult.ExitCode
          : null;

      return {
        ok: exitCode === 0,
        stdout,
        stderr,
        exitCode,
      };
    } catch (error) {
      return {
        ok: false,
        stdout: "",
        stderr:
          error instanceof Error
            ? error.message
            : "Docker exec failed",
        exitCode: 1,
      };
    }
  }

  /**
   * Create a long-running exec (for dev server, background processes).
   * Returns the stream for log capture and the exec instance for cleanup.
   */
  async execDetached(opts: {
    command: string;
    onData?: (data: string) => void;
  }): Promise<{ exec: Docker.Exec; stream: NodeJS.ReadableStream }> {
    const exec = await this.container.exec({
      Cmd: ["bash", "-c", opts.command],
      WorkingDir: "/workspace",
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await exec.start({ hijack: true, stdin: false });

    if (opts.onData) {
      stream.on("data", (chunk: Buffer) => {
        // For detached streams, try raw text first (simpler)
        const text = chunk.toString("utf-8");
        opts.onData!(text);
      });
    }

    return { exec, stream };
  }

  /**
   * Create an interactive TTY exec (for terminal sessions).
   */
  async execTty(): Promise<{
    exec: Docker.Exec;
    stream: NodeJS.ReadWriteStream;
  }> {
    const exec = await this.container.exec({
      Cmd: ["/bin/bash"],
      AttachStdin: true,
      AttachStdout: true,
      AttachStderr: true,
      Tty: true,
    });

    const stream = await exec.start({
      hijack: true,
      stdin: true,
      Tty: true,
    });

    return { exec, stream };
  }

  private resolveHostPath(filePath: string): string {
    let rel = filePath;

    // Handle /workspace paths (translate to host)
    if (filePath.startsWith("/workspace/")) {
      rel = filePath.slice("/workspace/".length);
    } else if (filePath === "/workspace") {
      return this.hostProjectDir;
    } else if (path.isAbsolute(filePath)) {
      // If it's already an absolute host path within project dir, use it
      const normalized = path.normalize(filePath);
      if (normalized.startsWith(this.hostProjectDir)) {
        return normalized;
      }
      throw new Error(
        `Path ${filePath} is outside the project directory`,
      );
    }

    const resolved = path.resolve(this.hostProjectDir, rel);
    if (!resolved.startsWith(this.hostProjectDir)) {
      throw new Error(`Path ${filePath} escapes the project directory`);
    }
    return resolved;
  }

  appendLogs(text: string) {
    this.logBuffer.append(text);
  }

  clearLogs() {
    this.logBuffer.clear();
  }

  getProjectDir(): string {
    return this.hostProjectDir;
  }

  getContainerId(): string {
    return this.containerId;
  }
}

// Registry of active DockerVms
const activeDockerVms = new Map<string, DockerVm>();

export function getOrCreateDockerVm(
  projectId: string,
  containerId: string,
  hostProjectDir: string,
): DockerVm {
  const existing = activeDockerVms.get(projectId);
  if (existing) return existing;

  const vm = new DockerVm(containerId, hostProjectDir);
  activeDockerVms.set(projectId, vm);
  return vm;
}

export function getActiveDockerVm(projectId: string): DockerVm | undefined {
  return activeDockerVms.get(projectId);
}

export function removeActiveDockerVm(projectId: string): void {
  activeDockerVms.delete(projectId);
}
