# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repository is

This repo (`tminusz-mcp`) is the home for an **MCP server** that exposes the
[`zenon-developer-commons`](https://github.com/TminusZ/zenon-developer-commons) documentation
corpus as context for LLM clients. The corpus is vendored as a git **submodule** at
`zenon-developer-commons/`.

The server is implemented in TypeScript under `src/` (see **Commands** and **Server architecture**
below). Treat the submodule as a read-only content source: the server's job is to make those
documents discoverable and retrievable (as MCP resources and search/retrieval tools), not to
modify them.

## Commands

```bash
npm install                 # install deps
npm run build-index         # (re)build data/index.json from the submodule — run after submodule updates
npm run start:stdio         # run MCP server over stdio (local agents)
npm run start:http          # run MCP server over HTTP on :3000/mcp
npm test                    # vitest run (all tests)
npx vitest run src/core/tools.test.ts   # run a single test file
npm run typecheck           # tsc --noEmit
```

The server loads `data/index.json` at startup and fails fast with a "run build-index" hint if it
is missing. `data/` is gitignored.

## Server architecture

`src/core/` is a transport-agnostic core: `corpus.ts` walks the submodule, `pdf.ts` extracts PDF
text, `state.ts` builds an in-memory MiniSearch index from a saved `data/index.json`, and
`tools.ts` implements the five tools as pure `(CorpusState, …) -> string` functions (errors are
returned as strings prefixed `ERROR:`, never thrown). `src/server.ts` registers those tools plus
one MCP resource per Phase 1 spec; `src/stdio.ts` and `src/http.ts` are thin entrypoints that load
the corpus once and share it.

## Working with the submodule

The corpus lives in the `zenon-developer-commons/` submodule. Standard submodule workflow applies:

```bash
git submodule update --init --recursive   # populate after a fresh clone
git submodule update --remote zenon-developer-commons   # pull upstream changes
```

The submodule's upstream is a frozen reference ("No further updates are planned" per its README),
so pin to a known commit rather than tracking a branch.

**Do not edit files inside `zenon-developer-commons/`** — changes there belong upstream, not in this
repo. Read it; don't mutate it.

## Environment note

In this shell, `ls` is aliased to `colorls`, which chokes on flags like `-F` and prints gem warnings.
Prefer the Read/Glob tools, or use `find` / `git ls-files` instead of `ls` when scripting.

## The content corpus (what the server will serve)

Understanding the corpus layout matters more than any code here, since retrieval tooling must map
onto it. Everything below is under `zenon-developer-commons/`:

- **`README.md`** — entry point. Defines the prescribed reading order for the paper series:
  GREENPAPER → PURPLEPAPER → INDIGOPAPER → ORANGEPAPER. Also lists key documents and a curated
  reading list. **`docs/architecture/bounded-verification-boundries.md` is flagged as required
  reading before relying on any of the models.**
- **`docs/architecture/`** — high-level system design. `architecture-overview.md` is the best
  single primer (momentums, account-chain DAG / block-lattice, node roles, ACIs, proof model).
- **`docs/notes/`** — the densest technical material: ~30 numbered and named notes on bounded
  verification, verifier lifecycle, light-client architecture, momentum/header verification,
  sentinel/supervisor layers, plasma, etc. Numbered files (`0x00_…` through `0x10_…`) form an
  ordered sequence.
- **`docs/research/`** — research blueprints and "hostile review" critiques (markdown + PDF pairs),
  e.g. Bitcoin SPV, header-only verification, bounded inclusion, decentralized identity. Many
  topics ship as both a `.md` write-up and a corresponding `.pdf`.
- **`docs/specs/`** — proposals and specs (Zenon Portal, phase 1, Interstellar OS stack).
- **`essays/`** — narrative/conceptual essays (the "Alien Architecture" series, etc.).
- **`greenpaper_series/`** and root-level PDFs — the formal papers (lightpaper, whitepaper,
  greenpaper/purplepaper/indigopaper/orangepaper, plus cover letters).

File-type mix is roughly: ~150 markdown files, ~35 PDFs, a couple of images/SVGs. A retrieval
server will need to handle **both markdown and PDF** content.

## Core domain vocabulary

Zenon = "The Network of Momentum (NoM)". Key terms that recur across the corpus and should inform
how tools/resources are named and described:

- **Momentum** — the consensus unit (snapshots recent account blocks, references prior momentums,
  signed by the Pillar quorum). Zenon is not a traditional blockchain.
- **Account-chain / block-lattice** — every address has its own mini-chain; account blocks anchor
  into global momentums, enabling parallel async updates.
- **Node roles** — Pillars (consensus/signing), Delegators (bond ZNN), Sentinels (planned
  proof-serving layer), Full Nodes, Light Clients.
- **ACI (Application Contract Interface)** — deterministic, schema-defined contract interfaces;
  Zenon has no general-purpose VM. Execution happens off-chain; proofs/commitments go on-chain.
- **Bounded verification** — the corpus's central theme: verifying facts (including external ones
  like Bitcoin SPV) within stated invariants, without executing foreign state machines.

These models "align with Zenon but do not define it"; correctness is only defined within stated
invariants. Reflect that framing — don't present the docs as authoritative protocol spec.
