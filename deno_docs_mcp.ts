/**
 * Deno Docs MCP server.
 *
 * Exposes the official Deno documentation (sourced from https://docs.deno.com/llms.txt)
 * as MCP tools so an MCP client (Claude Desktop, Claude Code, etc.) can browse and read it.
 *
 * Tools:
 *   - list_docs   : return the full llms.txt index of doc sections and links
 *   - search_docs : filter the index for entries matching a keyword
 *   - get_doc     : fetch a specific docs.deno.com page and return its content
 *
 * Run:  deno task mcp
 *
 * NOTE: this is a stdio MCP server — stdout is the protocol channel.
 * Never write logs to stdout; use console.error (stderr) instead.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const LLMS_TXT_URL = "https://docs.deno.com/llms.txt";
const DOCS_HOST = "docs.deno.com";

/** Cache the llms.txt index for 15 minutes to avoid refetching on every call. */
let cache: { text: string; at: number } | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000;

async function fetchIndex(): Promise<string> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
    return cache.text;
  }
  const res = await fetch(LLMS_TXT_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${LLMS_TXT_URL}: ${res.status} ${res.statusText}`);
  }
  const text = await res.text();
  cache = { text, at: Date.now() };
  return text;
}

const server = new McpServer({
  name: "deno-docs",
  version: "0.1.0",
});

server.registerTool(
  "list_docs",
  {
    title: "List Deno docs",
    description:
      "Fetch the Deno documentation index (llms.txt) and return its full contents: " +
      "all sections and their documentation links with descriptions.",
    inputSchema: {},
  },
  async () => {
    const text = await fetchIndex();
    return { content: [{ type: "text", text }] };
  },
);

server.registerTool(
  "search_docs",
  {
    title: "Search Deno docs",
    description:
      "Search the Deno documentation index for entries matching a keyword or topic " +
      "(e.g. 'permissions', 'http server', 'kv'). Returns the matching link lines, " +
      "each with the section it belongs to.",
    inputSchema: {
      query: z.string().min(1).describe("Keyword or topic to search for, case-insensitive."),
    },
  },
  async ({ query }: { query: string }) => {
    const text = await fetchIndex();
    const needle = query.toLowerCase();

    const lines = text.split("\n");
    let currentSection = "";
    const matches: string[] = [];

    for (const line of lines) {
      const heading = line.match(/^#{1,6}\s+(.*)$/);
      if (heading) {
        currentSection = heading[1].trim();
        continue;
      }
      // Match list-item links: "- [title](url): description"
      const isLink = /^\s*[-*]\s*\[/.test(line);
      if (isLink && line.toLowerCase().includes(needle)) {
        matches.push(currentSection ? `[${currentSection}] ${line.trim()}` : line.trim());
      }
    }

    const body = matches.length
      ? matches.join("\n")
      : `No entries in the Deno docs index matched "${query}".`;
    return { content: [{ type: "text", text: body }] };
  },
);

server.registerTool(
  "get_doc",
  {
    title: "Get a Deno doc page",
    description:
      "Fetch a specific Deno documentation page by URL (must be on docs.deno.com, " +
      "e.g. a link returned by list_docs/search_docs) and return its content.",
    inputSchema: {
      url: z.string().url().describe("Full https://docs.deno.com/... URL of the page to fetch."),
    },
  },
  async ({ url }: { url: string }) => {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      return {
        isError: true,
        content: [{ type: "text", text: `Invalid URL: ${url}` }],
      };
    }
    if (parsed.hostname !== DOCS_HOST) {
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Refused: only ${DOCS_HOST} URLs are allowed (got ${parsed.hostname}).`,
        }],
      };
    }

    const res = await fetch(parsed.href);
    if (!res.ok) {
      return {
        isError: true,
        content: [{ type: "text", text: `Failed to fetch ${parsed.href}: ${res.status} ${res.statusText}` }],
      };
    }
    const text = await res.text();
    return { content: [{ type: "text", text }] };
  },
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("deno-docs MCP server running on stdio");
}

if (import.meta.main) {
  main().catch((err) => {
    console.error("Fatal error starting deno-docs MCP server:", err);
    Deno.exit(1);
  });
}
