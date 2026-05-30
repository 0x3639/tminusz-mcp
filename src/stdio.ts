import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadCorpus } from "./core/state.js";
import { INDEX_PATH } from "./core/paths.js";

const state = loadCorpus(INDEX_PATH);
const server = createServer(state);
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Zenon docs MCP (stdio) ready.");
