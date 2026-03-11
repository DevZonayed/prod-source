import { tool } from "ai";
import type { Vm } from "freestyle-sandboxes";
import { freestyle } from "freestyle-sandboxes";
import { z } from "zod";
import { WORKDIR } from "../../vars";
import { getDomainForCommit } from "../../deployment-status";
import { addRepoDeployment, readRepoMetadata } from "../../repo-storage";
import { runVmCommand, shellQuote } from "./helpers";

type GitToolsOptions = {
  sourceRepoId?: string;
  metadataRepoId?: string;
};

/**
 * Creates the 6 git tools: git_diff, git_log, git_status, git_commit, git_checkout, git_stash
 */
export function createGitTools(vm: Vm, options?: GitToolsOptions) {
  const gitCmd = (cmd: string) =>
    runVmCommand(vm, `cd ${shellQuote(WORKDIR)} && git ${cmd}`);

  return {
    git_diff: tool({
      description: "Show file diffs. Shows staged and unstaged changes.",
      inputSchema: z.object({
        Path: z
          .string()
          .optional()
          .describe("Optional file path to scope the diff"),
      }),
      execute: async ({ Path }) => {
        const pathArg = Path ? ` -- ${shellQuote(Path)}` : "";
        const [staged, unstaged] = await Promise.all([
          gitCmd(`diff --cached${pathArg}`),
          gitCmd(`diff${pathArg}`),
        ]);
        return {
          staged: staged.stdout || "(no staged changes)",
          unstaged: unstaged.stdout || "(no unstaged changes)",
        };
      },
    }),

    git_log: tool({
      description: "Show commit history.",
      inputSchema: z.object({
        MaxEntries: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Maximum number of log entries"),
      }),
      execute: async ({ MaxEntries }) => {
        const result = await gitCmd(
          `log --oneline --no-decorate -${MaxEntries}`,
        );
        return { log: result.stdout || "(no commits yet)" };
      },
    }),

    git_status: tool({
      description: "Show working tree status.",
      inputSchema: z.object({}),
      execute: async () => {
        const result = await gitCmd("status --porcelain");
        const branchResult = await gitCmd("branch --show-current");
        return {
          branch: branchResult.stdout.trim() || "unknown",
          status: result.stdout || "(clean working tree)",
          clean: !result.stdout.trim(),
        };
      },
    }),

    git_commit: tool({
      description:
        "Stage all changes, create a commit, and push to remote. Automatically triggers deployment if configured.",
      inputSchema: z.object({
        Message: z.string().describe("Commit message"),
      }),
      execute: async ({ Message }) => {
        // Configure git user
        await gitCmd(`config user.name "Adorable"`);
        await gitCmd(`config user.email "adorable@freestyle.sh"`);

        // Stage and commit
        const commitResult = await gitCmd(
          `commit -am ${shellQuote(Message)}`,
        );

        if (!commitResult.ok) {
          return {
            ok: false,
            error: "Commit failed",
            stdout: commitResult.stdout,
            stderr: commitResult.stderr,
          };
        }

        // Pull --rebase and push
        await gitCmd("pull --rebase --no-edit 2>/dev/null || true");
        const pushResult = await gitCmd("push 2>&1");

        // Trigger async deployment if configured
        if (options?.sourceRepoId && options?.metadataRepoId) {
          (async () => {
            try {
              const headResult = await gitCmd(
                "rev-parse --short=7 HEAD",
              );
              const sha = headResult.stdout.trim();
              if (!sha) return;

              const domain = getDomainForCommit(sha);
              const metadata = await readRepoMetadata(
                options.metadataRepoId!,
              );
              if (!metadata) return;

              await addRepoDeployment(
                options.metadataRepoId!,
                metadata,
                {
                  commitSha: sha,
                  commitMessage: Message,
                  commitDate: new Date().toISOString(),
                  domain,
                  url: `https://${domain}`,
                  deploymentId: null,
                  state: "deploying",
                },
              );

              const deployment =
                await freestyle.serverless.deployments.create({
                  repo: options.sourceRepoId!,
                  domains: [domain],
                  build: true,
                });

              const deploymentId =
                deployment &&
                typeof deployment === "object" &&
                "id" in deployment
                  ? String(
                      (deployment as Record<string, unknown>).id ?? "",
                    ) || null
                  : null;

              if (deploymentId) {
                const latestMetadata = await readRepoMetadata(
                  options.metadataRepoId!,
                );
                if (latestMetadata) {
                  await addRepoDeployment(
                    options.metadataRepoId!,
                    latestMetadata,
                    {
                      commitSha: sha,
                      commitMessage: Message,
                      commitDate: new Date().toISOString(),
                      domain,
                      url: `https://${domain}`,
                      deploymentId,
                      state: "deploying",
                    },
                  );
                }
              }
            } catch (e) {
              console.error("Deployment trigger failed:", e);
            }
          })();
        }

        return {
          ok: true,
          stdout: commitResult.stdout,
          pushResult: pushResult.stdout,
          deploymentQueued: !!(
            options?.sourceRepoId && options?.metadataRepoId
          ),
        };
      },
    }),

    git_checkout: tool({
      description: "Switch branches or restore files.",
      inputSchema: z.object({
        Target: z
          .string()
          .describe("Branch name or file path to checkout"),
        CreateBranch: z
          .boolean()
          .default(false)
          .describe("Create a new branch with this name"),
      }),
      execute: async ({ Target, CreateBranch }) => {
        const flag = CreateBranch ? "-b " : "";
        const result = await gitCmd(
          `checkout ${flag}${shellQuote(Target)}`,
        );
        return {
          ok: result.ok,
          stdout: result.stdout || "",
          stderr: result.stderr || "",
        };
      },
    }),

    git_stash: tool({
      description: "Stash or restore uncommitted changes.",
      inputSchema: z.object({
        Action: z
          .enum(["push", "pop", "list", "drop"])
          .default("push")
          .describe("Stash action"),
        Message: z
          .string()
          .optional()
          .describe("Optional stash message (for push)"),
      }),
      execute: async ({ Action, Message }) => {
        let cmd = `stash ${Action}`;
        if (Action === "push" && Message) {
          cmd += ` -m ${shellQuote(Message)}`;
        }
        const result = await gitCmd(cmd);
        return {
          ok: result.ok,
          action: Action,
          stdout: result.stdout || "",
          stderr: result.stderr || "",
        };
      },
    }),
  };
}
