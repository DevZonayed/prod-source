import { openai } from "@ai-sdk/openai";
import {
  streamText,
  convertToModelMessages,
  type UIMessage,
  tool,
  stepCountIs,
} from "ai";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { z } from "zod";
import { VmDevServer } from "@freestyle-sh/with-dev-server";

const TEMPLATE_REPO = "https://github.com/freestyle-sh/freestyle-next";

const WORKDIR = "/workspace";

const spec = new VmSpec({
  with: {
    devServer: new VmDevServer({
      workdir: WORKDIR,
      templateRepo: TEMPLATE_REPO,
    }),
  },
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  type AdorableMetadata = {
    vmId: string;
    repoId: string;
    url: string;
  };

  const getAdorableMetadataFromMessage = (
    message: UIMessage,
  ): AdorableMetadata | null => {
    const metadata = message.metadata as
      | { custom?: { adorable?: AdorableMetadata } }
      | undefined;
    return metadata?.custom?.adorable ?? null;
  };

  const getPersistedAdorableMetadata = (
    inputMessages: UIMessage[],
  ): AdorableMetadata | null => {
    if (inputMessages.length === 0) return null;

    for (let i = inputMessages.length - 1; i >= 0; i -= 1) {
      const metadata = getAdorableMetadataFromMessage(inputMessages[i]);
      if (metadata) return metadata;
    }

    return null;
  };

  let adorableMetadata: AdorableMetadata | null = null;
  const persistedAdorableMetadata = getPersistedAdorableMetadata(messages);

  if (messages.length === 1) {
    const { repoId } = await freestyle.git.repos.create({
      import: {
        commitMessage: "Initial commit",
        url: "https://www.github.com/freestyle-sh/freestyle-next",
        type: "git",
      },
    });

    const domain = crypto.randomUUID() + "-adorable.style.dev";

    console.log("Creating VM with domain:", domain);

    const { vm, vmId } = await freestyle.vms.create({
      snapshot: spec,
      with: {
        devServer: new VmDevServer({
          repo: repoId,
          workdir: WORKDIR,
        }),
      },
      domains: [
        {
          domain: domain,
          vmPort: 3000,
        },
      ],
    });

    adorableMetadata = {
      vmId: vmId,
      repoId,
      url: "https://" + domain,
    };
  }

  const resolvedAdorableMetadata =
    adorableMetadata ?? persistedAdorableMetadata;

  const bashTool = tool({
    description:
      "Run a bash command inside the Adorable VM and return its output.",
    inputSchema: z.object({
      command: z.string().min(1).describe("The bash command to execute."),
    }),
    execute: async ({ command }) => {
      const vmId = resolvedAdorableMetadata?.vmId;
      if (!vmId) {
        throw new Error("No VM is available to run commands.");
      }

      const result = await freestyle.vms.ref({ vmId }).exec({
        command,
      });

      return result ?? { ok: true };
    },
  });

  const result = streamText({
    system: `
You are Adorable, an AI app builder. There is a default Next.js app already set up in in the ${WORKDIR} and running inside a VM running on port 3000.

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

You can run bash commands to inspect the files, install dependencies, and modify the code. The dev server automatically reloads when files are changed. If you need to restart the dev server, you can run systemctl restart adorable-run-dev.service. You can view the logs via journalctl -u adorable-run-dev.service -f. Be careful when modifying files to not break the dev server, but if it does break, you can check the logs to debug and fix it.
    `,
    model: openai.responses("gpt-5-mini"),
    messages: await convertToModelMessages(messages),
    // providerOptions: {
    //   openai: {
    //     reasoningEffort: "low",
    //     reasoningSummary: "auto",
    //   },
    // },
    tools: { bash: bashTool },
    stopWhen: stepCountIs(100),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages: messages,
    messageMetadata: ({ part }) => {
      if (part.type !== "start") return undefined;

      if (resolvedAdorableMetadata) {
        return {
          custom: {
            adorable: resolvedAdorableMetadata,
          },
        };
      }

      return undefined;
    },
  });
}
