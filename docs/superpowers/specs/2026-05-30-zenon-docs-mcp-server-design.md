# Zenon Docs MCP Server — Design

**Date:** 2026-05-30
**Status:** Approved (design); pending implementation plan

## Purpose

Provide an MCP server that exposes the `zenon-developer-commons` documentation corpus
(vendored as a git submodule) as queryable context for AI agents. The immediate goal is to
give agents enough context to implement **Zenon Phase 1** — an additive libp2p networking
foundation beside the current Zenon stack, specified in `zenon-developer-commons/docs/specs/phase 1/`
as 11 sequential specs (each paired with a hostile review) plus a Dynamic Plasma spec.

The corpus is ~150 markdown files and ~35 PDFs across `docs/architecture`, `docs/notes`,
`docs/research`, `docs/specs`, `essays`, and root-level papers. The submodule is a frozen,
read-only reference; the server never mutates it.

### Success criteria

- An agent can discover, search, and read the full text of any corpus document (markdown or PDF).
- An agent can retrieve a Phase 1 spec together with its hostile review and reading-order context
  in a single call.
- Retrieval returns **whole documents** by default (Phase 1 specs are self-contained and meant to
  be read sequentially), with paging only as a guard for oversized PDFs.
- No external API keys or network dependencies required for retrieval.

## Key decisions

| Decision | Choice | Rationale |
|---|---|---|
| Retrieval model | Full-document + structured navigation + keyword search | Phase 1 specs are self-contained; whole-doc retrieval preserves the most context. No embedding infra. |
| Runtime | TypeScript / Node, `@modelcontextprotocol/sdk` | Most mature MCP SDK; good markdown + PDF libs. |
| PDF handling | Extract all PDFs to text at build time | Fast queries; all paper/review content searchable. Re-run on submodule update. |
| Transport | Both stdio and streamable HTTP, shared core | stdio for local agents (Claude Code/Desktop), HTTP for remote agents. |
| Search library | MiniSearch | Fuzzy + prefix matching, serializable index, pure JS, no API keys. |

## Architecture

A shared, transport-agnostic core wrapped by two thin entrypoints.

```
tminusz-mcp/
├── zenon-developer-commons/      # submodule (read-only corpus)
├── src/
│   ├── core/
│   │   ├── corpus.ts             # walk submodule, classify docs by section, build manifest
│   │   ├── pdf.ts                # PDF → text extraction (pdfjs-dist)
│   │   ├── search.ts             # MiniSearch index load + query
│   │   └── tools.ts              # tool/resource handler logic (no MCP/transport deps)
│   ├── index/build.ts            # build-time indexer → data/index.json
│   ├── server.ts                 # registers tools + resources on an McpServer
│   ├── stdio.ts                  # stdio transport entrypoint
│   └── http.ts                   # streamable-HTTP transport entrypoint
├── data/index.json               # generated artifact (gitignored)
└── package.json
```

**Module boundaries**

- `core/corpus.ts` — Knows the submodule layout. Walks the tree, classifies each file into a
  section (`architecture`, `notes`, `research`, `specs`, `essays`, `papers`, `phase1`), and
  produces a manifest of `{ path, section, title, type: md|pdf }`. Pure given a root path.
- `core/pdf.ts` — Extracts text from a PDF file path. Used only by the build step.
- `core/search.ts` — Loads `data/index.json`, runs MiniSearch queries, returns ranked hits with
  snippets. No knowledge of MCP.
- `core/tools.ts` — Implements each tool/resource as a plain function over corpus + search.
  Transport-agnostic; the unit of testing.
- `server.ts` — Registers `core/tools.ts` handlers onto an `McpServer` instance (tools + resources).
- `stdio.ts` / `http.ts` — Construct the server and connect the respective transport. No logic.

## Index & build

`npm run build-index` runs `src/index/build.ts`, which:

1. Walks the submodule via `core/corpus.ts` to build the document manifest.
2. For each markdown file: reads text, parses frontmatter (gray-matter), records body text.
3. For each PDF: extracts text via `core/pdf.ts` (pdfjs-dist) and records it.
4. Builds a MiniSearch index over `{ id, path, section, title, body }`.
5. Serializes the MiniSearch index + the manifest (with extracted text) to `data/index.json`.

The server loads `data/index.json` once at startup; all queries are read-only and fast. The
artifact must be rebuilt after `git submodule update`. `data/index.json` is gitignored (derived).

## MCP interface

### Tools

- **`list_docs(section?)`** — Browse the corpus tree, optionally filtered to one section.
  Returns `[{ path, title, section, type }]`.
- **`search_docs(query, section?, limit?)`** — Ranked keyword/fuzzy hits. Returns
  `[{ path, title, section, score, snippet }]` where `snippet` is context around the match.
  `limit` defaults to 10.
- **`read_doc(path, part?)`** — Returns the full text of a document (markdown source, or extracted
  text for PDFs). `part` is an optional 1-based page index into a chunked view used only when a
  document exceeds a size threshold (default ~50k characters/part), so oversized papers don't
  overflow the context window. Response includes `{ path, title, totalParts, part, content }`.
- **`get_phase1_spec(n)`** — For Phase 1 spec number `n` (1–11), returns the spec text, its hostile
  review text, and the titles/numbers of the previous and next specs in the prescribed reading
  order. This is the primary "enough context to build" entrypoint. Dynamic Plasma is addressable
  by name as a special case.
- **`get_reading_guide()`** — Returns the prescribed reading sequences: the paper series
  (GREENPAPER → PURPLEPAPER → INDIGOPAPER → ORANGEPAPER) and the Phase 1 order (1→11), plus the
  required-reading note for `docs/architecture/bounded-verification-boundries.md`.

### Resources

Each Phase 1 spec is exposed as an MCP resource with a stable URI
(`zenon://phase1/01-libp2p-host`, …) so clients can pin them directly into context. Resource
contents mirror `read_doc` for that path.

## Error handling

- Unknown `path` / out-of-range Phase 1 number / missing section → structured error result with
  the valid options (e.g. list of sections, valid spec range), not a thrown exception.
- Missing `data/index.json` at startup → fail fast with a clear message instructing the user to run
  `npm run build-index`.
- PDF extraction failure for a single file during build → log and skip that file; do not abort the
  whole index build.

## Testing

- **Core unit tests** (no MCP):
  - `corpus.ts` — classification of representative paths into correct sections; title extraction.
  - `pdf.ts` — extracts non-empty text from one sample corpus PDF.
  - `search.ts` — known query returns expected document in top results; section filter narrows results.
  - `tools.ts` — `get_phase1_spec(1)` returns the libp2p host spec **and** its hostile review and
    correct neighbor metadata; `read_doc` paging splits an oversized doc and reassembles.
- **MCP smoke test** — boot the server over stdio and exercise each tool end-to-end against the
  real corpus.

## Out of scope (YAGNI)

- Semantic / vector search and embeddings (may be added later if keyword recall proves inadequate).
- Writing to or modifying the submodule.
- Authentication for the HTTP transport beyond what local/dev usage requires (revisit if deployed
  remotely).
