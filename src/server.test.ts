import { describe, it, expect } from "vitest";
import { createServer } from "./server.js";
import { buildState } from "./core/state.js";
import type { IndexedDoc } from "./core/types.js";

const docs: IndexedDoc[] = [
  { path: "docs/specs/phase 1/01-libp2p host spec.md", section: "phase1", type: "md", title: "libp2p Host", body: "transports and connection gating" },
  { path: "docs/notes/pillars.md", section: "notes", type: "md", title: "Pillars", body: "consensus" },
];

describe("createServer", () => {
  it("returns an McpServer without throwing", () => {
    const server = createServer(buildState(docs));
    expect(server).toBeDefined();
  });
});
