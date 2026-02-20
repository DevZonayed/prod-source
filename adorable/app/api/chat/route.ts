import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  tool,
  stepCountIs,
} from "ai";
import { freestyle, Vm, VmSpec } from "freestyle-sandboxes";
import { z } from "zod";
import { VmDevServer } from "@freestyle-sh/with-dev-server";
import { VmPtySession } from "@freestyle-sh/with-pty";
import { VmWebTerminal } from "@freestyle-sh/with-ttyd";

const TEMPLATE_REPO = "https://github.com/freestyle-sh/freestyle-next";
const WORKDIR = "/workspace";
const VM_PORT = 3000;
const MODEL = "gpt-5-mini";
const DEV_COMMAND_TERMINAL_PORT = 3010;

type AdorableMetadata = {
  vmId: string;
  repoId: string;
  url: string;
};

type MessageMetadata = {
  custom?: {
    adorable?: AdorableMetadata;
  };
};

const SYSTEM_PROMPT = `
You are Adorable, an AI app builder. There is a default Next.js app already set up in ${WORKDIR} and running inside a VM on port ${VM_PORT}.

Here are the files currently there:
${WORKDIR}/README.md
${WORKDIR}/app/favicon.ico
${WORKDIR}/app/globals.css
${WORKDIR}/app/layout.tsx
${WORKDIR}/app/page.tsx
${WORKDIR}/eslint.config.mjs
${WORKDIR}/next-env.d.ts
${WORKDIR}/next.config.ts
${WORKDIR}/package-lock.json
${WORKDIR}/package.json
${WORKDIR}/postcss.config.mjs
${WORKDIR}/public/file.svg
${WORKDIR}/public/globe.svg
${WORKDIR}/public/next.svg
${WORKDIR}/public/vercel.svg
${WORKDIR}/public/window.svg
${WORKDIR}/tsconfig.json

You can run bash commands to inspect files, install dependencies, and modify code. The dev server automatically reloads when files are changed. Always commit and push your changes when you finish a task.
`;

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

const createTools = (vm: Vm) => {
  const bashTool = tool({
    description:
      "Run a bash command inside the Adorable VM and return its output.",
    inputSchema: z.object({
      command: z.string().min(1).describe("The bash command to execute."),
    }),
    execute: async ({ command }) => {
      const result = vm.exec({
        command,
      });

      return result ?? { ok: true };
    },
  });

  return { bashTool };
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

  const tools = createTools(vm);

  const result = streamText({
    system: SYSTEM_PROMPT,
    model: openai.responses(MODEL),
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(100),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages: messages,
    messageMetadata: createMessageMetadata(resolvedMetadata),
  });
}
