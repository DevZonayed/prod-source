import Database from "better-sqlite3";
import * as path from "path";
import * as fs from "fs";
import type { UIMessage } from "ai";

const DATA_DIR = process.env.VOXEL_DATA_DIR || path.join(process.env.HOME || "/root", ".voxel", "data");

let _db: Database.Database | null = null;

function getDb(): Database.Database {
  if (_db) return _db;

  fs.mkdirSync(DATA_DIR, { recursive: true });
  const dbPath = path.join(DATA_DIR, "voxel.db");
  _db = new Database(dbPath);

  // Enable WAL mode for better concurrent access
  _db.pragma("journal_mode = WAL");

  // Create tables
  _db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL,
      host_path TEXT,
      source TEXT NOT NULL CHECK(source IN ('new', 'existing', 'github')),
      framework TEXT NOT NULL DEFAULT 'nextjs',
      dev_command TEXT NOT NULL DEFAULT 'npm run dev',
      dev_port INTEGER,
      github_url TEXT,
      github_token_id TEXT,
      preview_url TEXT,
      container_id TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // Migration: add container_id column if missing (for existing DBs)
  try {
    _db.exec(`ALTER TABLE projects ADD COLUMN container_id TEXT;`);
  } catch {
    // Column already exists
  }

  _db.exec(`

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      messages TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS github_tokens (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      token TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  return _db;
}

// ─── Project Types ───

export type ProjectRecord = {
  id: string;
  name: string;
  path: string;
  hostPath: string | null;
  source: "new" | "existing" | "github";
  framework: string;
  devCommand: string;
  devPort: number | null;
  githubUrl: string | null;
  githubTokenId: string | null;
  previewUrl: string | null;
  containerId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ConversationRecord = {
  id: string;
  projectId: string;
  title: string;
  messages: UIMessage[];
  createdAt: string;
  updatedAt: string;
};

export type ConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type GitHubTokenRecord = {
  id: string;
  label: string;
  token: string;
  createdAt: string;
};

// ─── Project CRUD ───

export function createProject(project: {
  id: string;
  name: string;
  path: string;
  hostPath?: string;
  source: "new" | "existing" | "github";
  framework: string;
  devCommand: string;
  devPort?: number;
  githubUrl?: string;
  githubTokenId?: string;
  previewUrl?: string;
  containerId?: string;
}): ProjectRecord {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO projects (id, name, path, host_path, source, framework, dev_command, dev_port, github_url, github_token_id, preview_url, container_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    project.id,
    project.name,
    project.path,
    project.hostPath ?? null,
    project.source,
    project.framework,
    project.devCommand,
    project.devPort ?? null,
    project.githubUrl ?? null,
    project.githubTokenId ?? null,
    project.previewUrl ?? null,
    project.containerId ?? null,
    now,
    now,
  );

  return getProject(project.id)!;
}

export function getProject(id: string): ProjectRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapProjectRow(row);
}

export function listProjects(): ProjectRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM projects ORDER BY updated_at DESC").all() as Record<string, unknown>[];
  return rows.map(mapProjectRow);
}

export function updateProject(id: string, updates: Partial<{
  name: string;
  devPort: number;
  previewUrl: string;
  devCommand: string;
  githubUrl: string;
  githubTokenId: string;
  containerId: string;
}>): ProjectRecord | null {
  const db = getDb();
  const fields: string[] = [];
  const values: unknown[] = [];

  if (updates.name !== undefined) { fields.push("name = ?"); values.push(updates.name); }
  if (updates.devPort !== undefined) { fields.push("dev_port = ?"); values.push(updates.devPort); }
  if (updates.previewUrl !== undefined) { fields.push("preview_url = ?"); values.push(updates.previewUrl); }
  if (updates.devCommand !== undefined) { fields.push("dev_command = ?"); values.push(updates.devCommand); }
  if (updates.githubUrl !== undefined) { fields.push("github_url = ?"); values.push(updates.githubUrl); }
  if (updates.githubTokenId !== undefined) { fields.push("github_token_id = ?"); values.push(updates.githubTokenId); }
  if (updates.containerId !== undefined) { fields.push("container_id = ?"); values.push(updates.containerId); }

  if (fields.length === 0) return getProject(id);

  fields.push("updated_at = ?");
  values.push(new Date().toISOString());
  values.push(id);

  db.prepare(`UPDATE projects SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  return getProject(id);
}

export function deleteProject(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM projects WHERE id = ?").run(id);
  return result.changes > 0;
}

function mapProjectRow(row: Record<string, unknown>): ProjectRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    path: row.path as string,
    hostPath: (row.host_path as string) ?? null,
    source: row.source as "new" | "existing" | "github",
    framework: row.framework as string,
    devCommand: row.dev_command as string,
    devPort: (row.dev_port as number) ?? null,
    githubUrl: (row.github_url as string) ?? null,
    githubTokenId: (row.github_token_id as string) ?? null,
    previewUrl: (row.preview_url as string) ?? null,
    containerId: (row.container_id as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Conversation CRUD ───

export function createConversation(conv: {
  id: string;
  projectId: string;
  title: string;
  messages?: UIMessage[];
}): ConversationRecord {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO conversations (id, project_id, title, messages, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    conv.id,
    conv.projectId,
    conv.title,
    JSON.stringify(conv.messages ?? []),
    now,
    now,
  );

  return getConversation(conv.id)!;
}

export function getConversation(id: string): ConversationRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM conversations WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return mapConversationRow(row);
}

export function listConversations(projectId: string): ConversationSummary[] {
  const db = getDb();
  const rows = db.prepare(
    "SELECT id, title, created_at, updated_at FROM conversations WHERE project_id = ? ORDER BY updated_at DESC"
  ).all(projectId) as Record<string, unknown>[];

  return rows.map((row) => ({
    id: row.id as string,
    title: row.title as string,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }));
}

export function saveConversationMessages(
  id: string,
  messages: UIMessage[],
  title?: string,
): void {
  const db = getDb();
  const now = new Date().toISOString();

  if (title) {
    db.prepare(
      "UPDATE conversations SET messages = ?, title = ?, updated_at = ? WHERE id = ?"
    ).run(JSON.stringify(messages), title, now, id);
  } else {
    db.prepare(
      "UPDATE conversations SET messages = ?, updated_at = ? WHERE id = ?"
    ).run(JSON.stringify(messages), now, id);
  }
}

export function deleteConversation(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM conversations WHERE id = ?").run(id);
  return result.changes > 0;
}

function mapConversationRow(row: Record<string, unknown>): ConversationRecord {
  let messages: UIMessage[] = [];
  try {
    messages = JSON.parse(row.messages as string);
  } catch {
    messages = [];
  }

  return {
    id: row.id as string,
    projectId: row.project_id as string,
    title: row.title as string,
    messages,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── GitHub Tokens ───

export function createGitHubToken(token: {
  id: string;
  label: string;
  token: string;
}): GitHubTokenRecord {
  const db = getDb();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO github_tokens (id, label, token, created_at)
    VALUES (?, ?, ?, ?)
  `).run(token.id, token.label, token.token, now);

  return { ...token, createdAt: now };
}

export function listGitHubTokens(): GitHubTokenRecord[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM github_tokens ORDER BY created_at DESC").all() as Record<string, unknown>[];
  return rows.map((row) => ({
    id: row.id as string,
    label: row.label as string,
    token: row.token as string,
    createdAt: row.created_at as string,
  }));
}

export function getGitHubToken(id: string): GitHubTokenRecord | null {
  const db = getDb();
  const row = db.prepare("SELECT * FROM github_tokens WHERE id = ?").get(id) as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    id: row.id as string,
    label: row.label as string,
    token: row.token as string,
    createdAt: row.created_at as string,
  };
}

export function deleteGitHubToken(id: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM github_tokens WHERE id = ?").run(id);
  return result.changes > 0;
}

// ─── Settings ───

export function getSetting(key: string): string | null {
  const db = getDb();
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  const db = getDb();
  db.prepare(`
    INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = ?
  `).run(key, value, value);
}

export function deleteSetting(key: string): boolean {
  const db = getDb();
  const result = db.prepare("DELETE FROM settings WHERE key = ?").run(key);
  return result.changes > 0;
}

// ─── Close DB ───

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
