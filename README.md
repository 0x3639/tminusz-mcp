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

## Tools

- `list_docs(section?)` — browse the corpus tree
- `search_docs(query, section?, limit?)` — ranked keyword/fuzzy hits with snippets
- `read_doc(path, part?)` — full document text, paged for large files
- `get_phase1_spec(n)` — Phase 1 spec #n + its hostile review + reading-order neighbors
- `get_reading_guide()` — prescribed reading sequences

Sections: `architecture`, `notes`, `research`, `specs`, `phase1`, `essays`, `papers`.

## Test

```bash
npm test
```
