import { tool } from "ai";
import { z } from "zod";
import { MAX_WEB_FETCH_CHARS } from "../constants";

/**
 * Strip HTML tags and return plain text.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Creates the 2 web tools: web_search, web_fetch
 */
export function createWebTools() {
  return {
    web_search: tool({
      description:
        "Search the internet for information. Requires SEARCH_API_KEY environment variable (Brave or SerpAPI).",
      inputSchema: z.object({
        Query: z.string().describe("Search query"),
        MaxResults: z
          .number()
          .int()
          .min(1)
          .max(10)
          .default(5)
          .describe("Max results to return"),
      }),
      execute: async ({ Query, MaxResults }) => {
        const apiKey = process.env.SEARCH_API_KEY;
        const searchProvider =
          process.env.SEARCH_PROVIDER?.toLowerCase() ?? "brave";

        if (!apiKey) {
          return {
            error:
              "Web search is not configured. Set SEARCH_API_KEY and optionally SEARCH_PROVIDER (brave|serpapi) environment variables.",
            query: Query,
          };
        }

        try {
          if (searchProvider === "serpapi") {
            const url = `https://serpapi.com/search.json?q=${encodeURIComponent(Query)}&num=${MaxResults}&api_key=${apiKey}`;
            const res = await fetch(url);
            if (!res.ok)
              return {
                error: `Search API returned ${res.status}`,
                query: Query,
              };
            const data = (await res.json()) as {
              organic_results?: Array<{
                title?: string;
                link?: string;
                snippet?: string;
              }>;
            };
            const results = (data.organic_results ?? [])
              .slice(0, MaxResults)
              .map((r) => ({
                title: r.title ?? "",
                url: r.link ?? "",
                snippet: r.snippet ?? "",
              }));
            return { query: Query, results };
          }

          // Default: Brave Search API
          const url = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(Query)}&count=${MaxResults}`;
          const res = await fetch(url, {
            headers: {
              Accept: "application/json",
              "Accept-Encoding": "gzip",
              "X-Subscription-Token": apiKey,
            },
          });
          if (!res.ok)
            return {
              error: `Search API returned ${res.status}`,
              query: Query,
            };
          const data = (await res.json()) as {
            web?: {
              results?: Array<{
                title?: string;
                url?: string;
                description?: string;
              }>;
            };
          };
          const results = (data.web?.results ?? [])
            .slice(0, MaxResults)
            .map((r) => ({
              title: r.title ?? "",
              url: r.url ?? "",
              snippet: r.description ?? "",
            }));
          return { query: Query, results };
        } catch (err) {
          return {
            error: `Search failed: ${err instanceof Error ? err.message : String(err)}`,
            query: Query,
          };
        }
      },
    }),

    web_fetch: tool({
      description:
        "Fetch the contents of a URL. HTML is stripped to plain text. Useful for reading documentation, APIs, etc.",
      inputSchema: z.object({
        Url: z.string().url().describe("URL to fetch"),
        MaxChars: z
          .number()
          .int()
          .min(100)
          .max(50_000)
          .default(MAX_WEB_FETCH_CHARS)
          .describe("Max characters to return"),
      }),
      execute: async ({ Url, MaxChars }) => {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 15_000);

          const res = await fetch(Url, {
            signal: controller.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (compatible; CodeMine/1.0; +https://adorable.dev)",
            },
          });
          clearTimeout(timeout);

          if (!res.ok) {
            return {
              error: `HTTP ${res.status} ${res.statusText}`,
              url: Url,
            };
          }

          const contentType = res.headers.get("content-type") ?? "";
          const rawBody = await res.text();
          const isHtml = contentType.includes("html");
          const text = isHtml ? stripHtml(rawBody) : rawBody;
          const truncated = text.length > MaxChars;

          return {
            url: Url,
            contentType,
            content: text.slice(0, MaxChars),
            truncated,
            totalChars: text.length,
          };
        } catch (err) {
          return {
            error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
            url: Url,
          };
        }
      },
    }),
  };
}
