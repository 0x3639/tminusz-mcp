import express from "express";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createServer } from "./server.js";
import { loadCorpus } from "./core/state.js";
import { INDEX_PATH } from "./core/paths.js";
import type { CorpusState } from "./core/types.js";

export function createHttpApp(state: CorpusState) {
  const app = express();
  app.use(express.json({ limit: "4mb" }));

  app.post("/mcp", async (req, res) => {
    // Stateless: a fresh server+transport per request, sharing one loaded corpus.
    const server = createServer(state);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal error" },
          id: null,
        });
      }
    }
  });

  return app;
}

const isMain = Boolean(process.argv[1]) && process.argv[1].endsWith("http.ts");
if (isMain) {
  const state = loadCorpus(INDEX_PATH);
  const app = createHttpApp(state);
  const port = Number(process.env.PORT ?? 3000);
  app.listen(port, () => console.error(`Zenon docs MCP (HTTP) listening on :${port}/mcp`));
}
