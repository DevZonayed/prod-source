import { execFile } from "child_process";
import * as fs from "fs/promises";
import * as path from "path";

const MAX_LOG_LINES = 2000;

export type ExecResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
};

export interface VmFs {
  readTextFile(filePath: string): Promise<string>;
  readFile(filePath: string): Promise<string>;
  writeTextFile(filePath: string, content: string): Promise<void>;
}

export interface VmDevServer {
  getLogs(): Promise<string>;
}

export interface Vm {
  exec(opts: { command: string }): Promise<ExecResult>;
  fs: VmFs;
  devServer?: VmDevServer;
}

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

export class LocalVm implements Vm {
  private projectDir: string;
  private logBuffer: RingBuffer;
  fs: VmFs;
  devServer: VmDevServer;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
    this.logBuffer = new RingBuffer();

    this.fs = {
      readTextFile: async (filePath: string): Promise<string> => {
        const absPath = this.resolveProjectPath(filePath);
        return fs.readFile(absPath, "utf-8");
      },
      readFile: async (filePath: string): Promise<string> => {
        const absPath = this.resolveProjectPath(filePath);
        return fs.readFile(absPath, "utf-8");
      },
      writeTextFile: async (
        filePath: string,
        content: string,
      ): Promise<void> => {
        const absPath = this.resolveProjectPath(filePath);
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

  private resolveProjectPath(filePath: string): string {
    // If the path is already absolute and within projectDir, use it directly
    if (path.isAbsolute(filePath)) {
      const normalized = path.normalize(filePath);
      if (!normalized.startsWith(this.projectDir)) {
        throw new Error(
          `Path ${filePath} is outside the project directory`,
        );
      }
      return normalized;
    }
    // Otherwise treat as relative to projectDir
    const resolved = path.resolve(this.projectDir, filePath);
    if (!resolved.startsWith(this.projectDir)) {
      throw new Error(`Path ${filePath} escapes the project directory`);
    }
    return resolved;
  }

  async exec(opts: { command: string }): Promise<ExecResult> {
    return new Promise((resolve) => {
      execFile(
        "bash",
        ["-c", opts.command],
        {
          cwd: this.projectDir,
          maxBuffer: 10 * 1024 * 1024, // 10MB
          timeout: 120_000, // 2 minutes
          env: {
            ...process.env,
            HOME: process.env.HOME || "/root",
            PATH: process.env.PATH,
          },
        },
        (error, stdout, stderr) => {
          const exitCode = error ? (error as { code?: number }).code ?? 1 : 0;
          resolve({
            ok: exitCode === 0,
            stdout: stdout ?? "",
            stderr: stderr ?? "",
            exitCode,
          });
        },
      );
    });
  }

  appendLogs(text: string) {
    this.logBuffer.append(text);
  }

  clearLogs() {
    this.logBuffer.clear();
  }

  getProjectDir(): string {
    return this.projectDir;
  }
}

// Registry of active VMs (one per project)
const activeVms = new Map<string, LocalVm>();

export function getOrCreateLocalVm(projectId: string, projectDir: string): LocalVm {
  const existing = activeVms.get(projectId);
  if (existing) return existing;

  const vm = new LocalVm(projectDir);
  activeVms.set(projectId, vm);
  return vm;
}

export function getActiveVm(projectId: string): LocalVm | undefined {
  return activeVms.get(projectId);
}

export function removeActiveVm(projectId: string): void {
  activeVms.delete(projectId);
}
