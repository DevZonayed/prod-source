import {
  streamText,
  stepCountIs,
  type UIMessage,
  type ToolSet,
  convertToModelMessages,
} from "ai";
import type { Vm } from "@/lib/local-vm";
import { LoopDetector } from "./loop-detector";
import { buildInitialEphemeral, buildStepEphemeral } from "./ephemeral";
import type {
  AgenticLoopConfig,
  AgenticLoopState,
  SandboxState,
} from "./types";
import { DEFAULT_LOOP_CONFIG } from "./constants";
import { getDevServerLogs } from "./tools/helpers";
import { getModelForProvider } from "../llm-provider";

export type AgenticLoopParams = {
  system: string;
  messages: UIMessage[];
  tools: ToolSet;
  vm: Vm;
  config?: Partial<AgenticLoopConfig>;
  conversationId: string;
  previewUrl: string;
  apiKey?: string;
  providerOverride?: string;
  modelOverride?: string;
};

/**
 * Captures the sandbox state for ephemeral message injection.
 */
async function captureSandboxState(
  vm: Vm,
  previewUrl: string,
): Promise<SandboxState> {
  const { errors } = await getDevServerLogs(vm);
  return {
    previewUrl,
    devServerRunning: true,
    devServerErrors: errors,
  };
}

/**
 * The CodeMine Agentic Loop.
 *
 * Uses streamText with maxSteps and onStepFinish for loop detection.
 * Injects ephemeral context into the initial messages.
 * Aborts via AbortController when loop detector triggers a force-stop.
 *
 * Returns the streamText result directly (compatible with toUIMessageStreamResponse).
 */
export async function runAgenticLoop(
  params: AgenticLoopParams,
): Promise<ReturnType<typeof streamText>> {
  const config: AgenticLoopConfig = {
    ...DEFAULT_LOOP_CONFIG,
    ...params.config,
  };

  const loopDetector = new LoopDetector(config);
  const state: AgenticLoopState = {
    stepCount: 0,
    taskState: null,
    recentFiles: [],
    backgroundProcesses: new Map(),
    conversationId: params.conversationId,
    pauseForUser: false,
    startedAt: Date.now(),
  };

  // Get the LLM model
  const model = await getModelForProvider(
    params.providerOverride,
    params.apiKey,
    params.modelOverride,
  );

  // Convert initial messages
  const modelMessages = await convertToModelMessages(params.messages);

  // AbortController for loop detector force-stops
  const abortController = new AbortController();
  let currentStep = 0;

  const result = streamText({
    system: params.system,
    model,
    messages: modelMessages,
    tools: params.tools,
    stopWhen: stepCountIs(config.hardLimit),
    abortSignal: abortController.signal,
    // Per-step ephemeral injection: rebuilds the system prompt with fresh context each step
    prepareStep: async ({ stepNumber }) => {
      const sandboxState = await captureSandboxState(params.vm, params.previewUrl);
      const ctx = {
        stepId: stepNumber,
        sandboxState,
        diagnostics: sandboxState.devServerErrors,
        kiSummaries: [],
        warnings: loopDetector.getWarnings(),
      };
      const ephemeral = stepNumber === 0
        ? buildInitialEphemeral(ctx)
        : buildStepEphemeral(ctx);
      return { system: params.system + "\n\n" + ephemeral };
    },
    onStepFinish: async (step) => {
      currentStep++;
      state.stepCount = currentStep;

      // Process tool calls through loop detector
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (const tc of step.toolCalls) {
          const tcAny = tc as unknown as Record<string, unknown>;
          const toolName = (tcAny.toolName ?? tcAny.name ?? "") as string;
          const args = (tcAny.args ?? tcAny.input ?? {}) as Record<string, unknown>;

          // Check corresponding result for error
          const results = (step.toolResults ?? []) as unknown as Array<Record<string, unknown>>;
          const toolResult = results.find(
            (tr) => tr.toolCallId === tcAny.toolCallId,
          );
          const resultObj = toolResult?.result;
          const isError =
            resultObj &&
            typeof resultObj === "object" &&
            resultObj !== null &&
            "error" in (resultObj as Record<string, unknown>);

          const action = loopDetector.onToolCall(toolName, args, !!isError);

          if (loopDetector.shouldForceStop(action)) {
            console.warn(
              `[CodeMine] Loop detector triggered ${action} at step ${currentStep}`,
            );
            abortController.abort();
            return;
          }
        }
      }

      // Check text output similarity
      if (step.text) {
        const textAction = loopDetector.onLlmOutput(step.text);
        if (loopDetector.shouldForceStop(textAction)) {
          console.warn(
            `[CodeMine] Output similarity detection triggered at step ${currentStep}`,
          );
          abortController.abort();
          return;
        }
      }

      // Check if notify_user requested a pause (BlockedOnUser)
      if (state.pauseForUser) {
        console.log(
          `[CodeMine] Pausing for user at step ${currentStep} (BlockedOnUser)`,
        );
        abortController.abort();
        return;
      }

      // Check total task timeout
      if (Date.now() - state.startedAt > config.totalTaskTimeout) {
        console.warn(
          `[CodeMine] Total task timeout reached at step ${currentStep}`,
        );
        abortController.abort();
        return;
      }

      // Log progress periodically
      if (currentStep % 10 === 0) {
        console.log(
          `[CodeMine] Step ${currentStep}/${config.hardLimit} | Warnings: ${loopDetector.getWarnings().length}`,
        );
      }
    },
  });

  return result;
}
