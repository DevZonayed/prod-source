import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage, tool } from "ai";
import { freestyle, VmSpec } from "freestyle-sandboxes";
import { z } from "zod";

const snapshot = new VmSpec({
  git: {
    repos: [
      {
        path: "/workspace",
        repo: "https://www.github.com/freestyle-sh/freestyle-next",
      },
    ],
    config: {
      user: {
        name: "Adorable",
        email: "adorable@freestyle.sh",
      },
    },
  },
  systemd: {
    services: [
      {
        name: "adorable-install",
        exec: ["npm install"],
        mode: "oneshot",
        workdir: "/workspace",
      },
      {
        name: "adorable-run-dev",
        exec: ["npm run dev"],
        mode: "service",
        after: ["adorable-install.service"],
        requires: ["adorable-install.service"],
        workdir: "/workspace",
      },
    ],
  },
});

export async function POST(req: Request) {
  const { messages }: { messages: UIMessage[] } = await req.json();

  if (messages.length === 1) {
    const { repoId } = await freestyle.git.repos.create({
      import: {
        commitMessage: "Initial commit",
        url: "https://www.github.com/freestyle-sh/freestyle-next",
        type: "git",
      },
    });

    const domain = crypto.randomUUID() + "-adorable.style.dev";

    const { vm, vmId } = await freestyle.vms.create({
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

    messages[0].metadata.adorable = {
      vmId: vmId,
      repoId: repoId,
      domain: "https://" + domain,
    };
  }

  const result = streamText({
    model: openai.responses("gpt-5-nano"),
    messages: await convertToModelMessages(messages),
    providerOptions: {
      openai: {
        reasoningEffort: "low",
        reasoningSummary: "auto",
      },
    },
    tools: {
      // createApp: tool({
      //   description: "Creates a new Adorable app.",
      //   inputSchema: z.object({}),
      //   execute: async () => {
      //     return {
      //       vmId: vmId,
      //       url: "https://" + domain,
      //     };
      //   },
      // }),
    },
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
