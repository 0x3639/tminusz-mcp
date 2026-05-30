import { describe, it, expect } from "vitest";
import type { AddressInfo } from "node:net";
import { createHttpApp } from "./http.js";
import { buildState } from "./core/state.js";
import type { IndexedDoc } from "./core/types.js";

const docs: IndexedDoc[] = [
  { path: "docs/notes/pillars.md", section: "notes", type: "md", title: "Pillars", body: "consensus" },
];

describe("HTTP transport", () => {
  it("responds 200 to an MCP initialize request", async () => {
    const app = createHttpApp(buildState(docs));
    const srv = app.listen(0);
    const { port } = srv.address() as AddressInfo;
    try {
      const res = await fetch(`http://127.0.0.1:${port}/mcp`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "initialize",
          params: {
            protocolVersion: "2024-11-05",
            capabilities: {},
            clientInfo: { name: "test", version: "0" },
          },
        }),
      });
      expect(res.status).toBe(200);
    } finally {
      srv.close();
    }
  });
});
