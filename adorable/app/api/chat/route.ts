import { openai, OpenAIChatLanguageModelOptions } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  stepCountIs,
} from "ai";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { VmDevServer } from "@freestyle-sh/with-dev-server";
import { VmPtySession } from "@freestyle-sh/with-pty";
import { VmWebTerminal } from "@freestyle-sh/with-ttyd";
import { createTools as createVmTools } from "@/lib/create-tools";
import {
  VM_PORT,
  WORKDIR,
  DEV_COMMAND_TERMINAL_PORT,
  TEMPLATE_REPO,
  MODEL,
} from "@/lib/vars";
import { SYSTEM_PROMPT } from "@/lib/system-prompt";

type AdorableMetadata = {
  vmId: string;
  repoId: string;
  previewUrl: string;
  devCommandTerminalUrl: string;
};

type MessageMetadata = {
  custom?: {
    adorable?: AdorableMetadata;
  };
};

const devCommandPty = new VmPtySession({
  sessionId: "adorable-dev-command",
});

const spec = new VmSpec({
  with: {
    devCommandPty,
    devServer: new VmDevServer({
      workdir: WORKDIR,
      templateRepo: TEMPLATE_REPO,
      devCommandPty,
    }),
    devCommandTerminal: new VmWebTerminal({
      pty: devCommandPty,
      port: DEV_COMMAND_TERMINAL_PORT,
    }),
  },
});

const getAdorableMetadataFromMessage = (
  message: UIMessage,
): AdorableMetadata | null => {
  const metadata = message.metadata as MessageMetadata | undefined;
  return metadata?.custom?.adorable ?? null;
};

const getPersistedAdorableMetadata = (
  messages: UIMessage[],
): AdorableMetadata | null => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const metadata = getAdorableMetadataFromMessage(messages[i]);
    if (metadata) return metadata;
  }

  return null;
};

const createAdorableMetadata = async (): Promise<AdorableMetadata> => {
  const { repoId } = await freestyle.git.repos.create({
    import: {
      commitMessage: "Initial commit",
      url: TEMPLATE_REPO,
      type: "git",
    },
  });

  const domain = `${crypto.randomUUID()}-adorable.style.dev`;
  const devCommandTerminalDomain = `dev-command-${domain}`;
  console.log("Creating VM with domain:", domain);

  const { vm, vmId } = await freestyle.vms.create({
    snapshot: spec,
    recreate: true,
    workdir: WORKDIR,
    git: {
      repos: [
        {
          path: WORKDIR,
          repo: repoId,
        },
      ],
    },
    domains: [
      {
        domain,
        vmPort: VM_PORT,
      },
      {
        domain: devCommandTerminalDomain,
        vmPort: DEV_COMMAND_TERMINAL_PORT,
      },
    ],
  });

  return {
    vmId,
    repoId,
    previewUrl: `https://${domain}`,
    devCommandTerminalUrl: `https://${devCommandTerminalDomain}`,
  };
};

const createMessageMetadata = (
  metadata: AdorableMetadata | null,
): (({ part }: { part: { type: string } }) => MessageMetadata | undefined) => {
  return ({ part }) => {
    if (part.type !== "start" || !metadata) return undefined;

    return {
      custom: {
        adorable: metadata,
      },
    };
  };
};

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  const persistedMetadata = getPersistedAdorableMetadata(messages);
  const newMetadata =
    messages.length === 1 ? await createAdorableMetadata() : null;
  const resolvedMetadata = newMetadata ?? persistedMetadata;

  const vmId = resolvedMetadata?.vmId;
  if (!vmId) {
    throw new Error("No VM is available to run commands.");
  }

  let vm = freestyle.vms.ref({
    vmId,
    spec: spec,
  });

  const tools = createVmTools(vm);

  const result = streamText({
    system: SYSTEM_PROMPT,
    model: openai.responses(MODEL),
    messages: await convertToModelMessages(messages),
    tools,
    providerOptions: {
      openai: {
        reasoningEffort: "low",
      } satisfies OpenAIChatLanguageModelOptions,
    },
    stopWhen: stepCountIs(100),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages: messages,
    messageMetadata: createMessageMetadata(resolvedMetadata),
  });
}
