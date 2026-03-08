import { type UIMessage } from "ai";
import { cookies } from "next/headers";
import { freestyle } from "freestyle-sandboxes";
import { createTools as createBaseTools } from "@/lib/create-tools";
import { streamLlmResponse } from "@/lib/llm-provider";
import { adorableVmSpec } from "@/lib/adorable-vm";
import { getOrCreateIdentitySession } from "@/lib/identity-session";
import { readRepoMetadata, saveConversationMessages } from "@/lib/repo-storage";
import { buildSystemPrompt, SYSTEM_PROMPT } from "@/lib/system-prompt";
import { getClaudeAccessToken } from "@/lib/claude-auth";
import {
  getToolsForPhase,
  detectPhase,
  getProjectMemoryState,
  readSpec,
} from "@/lib/buildforge";
import type { BuildForgeContext } from "@/lib/buildforge";

export async function POST(req: Request) {
  const payload = (await req.json()) as {
    messages?: UIMessage[];
    repoId?: string;
    conversationId?: string;
  };

  const { repoId, conversationId } = payload;
  const messages = Array.isArray(payload.messages)
    ? payload.messages
    : undefined;

  if (!repoId || !conversationId) {
    return Response.json(
      { error: "repoId and conversationId are required." },
      { status: 400 },
    );
  }

  if (!messages) {
    return Response.json(
      { error: "messages must be an array." },
      { status: 400 },
    );
  }

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

  await saveConversationMessages(repoId, metadata, conversationId, messages);

  const vm = freestyle.vms.ref({
    vmId: metadata.vm.vmId,
    spec: adorableVmSpec,
  });

  // Create base tools (original 13)
  const baseTools = createBaseTools(vm, {
    sourceRepoId: metadata.sourceRepoId,
    metadataRepoId: repoId,
  });

  // Load BuildForge context and tools
  let buildForgeTools = {};
  try {
    const projectMemory = await getProjectMemoryState(vm);
    const currentSpec = await readSpec(vm);

    const bfContext: BuildForgeContext = {
      vm,
      sourceRepoId: metadata.sourceRepoId,
      metadataRepoId: repoId,
      projectMemory,
      currentSpec,
      activePlan: null,
    };

    // Detect phase and get appropriate tools
    const phase = detectPhase(bfContext);
    buildForgeTools = getToolsForPhase(phase, vm, bfContext);
  } catch (e) {
    // If BuildForge tools fail to load, continue with base tools only
    console.error("BuildForge tools initialization failed:", e);
  }

  // Merge base tools with BuildForge tools
  const tools = { ...baseTools, ...buildForgeTools };

  // Build dynamic system prompt with project context
  const latestUserMessage = messages
    .filter((m) => m.role === "user")
    .pop()
    ?.parts?.find((p) => p.type === "text");
  const userText = latestUserMessage && "text" in latestUserMessage ? latestUserMessage.text : "";

  let systemPrompt: string;
  try {
    systemPrompt = await buildSystemPrompt(vm, userText);
  } catch {
    systemPrompt = SYSTEM_PROMPT;
  }

  // Read user-provided API key from cookie (if no global env key)
  const jar = await cookies();
  const userApiKey = jar.get("user-api-key")?.value;
  const userProvider = jar.get("user-api-provider")?.value;

  const hasGlobalKey = !!(
    process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  );

  // Check Claude Code auth as fallback
  const claudeToken = await getClaudeAccessToken();
  const hasClaudeCode = !!claudeToken;

  // If no global key and no user key and no Claude Code auth, reject
  if (!hasGlobalKey && !userApiKey && !hasClaudeCode) {
    return Response.json(
      {
        error:
          "No API key configured. Please sign in with Claude or add your API key in settings.",
      },
      { status: 401 },
    );
  }

  // Priority: global env key > user cookie key > Claude Code OAuth token
  let llmOptions: {
    apiKey?: string;
    providerOverride?: string;
  } = {};

  if (hasGlobalKey) {
    llmOptions = {};
  } else if (userApiKey) {
    llmOptions = { apiKey: userApiKey, providerOverride: userProvider };
  } else if (hasClaudeCode) {
    llmOptions = { providerOverride: "claude-code" };
  }

  const llm = await streamLlmResponse({
    system: systemPrompt,
    messages,
    tools,
    ...llmOptions,
  });

  return llm.result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages: messages,
    generateMessageId: () => crypto.randomUUID(),
    onFinish: async ({ messages: finalMessages }) => {
      const latestMetadata = await readRepoMetadata(repoId);
      if (!latestMetadata) return;
      await saveConversationMessages(
        repoId,
        latestMetadata,
        conversationId,
        finalMessages,
      );
    },
  });
}
