import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CorpusState } from "./core/types.js";
import * as tools from "./core/tools.js";

function text(t: string) {
  return {
    content: [{ type: "text" as const, text: t }],
    isError: t.startsWith("ERROR:"),
  };
}

export function createServer(state: CorpusState): McpServer {
  const server = new McpServer({ name: "zenon-docs", version: "0.1.0" });
  const sectionEnum = z.enum(tools.SECTIONS);

  server.registerTool(
    "list_docs",
    {
      description: "List corpus documents, optionally filtered by section.",
      inputSchema: { section: sectionEnum.optional() },
    },
    async ({ section }) => text(tools.listDocs(state, section)),
  );

  server.registerTool(
    "search_docs",
    {
      description: "Keyword/fuzzy search across the corpus; returns ranked hits with snippets.",
      inputSchema: {
        query: z.string(),
        section: sectionEnum.optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    async ({ query, section, limit }) => text(tools.searchDocs(state, query, section, limit)),
  );

  server.registerTool(
    "read_doc",
    {
      description: "Return the full text of a document by path. Large docs are paged via `part`.",
      inputSchema: { path: z.string(), part: z.number().int().positive().optional() },
    },
    async ({ path, part }) => text(tools.readDoc(state, path, part)),
  );

  server.registerTool(
    "get_phase1_spec",
    {
      description:
        'Return a Phase 1 spec with its hostile review and reading-order neighbors. Pass a number (1–11) or a name, e.g. "Dynamic Plasma".',
      inputSchema: { n: z.union([z.number().int().positive(), z.string().min(1)]) },
    },
    async ({ n }) => text(tools.getPhase1Spec(state, n)),
  );

  server.registerTool(
    "get_reading_guide",
    {
      description: "Return prescribed reading sequences for the corpus and Phase 1.",
      inputSchema: {},
    },
    async () => text(tools.getReadingGuide()),
  );

  // Expose each Phase 1 spec as a pinnable resource.
  const phase1Specs = state.docs.filter(tools.isPhase1Spec);
  for (const d of phase1Specs) {
    const slug = (d.path.split("/").pop() ?? d.path)
      .replace(/\.md$/i, "")
      .replace(/\s+spec$/i, "")
      .replace(/\s+/g, "-")
      .toLowerCase();
    server.registerResource(
      slug,
      `zenon://phase1/${slug}`,
      { title: d.title, mimeType: "text/markdown" },
      async (uri) => ({ contents: [{ uri: uri.href, text: tools.readDoc(state, d.path) }] }),
    );
  }

  return server;
}
