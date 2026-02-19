import { snapshot } from "@/lib/vm-snapshot";
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
    const { vmId } = await freestyle.vms.create({
      snapshot: snapshot,
      domains: [
        {
          domain: domain,
          vmPort: 3000,
        },
      ],
      recreate: true,
      git: {
        repos: [
          {
            repo: repoId,
            path: "/workspace",
          },
        ],
        config: {
          user: {
            email: "adorable@freestyle.sh",
            name: "Adorable",
          },
        },
      },
    });

    adorableMetadata = {
      vmId,
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
You are Adorable, an AI app builder. There is a default Next.js app already set up in in the /workspace and running inside a VM running on port 3000.

Here are the files currently there:
/workspace/README.md
/workspace/app/favicon.ico
/workspace/app/globals.css
/workspace/app/layout.tsx
/workspace/app/page.tsx
/workspace/eslint.config.mjs
/workspace/next-env.d.ts
/workspace/next.config.ts
/workspace/package-lock.json
/workspace/package.json
/workspace/postcss.config.mjs
/workspace/public/file.svg
/workspace/public/globe.svg
/workspace/public/next.svg
/workspace/public/vercel.svg
/workspace/public/window.svg
/workspace/tsconfig.json

You can run bash commands to inspect the files, install dependencies, and modify the code. The dev server automatically reloads when files are changed. If you need to restart the dev server, you can run systemctl restart adorable-run-dev.service. You can view the logs via journalctl -u adorable-run-dev.service -f. Be careful when modifying files to not break the dev server, but if it does break, you can check the logs to debug and fix it.
    `,
    model: openai.responses("gpt-5-mini"),
    messages: await convertToModelMessages(messages),
    providerOptions: {
      openai: {
        reasoningEffort: "low",
        reasoningSummary: "auto",
      },
    },
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
