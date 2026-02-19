import { openai } from "@ai-sdk/openai";
import { streamText, convertToModelMessages, type UIMessage } from "ai";
import { MCPClient } from "@mastra/mcp";
import { freestyle, VmSpec } from "freestyle-sandboxes";

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

  type AdorableMetadata = {
    vmId: string;
    repoId: string;
    url: string;
    mcpUrl: string;
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
    const firstMessage = inputMessages[0];
    if (!firstMessage) return null;

    if (inputMessages.length > 1) {
      return getAdorableMetadataFromMessage(firstMessage);
    }

    return getAdorableMetadataFromMessage(firstMessage);
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

  let mcpClient: MCPClient | null = null;
  let mcpTools: Record<string, unknown> | undefined;

  if (resolvedAdorableMetadata?.mcpUrl) {
    try {
      mcpClient = new MCPClient({
        id: crypto.randomUUID(),
        servers: {
          dev_server: {
            url: new URL(resolvedAdorableMetadata.mcpUrl),
          },
        },
      });

      const listTools = (
        mcpClient as unknown as {
          listTools?: () => Promise<Record<string, unknown>>;
        }
      ).listTools;

      if (listTools) {
        mcpTools = await listTools();
      }
    } catch (error) {
      console.error("Failed to load MCP tools", error);
    }
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
    ...(mcpTools ? { tools: mcpTools as never } : {}),
  });

  return result.toUIMessageStreamResponse({
    sendReasoning: true,
    originalMessages: messages,
    messageMetadata: ({ part }) => {
      if (part.type === "start" && adorableMetadata) {
        return {
          custom: {
            adorable: adorableMetadata,
          },
        };
      }

      return undefined;
    },
    onFinish: async () => {
      await mcpClient?.disconnect();
    },
  });
}
