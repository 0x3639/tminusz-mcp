# tminusz-mcp

MCP server exposing the `zenon-developer-commons` documentation corpus as searchable, full-document context for AI agents implementing Zenon Phase 1.

## Setup

```bash
git submodule update --init        # populate the corpus
npm install
npm run build-index                # extract PDFs + index markdown → data/index.json
```

Rebuild the index after `git submodule update`.

## Run

- stdio (local agents): `npm run start:stdio`
- HTTP (remote agents): `npm run start:http` (listens on `:3000/mcp`, override with `PORT`)

## Run with Docker

The image builds the search index at build time, so the container is self-contained
(no submodule checkout or network needed at runtime). It runs the **HTTP** transport.

```bash
git submodule update --init        # corpus must be present in the build context
docker compose up -d --build       # serves http://127.0.0.1:3000/mcp
```

If port 3000 is taken, pick another host port — no file edit needed:

```bash
HOST_PORT=8765 docker compose up -d --build   # serves http://127.0.0.1:8765/mcp
```

`docker compose ps` shows health; `docker compose logs -f` tails output; `docker compose down` stops it.

> The `/mcp` endpoint is **unauthenticated** (see [Security](#security)). The compose file binds
> to `127.0.0.1` so it is local-only by default.

## Connecting Claude

MCP has no auto-discovery — you point the client at this server explicitly.

### Claude Code (stdio, local)

A project-scoped `.mcp.json` is already included, so running `claude` from this repo directory
picks up the `zenon-docs` server automatically. To register it yourself (e.g. user scope so it
works from any directory), use an **absolute path**:

```bash
claude mcp add zenon-docs -s user -- npx tsx /ABSOLUTE/PATH/TO/tminusz-mcp/src/stdio.ts
```

Verify with `claude mcp list` or `/mcp` inside Claude Code.

### Claude Code (HTTP / Docker)

With the container running, register the HTTP endpoint:

```bash
claude mcp add --transport http zenon-docs http://127.0.0.1:3000/mcp
```

### Claude Desktop (stdio)

Edit the config file (macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`;
Windows: `%APPDATA%\Claude\claude_desktop_config.json`) and add an **absolute path** entry, then
restart Claude Desktop:

```json
{
  "mcpServers": {
    "zenon-docs": {
      "command": "npx",
      "args": ["tsx", "/ABSOLUTE/PATH/TO/tminusz-mcp/src/stdio.ts"]
    }
  }
}
```

Once connected, the client lists the tools below and exposes each Phase 1 spec as a pinnable
resource (`zenon://phase1/...`). Try `get_reading_guide` first to orient.

## Tools

- `list_docs(section?)` — browse the corpus tree
- `search_docs(query, section?, limit?)` — ranked keyword/fuzzy hits with snippets
- `read_doc(path, part?)` — full document text, paged for large files
- `get_phase1_spec(n)` — Phase 1 spec by number (1–11) **or name** (e.g. `"Dynamic Plasma"`) + its hostile review + reading-order neighbors
- `get_reading_guide()` — prescribed reading sequences

Sections: `architecture`, `notes`, `research`, `specs`, `phase1`, `essays`, `papers`.

## Security

The **stdio** transport has no network surface (the client spawns it as a child process). The
**HTTP** transport (`/mcp`) is **unauthenticated** — no API key, no TLS. Tools are read-only over a
public, MIT-licensed corpus, so there is no data-confidentiality risk, but the endpoint is open to
anyone who can reach the port. Keep it bound to localhost/a trusted network, or place an
authenticating reverse proxy in front of it before exposing it publicly.

## Test

```bash
npm test
```
