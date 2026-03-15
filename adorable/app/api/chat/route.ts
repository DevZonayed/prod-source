import { type UIMessage } from "ai";
import { cookies } from "next/headers";
import { getVmRef } from "@/lib/voxel-vm";
import { readRepoMetadata, saveConversationMessages } from "@/lib/repo-storage";
import { getProject } from "@/lib/local-storage";
import { getClaudeAccessToken } from "@/lib/claude-auth";

// ─── Claude Agent SDK provider (OAuth via CLI binary + VM-scoped MCP tools) ───
import { createClaudeSdkStreamResponse } from "@/lib/claude-sdk-provider";

// ─── CodeMine (new agentic engine) ───
import { createCodeMineTools, runAgenticLoop, buildCodeMinePrompt, CODEMINE_SYSTEM_PROMPT } from "@/lib/codemine";
import type { AgenticLoopState } from "@/lib/codemine";

// ─── BuildForge (legacy, kept for backward compat) ───
import { createTools as createBaseTools } from "@/lib/create-tools";
import { streamLlmResponse } from "@/lib/llm-provider";
import { buildSystemPrompt, SYSTEM_PROMPT } from "@/lib/system-prompt";
import { getBuildForgeTools, getProjectMemoryState, readSpec } from "@/lib/buildforge";
import type { BuildForgeContext } from "@/lib/buildforge";

const AGENT_MODE = (process.env["AGENT_MODE"] ?? "codemine").toLowerCase();

export async function POST(req: Request) {
  const payload = (await req.json()) as {
    messages?: UIMessage[];
    repoId?: string;
    conversationId?: string;
  };

  const { repoId, conversationId } = payload;
  const messages = Array.isArray(payload.messages) ? payload.messages : undefined;

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

  // ─── Load project ───
  const project = getProject(repoId);
  if (!project) {
    return Response.json(
      { error: "Project not found." },
      { status: 404 },
    );
  }

  const metadata = await readRepoMetadata(repoId);
  if (!metadata) {
    return Response.json(
      { error: "Repository metadata not found." },
      { status: 404 },
    );
  }

  await saveConversationMessages(repoId, metadata, conversationId, messages);

  // ─── Get local VM ───
  const vm = getVmRef(repoId, project.path);

  // ─── LLM Auth ───
  const jar = await cookies();
  const userApiKey = jar.get("user-api-key")?.value;
  const userProvider = jar.get("user-api-provider")?.value;
  const userModel = jar.get("user-model")?.value;

  const hasGlobalKey = !!(
    process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY
  );

  const envProvider = process.env["LLM_PROVIDER"]?.toLowerCase().trim();
  const envForcesClaudeCode = envProvider === "claude-code";

  const claudeToken = await getClaudeAccessToken();
  const hasClaudeCode = !!claudeToken;

  if (!hasGlobalKey && !userApiKey && !hasClaudeCode) {
    return Response.json(
      {
        error:
          "No API key configured. Please add your API key in settings.",
      },
      { status: 401 },
    );
  }

  let llmOptions: { apiKey?: string; providerOverride?: string; modelOverride?: string } = {};

  if (envForcesClaudeCode && hasClaudeCode) {
    llmOptions = { providerOverride: "claude-code", modelOverride: userModel };
  } else if (hasGlobalKey) {
    llmOptions = { modelOverride: userModel };
  } else if (userApiKey) {
    llmOptions = { apiKey: userApiKey, providerOverride: userProvider, modelOverride: userModel };
  } else if (hasClaudeCode) {
    llmOptions = { providerOverride: "claude-code", modelOverride: userModel };
  }

  console.log("[LLM Auth]", JSON.stringify({
    agentMode: AGENT_MODE,
    envProvider,
    hasGlobalKey,
    hasUserCookie: !!userApiKey,
    userProvider: userProvider ?? null,
    hasClaudeCode,
    chosenPath: llmOptions.providerOverride ?? (hasGlobalKey ? "global-env" : "unknown"),
  }, null, 2));

  // ─── Extract latest user message ───
  const latestUserMessage = messages
    .filter((m) => m.role === "user")
    .pop()
    ?.parts?.find((p) => p.type === "text");
  const userText =
    latestUserMessage && "text" in latestUserMessage
      ? latestUserMessage.text
      : "";

  // ═══════════════════════════════════════
  // Claude Agent SDK Mode (OAuth via CLI binary + custom VM-scoped MCP tools)
  // ═══════════════════════════════════════
  if (llmOptions.providerOverride === "claude-code" && !hasGlobalKey && !userApiKey) {
    console.log("[Chat] Using Claude Agent SDK (OAuth + VM-scoped MCP tools)");

    let systemPrompt: string;
    try {
      systemPrompt = AGENT_MODE === "codemine"
        ? await buildCodeMinePrompt(vm, userText)
        : await buildSystemPrompt(vm, userText);
    } catch {
      systemPrompt = AGENT_MODE === "codemine" ? CODEMINE_SYSTEM_PROMPT : SYSTEM_PROMPT;
    }

    return createClaudeSdkStreamResponse(vm, messages, {
      systemPrompt,
      model: llmOptions.modelOverride ?? "sonnet",
      maxTurns: 200,
      sourceRepoId: project.id,
      metadataRepoId: repoId,
      previewUrl: metadata.vm.previewUrl,
      repoId,
      conversationId,
      onFinish: async (assistantText: string) => {
        const latestMetadata = await readRepoMetadata(repoId);
        if (!latestMetadata) return;
        // Build a synthetic assistant message with the collected text
        const assistantMessage = {
          id: crypto.randomUUID(),
          role: "assistant" as const,
          parts: assistantText ? [{ type: "text" as const, text: assistantText }] : [],
        } as UIMessage;
        const finalMessages = [...messages, assistantMessage];
        await saveConversationMessages(
          repoId,
          latestMetadata,
          conversationId,
          finalMessages,
        );
      },
    });
  }

  // ═══════════════════════════════════════
  // CodeMine Agentic Engine (default — requires API key)
  // ═══════════════════════════════════════
  if (AGENT_MODE === "codemine") {
    const loopState: AgenticLoopState = {
      stepCount: 0,
      taskState: null,
      recentFiles: [],
      backgroundProcesses: new Map(),
      conversationId,
      pauseForUser: false,
      startedAt: Date.now(),
    };

    const tools = createCodeMineTools(vm, loopState, {
      sourceRepoId: project.id,
      metadataRepoId: repoId,
      previewUrl: metadata.vm.previewUrl,
    });

    let systemPrompt: string;
    try {
      systemPrompt = await buildCodeMinePrompt(vm, userText);
    } catch {
      systemPrompt = CODEMINE_SYSTEM_PROMPT;
    }

    const result = await runAgenticLoop({
      system: systemPrompt,
      messages,
      tools,
      vm,
      conversationId,
      previewUrl: metadata.vm.previewUrl,
      ...llmOptions,
    });

    return result.toUIMessageStreamResponse({
      sendReasoning: true,
      originalMessages: messages,
      generateMessageId: () => crypto.randomUUID(),
      messageMetadata: ({ part }) => {
        if (part.type === "finish") {
          return {
            steps: [{ usage: { inputTokens: part.totalUsage.inputTokens ?? 0, outputTokens: part.totalUsage.outputTokens ?? 0 } }],
          };
        }
        return undefined;
      },
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

  // ═══════════════════════════════════════
  // BuildForge Legacy Mode (AGENT_MODE=buildforge)
  // ═══════════════════════════════════════
  const baseTools = createBaseTools(vm, {
    sourceRepoId: project.id,
    metadataRepoId: repoId,
  });

  let buildForgeTools = {};
  try {
    const projectMemory = await getProjectMemoryState(vm);
    const currentSpec = await readSpec(vm);

    const bfContext: BuildForgeContext = {
      vm,
      sourceRepoId: project.id,
      metadataRepoId: repoId,
      projectMemory,
      currentSpec,
      activePlan: null,
    };

    buildForgeTools = getBuildForgeTools(vm, bfContext);
  } catch (e) {
    console.error("BuildForge tools initialization failed:", e);
  }

  const tools = { ...baseTools, ...buildForgeTools };

  let systemPromptLegacy: string;
  try {
    systemPromptLegacy = await buildSystemPrompt(vm, userText);
  } catch {
    systemPromptLegacy = SYSTEM_PROMPT;
  }

  const llm = await streamLlmResponse({
    system: systemPromptLegacy,
    messages,
    tools,
    ...llmOptions,
  });

  return llm.result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages: messages,
    generateMessageId: () => crypto.randomUUID(),
    messageMetadata: ({ part }) => {
      if (part.type === "finish") {
        return {
          steps: [{ usage: { inputTokens: part.totalUsage.inputTokens ?? 0, outputTokens: part.totalUsage.outputTokens ?? 0 } }],
        };
      }
      return undefined;
    },
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
