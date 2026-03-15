import type { Vm } from "@/lib/local-vm";
import { WORKDIR } from "../vars";
import { KNOWLEDGE_DIR } from "./constants";
import type { KnowledgeItemMeta } from "./types";
import { ensureDir, readVmFile, writeVmFile, runVmCommand, shellQuote } from "./tools/helpers";

const knowledgePath = `${WORKDIR}/${KNOWLEDGE_DIR}`;

/**
 * Gets summaries of all Knowledge Items stored in the workspace.
 * Returns compact summaries suitable for ephemeral message injection.
 */
export async function getKiSummaries(
  vm: Vm,
): Promise<string[]> {
  try {
    // List all KI directories
    const listResult = await runVmCommand(
      vm,
      `ls -d ${shellQuote(knowledgePath)}/*/  2>/dev/null || echo ""`,
    );

    if (!listResult.stdout.trim()) return [];

    const dirs = listResult.stdout
      .split("\n")
      .filter(Boolean)
      .map((d) => d.trim().replace(/\/$/, ""));

    const summaries: string[] = [];

    for (const dir of dirs.slice(0, 20)) {
      const metaPath = `${dir}/metadata.json`;
      const content = await readVmFile(vm, metaPath);
      if (!content) continue;

      try {
        const meta = JSON.parse(content) as KnowledgeItemMeta;
        const artifactList = meta.artifacts.length > 0
          ? ` — artifacts: ${meta.artifacts.join(", ")}`
          : "";
        summaries.push(`KI-${meta.id}: "${meta.title}" - ${meta.summary}${artifactList}`);
      } catch {
        // Skip malformed metadata
      }
    }

    return summaries;
  } catch {
    return [];
  }
}

/**
 * Creates a new Knowledge Item.
 */
export async function createKi(
  vm: Vm,
  id: string,
  title: string,
  summary: string,
  tags: string[],
  artifacts: Record<string, string>,
): Promise<void> {
  const kiPath = `${knowledgePath}/${id}`;
  await ensureDir(vm, `${kiPath}/artifacts`);

  const meta: KnowledgeItemMeta = {
    id,
    title,
    summary,
    tags,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    artifacts: Object.keys(artifacts),
  };

  await writeVmFile(vm, `${kiPath}/metadata.json`, JSON.stringify(meta, null, 2));

  for (const [name, content] of Object.entries(artifacts)) {
    await writeVmFile(vm, `${kiPath}/artifacts/${name}`, content);
  }
}

/**
 * Reads a specific KI artifact.
 */
export async function readKiArtifact(
  vm: Vm,
  kiId: string,
  artifactName: string,
): Promise<string | null> {
  return readVmFile(vm, `${knowledgePath}/${kiId}/artifacts/${artifactName}`);
}

/**
 * Searches Knowledge Items by keyword matching against titles and summaries.
 */
export async function searchKis(
  vm: Vm,
  query: string,
): Promise<KnowledgeItemMeta[]> {
  const summaries = await getKiSummaries(vm);
  if (summaries.length === 0) return [];

  const terms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  // List all KI directories and read metadata
  const listResult = await runVmCommand(
    vm,
    `ls -d ${shellQuote(knowledgePath)}/*/  2>/dev/null || echo ""`,
  );

  if (!listResult.stdout.trim()) return [];

  const dirs = listResult.stdout
    .split("\n")
    .filter(Boolean)
    .map((d) => d.trim().replace(/\/$/, ""));

  const results: Array<{ meta: KnowledgeItemMeta; score: number }> = [];

  for (const dir of dirs) {
    const content = await readVmFile(vm, `${dir}/metadata.json`);
    if (!content) continue;

    try {
      const meta = JSON.parse(content) as KnowledgeItemMeta;
      const searchable = `${meta.title} ${meta.summary} ${meta.tags.join(" ")}`.toLowerCase();
      const score = terms.filter((t) => searchable.includes(t)).length;
      if (score > 0) results.push({ meta, score });
    } catch {
      // Skip
    }
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((r) => r.meta);
}
