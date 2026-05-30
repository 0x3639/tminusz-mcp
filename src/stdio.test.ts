import { describe, it, expect, beforeAll } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { collectDocs } from "./index/build.js";
import { saveCorpus } from "./core/state.js";
import { CORPUS_ROOT, INDEX_PATH, PROJECT_ROOT } from "./core/paths.js";

describe("stdio server end-to-end", () => {
  beforeAll(async () => {
    // Ensure an index exists (markdown-only for test speed).
    const docs = await collectDocs(CORPUS_ROOT, false);
    saveCorpus(INDEX_PATH, docs);
  });

  it("lists tools and serves get_phase1_spec over stdio", async () => {
    const transport = new StdioClientTransport({
      command: "npx",
      args: ["-y", "tsx", "src/stdio.ts"],
      cwd: PROJECT_ROOT,
    });
    const client = new Client({ name: "test-client", version: "0.0.0" });
    await client.connect(transport);

    const toolList = await client.listTools();
    const names = toolList.tools.map((t) => t.name);
    expect(names).toContain("get_phase1_spec");
    expect(names).toContain("read_doc");

    const res = await client.callTool({ name: "get_phase1_spec", arguments: { n: 1 } });
    expect(JSON.stringify(res)).toContain("Hostile Review");

    await client.close();
  });
});
