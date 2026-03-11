import { tool } from "ai";
import type { Vm } from "freestyle-sandboxes";
import { z } from "zod";
import { resolveAbsPath, ensureDir, runVmCommand, shellQuote } from "./helpers";
import { WORKDIR } from "../../vars";

/**
 * Creates the generate_image tool using OpenAI DALL-E API.
 */
export function createMediaTools(vm: Vm) {
  return {
    generate_image: tool({
      description:
        "Generate an image using AI for use in web applications. Saves the result to the specified path in the workspace. Requires OPENAI_API_KEY.",
      inputSchema: z.object({
        Prompt: z.string().describe("Image generation prompt describing what to create"),
        OutputPath: z
          .string()
          .describe("Where to save the image (absolute path within workspace)"),
        Width: z
          .number()
          .int()
          .min(256)
          .max(2048)
          .default(1024)
          .describe("Image width in pixels"),
        Height: z
          .number()
          .int()
          .min(256)
          .max(2048)
          .default(1024)
          .describe("Image height in pixels"),
      }),
      execute: async ({ Prompt, OutputPath, Width, Height }) => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          return {
            error:
              "Image generation requires OPENAI_API_KEY environment variable.",
          };
        }

        const absPath = resolveAbsPath(OutputPath);
        if (!absPath)
          return {
            error: `Invalid path: ${OutputPath}. Must be within ${WORKDIR}.`,
          };

        // Determine size (DALL-E supports specific sizes)
        const size =
          Width <= 512 && Height <= 512
            ? "256x256"
            : Width <= 1024 && Height <= 1024
              ? "1024x1024"
              : "1792x1024";

        try {
          const res = await fetch(
            "https://api.openai.com/v1/images/generations",
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "dall-e-3",
                prompt: Prompt,
                n: 1,
                size,
                response_format: "url",
              }),
            },
          );

          if (!res.ok) {
            const errorBody = await res.text();
            return {
              error: `DALL-E API returned ${res.status}: ${errorBody.slice(0, 200)}`,
            };
          }

          const data = (await res.json()) as {
            data?: Array<{ url?: string; revised_prompt?: string }>;
          };
          const imageUrl = data.data?.[0]?.url;
          if (!imageUrl)
            return { error: "No image URL returned from DALL-E API" };

          // Download the image and save it to the VM
          const parentDir = absPath.substring(0, absPath.lastIndexOf("/"));
          if (parentDir) await ensureDir(vm, parentDir);

          const downloadCmd = `curl -sS -L -o ${shellQuote(absPath)} ${shellQuote(imageUrl)}`;
          const dlResult = await runVmCommand(vm, downloadCmd);

          if (!dlResult.ok) {
            return {
              error: `Failed to download image: ${dlResult.stderr}`,
            };
          }

          return {
            ok: true,
            path: absPath,
            prompt: Prompt,
            revisedPrompt: data.data?.[0]?.revised_prompt ?? Prompt,
            size,
          };
        } catch (err) {
          return {
            error: `Image generation failed: ${err instanceof Error ? err.message : String(err)}`,
          };
        }
      },
    }),
  };
}
