// =============================================================================
// Level 2: Project Memory — Per-Project Persistent Files
// Reads/writes memory files stored in the VM at .buildforge/memory/
// =============================================================================

import type { Vm } from "@/lib/local-vm";
import type { MemoryFileType, ProjectMemoryState, AppSpec } from "../../types";
import { MEMORY_FILES, SPEC_FILE, BUILDFORGE_DIR, MEMORY_DIR } from "../../constants";
import { MEMORY_TEMPLATES } from "./templates";

const WORKDIR = "/workspace";

/**
 * Check if BuildForge has been initialized in the workspace.
 */
export const isInitialized = async (vm: Vm): Promise<boolean> => {
  try {
    const result = await vm.exec({
      command: `test -d ${WORKDIR}/${BUILDFORGE_DIR} && echo "yes" || echo "no"`,
    });
    const output = typeof result === "string" ? result : String(result);
    return output.trim() === "yes";
  } catch {
    return false;
  }
};

/**
 * Initialize the BuildForge memory system in the workspace.
 * Creates the .buildforge/memory/ directory and all template files.
 */
export const initializeMemory = async (
  vm: Vm,
  projectName: string,
  techStackSummary?: string,
): Promise<void> => {
  // Create directory structure
  await vm.exec({
    command: `mkdir -p ${WORKDIR}/${MEMORY_DIR}`,
  });

  // Write all memory template files
  for (const [fileType, path] of Object.entries(MEMORY_FILES)) {
    const template = MEMORY_TEMPLATES[fileType as MemoryFileType];
    const content = template
      .replace(/\{\{PROJECT_NAME\}\}/g, projectName)
      .replace(/\{\{TECH_STACK\}\}/g, techStackSummary ?? "Next.js + Tailwind + shadcn/ui")
      .replace(/\{\{DATE\}\}/g, new Date().toISOString().split("T")[0]);

    await vm.fs.writeTextFile(path, content);
  }
};

/**
 * Read a specific memory file.
 */
export const readMemoryFile = async (
  vm: Vm,
  fileType: MemoryFileType,
): Promise<string | null> => {
  const path = MEMORY_FILES[fileType];
  try {
    const content = await vm.fs.readTextFile(path);
    return typeof content === "string" ? content : String(content);
  } catch {
    return null;
  }
};

/**
 * Write a specific memory file (full replace).
 */
export const writeMemoryFile = async (
  vm: Vm,
  fileType: MemoryFileType,
  content: string,
): Promise<void> => {
  const path = MEMORY_FILES[fileType];
  await vm.fs.writeTextFile(path, content);
};

/**
 * Append content to a memory file (for changelog, issues-resolved).
 */
export const appendToMemoryFile = async (
  vm: Vm,
  fileType: MemoryFileType,
  entry: string,
): Promise<void> => {
  const path = MEMORY_FILES[fileType];
  let existing = "";
  try {
    const current = await vm.fs.readTextFile(path);
    existing = typeof current === "string" ? current : String(current);
  } catch {
    existing = "";
  }

  const timestamp = new Date().toISOString();
  const newEntry = `\n## [${timestamp}]\n${entry}\n`;
  await vm.fs.writeTextFile(path, existing + newEntry);
};

/**
 * Update a specific section within a memory file.
 * Finds the section by heading and replaces its content.
 */
export const updateMemorySection = async (
  vm: Vm,
  fileType: MemoryFileType,
  sectionHeading: string,
  newContent: string,
): Promise<boolean> => {
  const content = await readMemoryFile(vm, fileType);
  if (!content) return false;

  // Find the section by heading (## heading)
  const headingPattern = new RegExp(
    `(## ${escapeRegex(sectionHeading)}\\s*\\n)([\\s\\S]*?)(?=\\n## |$)`,
  );

  const match = content.match(headingPattern);
  if (!match) {
    // Section not found, append it
    const appendContent = `\n## ${sectionHeading}\n${newContent}\n`;
    await vm.fs.writeTextFile(MEMORY_FILES[fileType], content + appendContent);
    return true;
  }

  const updated = content.replace(headingPattern, `$1${newContent}\n`);
  await vm.fs.writeTextFile(MEMORY_FILES[fileType], updated);
  return true;
};

/**
 * Read a specific section from a memory file by heading.
 */
export const readMemorySection = async (
  vm: Vm,
  fileType: MemoryFileType,
  sectionHeading: string,
): Promise<string | null> => {
  const content = await readMemoryFile(vm, fileType);
  if (!content) return null;

  const headingPattern = new RegExp(
    `## ${escapeRegex(sectionHeading)}\\s*\\n([\\s\\S]*?)(?=\\n## |$)`,
  );

  const match = content.match(headingPattern);
  return match ? match[1].trim() : null;
};

/**
 * Search across all memory files for a keyword/phrase.
 * Returns matching sections with their file types.
 */
export const searchMemory = async (
  vm: Vm,
  query: string,
): Promise<Array<{ fileType: MemoryFileType; section: string; content: string }>> => {
  const results: Array<{ fileType: MemoryFileType; section: string; content: string }> = [];
  const queryLower = query.toLowerCase();

  for (const fileType of Object.keys(MEMORY_FILES) as MemoryFileType[]) {
    const content = await readMemoryFile(vm, fileType);
    if (!content) continue;

    // Split into sections and search each
    const sections = content.split(/(?=^## )/m);
    for (const section of sections) {
      if (section.toLowerCase().includes(queryLower)) {
        const headingMatch = section.match(/^## (.+)/);
        const heading = headingMatch ? headingMatch[1].trim() : "root";
        results.push({
          fileType,
          section: heading,
          content: section.trim(),
        });
      }
    }
  }

  return results;
};

/**
 * Read the app specification file.
 */
export const readSpec = async (vm: Vm): Promise<AppSpec | null> => {
  try {
    const content = await vm.fs.readTextFile(SPEC_FILE);
    const text = typeof content === "string" ? content : String(content);
    return JSON.parse(text) as AppSpec;
  } catch {
    return null;
  }
};

/**
 * Write the app specification file.
 */
export const writeSpec = async (vm: Vm, spec: AppSpec): Promise<void> => {
  await vm.fs.writeTextFile(SPEC_FILE, JSON.stringify(spec, null, 2));
};

/**
 * Get the full project memory state.
 */
export const getProjectMemoryState = async (
  vm: Vm,
): Promise<ProjectMemoryState> => {
  const initialized = await isInitialized(vm);
  if (!initialized) {
    return {
      initialized: false,
      files: {
        architecture: null,
        entities: null,
        components: null,
        "api-endpoints": null,
        "business-rules": null,
        "ui-patterns": null,
        "issues-resolved": null,
        changelog: null,
        decisions: null,
      },
      spec: null,
    };
  }

  const files: Record<string, { content: string; updatedAt: string } | null> = {};
  for (const fileType of Object.keys(MEMORY_FILES) as MemoryFileType[]) {
    const content = await readMemoryFile(vm, fileType);
    files[fileType] = content
      ? { content, updatedAt: new Date().toISOString() }
      : null;
  }

  const spec = await readSpec(vm);

  return {
    initialized: true,
    files: files as ProjectMemoryState["files"],
    spec,
  };
};

// Helper
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
