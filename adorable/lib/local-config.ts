import * as fs from "fs";
import * as path from "path";

const DATA_DIR = process.env.VOXEL_DATA_DIR || path.join(process.env.HOME || "/root", ".voxel", "data");
const CONFIG_PATH = path.join(DATA_DIR, "config.json");

export type VoxelConfig = {
  llm?: {
    provider?: string;
    openaiApiKey?: string;
    anthropicApiKey?: string;
    model?: string;
  };
  github?: {
    defaultTokenId?: string;
  };
  server?: {
    port?: number;
  };
};

export function readConfig(): VoxelConfig {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return {};
    const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
    return JSON.parse(raw) as VoxelConfig;
  } catch {
    return {};
  }
}

export function writeConfig(config: VoxelConfig): void {
  fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
  // Set restrictive permissions (owner read/write only)
  try {
    fs.chmodSync(CONFIG_PATH, 0o600);
  } catch {
    // Ignore on Windows
  }
}

export function updateConfig(updates: Partial<VoxelConfig>): VoxelConfig {
  const current = readConfig();
  const merged: VoxelConfig = {
    ...current,
    ...(updates.llm ? { llm: { ...current.llm, ...updates.llm } } : {}),
    ...(updates.github ? { github: { ...current.github, ...updates.github } } : {}),
    ...(updates.server ? { server: { ...current.server, ...updates.server } } : {}),
  };
  // Preserve existing keys not in updates
  if (!updates.llm && current.llm) merged.llm = current.llm;
  if (!updates.github && current.github) merged.github = current.github;
  if (!updates.server && current.server) merged.server = current.server;

  writeConfig(merged);
  return merged;
}

export function getConfigPath(): string {
  return CONFIG_PATH;
}
