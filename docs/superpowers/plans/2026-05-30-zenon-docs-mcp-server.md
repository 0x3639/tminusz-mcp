# Zenon Docs MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a TypeScript MCP server that exposes the `zenon-developer-commons` submodule corpus as searchable, full-document context for AI agents implementing Zenon Phase 1.

**Architecture:** A pure, transport-agnostic core (`src/core/`) loads a prebuilt JSON index of every corpus document (markdown read directly, PDFs extracted to text at build time) into an in-memory MiniSearch index. Five tools and Phase 1 resources are registered on an `McpServer`, wrapped by thin stdio and streamable-HTTP entrypoints that share one loaded corpus state.

**Tech Stack:** Node 20+, TypeScript (ESM), `@modelcontextprotocol/sdk`, `minisearch`, `gray-matter`, `pdfjs-dist`, `zod`, `express`; tested with `vitest`, run with `tsx`.

**Spec:** `docs/superpowers/specs/2026-05-30-zenon-docs-mcp-server-design.md`

---

## File structure

| File | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore` | Project config, scripts, ESM/TS setup |
| `src/types/pdfjs.d.ts` | Ambient module decl for the pdfjs legacy build |
| `src/core/types.ts` | Shared types: `Section`, `DocType`, `DocEntry`, `IndexedDoc`, `CorpusState`, `Hit` |
| `src/core/paths.ts` | Resolved absolute paths: `PROJECT_ROOT`, `CORPUS_ROOT`, `INDEX_PATH` |
| `src/core/corpus.ts` | `classifySection`, `titleFromFilename`, `titleFromMarkdown`, `walkCorpus` (FS walk) |
| `src/core/pdf.ts` | `extractPdfText` (PDF → text) |
| `src/core/state.ts` | `buildState`, `searchState`, `makeSnippet`, `saveCorpus`, `loadCorpus` |
| `src/core/tools.ts` | The 5 tool functions + `splitIntoParts` (operate on `CorpusState`, return strings) |
| `src/index/build.ts` | `collectDocs` + CLI `main` that writes `data/index.json` |
| `src/server.ts` | `createServer(state)` — registers tools + Phase 1 resources |
| `src/stdio.ts` | stdio transport entrypoint |
| `src/http.ts` | `createHttpApp(state)` + streamable-HTTP entrypoint |
| `data/index.json` | Generated artifact (gitignored) |

Tools return plain agent-readable strings; `server.ts` wraps them in MCP content and sets `isError` when a string begins with `ERROR:`. Error cases never throw — they return a string explaining valid options.

---

## Task 1: Project scaffolding

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `src/types/pdfjs.d.ts`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "tminusz-mcp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build-index": "tsx src/index/build.ts",
    "start:stdio": "tsx src/stdio.ts",
    "start:http": "tsx src/http.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.0",
    "express": "^4.21.0",
    "gray-matter": "^4.0.3",
    "minisearch": "^7.1.0",
    "pdfjs-dist": "^4.7.76",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/node": "^22.7.0",
    "tsx": "^4.19.0",
    "typescript": "^5.6.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": ["node"],
    "outDir": "dist",
    "rootDir": "."
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
```

- [ ] **Step 4: Create `.gitignore`**

```gitignore
node_modules/
dist/
data/
*.log
```

- [ ] **Step 5: Create `src/types/pdfjs.d.ts`**

```ts
declare module "pdfjs-dist/legacy/build/pdf.mjs";
```

- [ ] **Step 6: Install dependencies**

Run: `npm install`
Expected: completes, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 7: Verify the toolchain runs**

Run: `npx vitest run`
Expected: vitest starts and reports "No test files found" (exit 0 or "no tests"). This confirms vitest + TS resolve.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore src/types/pdfjs.d.ts
git commit -m "chore: scaffold MCP server project (TS, vitest, deps)"
```

---

## Task 2: Shared types and paths

**Files:**
- Create: `src/core/types.ts`
- Create: `src/core/paths.ts`
- Test: `src/core/paths.test.ts`

- [ ] **Step 1: Create `src/core/types.ts`**

```ts
import type MiniSearch from "minisearch";

export type DocType = "md" | "pdf";

export type Section =
  | "architecture"
  | "notes"
  | "research"
  | "specs"
  | "phase1"
  | "essays"
  | "papers";

export interface DocEntry {
  path: string; // relative to corpus root, forward slashes
  section: Section;
  type: DocType;
  title: string;
}

export interface IndexedDoc extends DocEntry {
  body: string;
}

export interface CorpusState {
  docs: IndexedDoc[];
  byPath: Map<string, IndexedDoc>;
  search: MiniSearch<IndexedDoc>;
}

export interface Hit {
  path: string;
  title: string;
  section: string;
  score: number;
  snippet: string;
}
```

- [ ] **Step 2: Create `src/core/paths.ts`**

```ts
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // .../src/core
export const PROJECT_ROOT = path.resolve(here, "..", "..");
export const CORPUS_ROOT = path.join(PROJECT_ROOT, "zenon-developer-commons");
export const INDEX_PATH = path.join(PROJECT_ROOT, "data", "index.json");
```

- [ ] **Step 3: Write the failing test `src/core/paths.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { CORPUS_ROOT, INDEX_PATH, PROJECT_ROOT } from "./paths.js";

describe("paths", () => {
  it("resolves the corpus root to the submodule directory that exists", () => {
    expect(CORPUS_ROOT.endsWith("zenon-developer-commons")).toBe(true);
    expect(existsSync(CORPUS_ROOT)).toBe(true);
  });

  it("places the index under the project data directory", () => {
    expect(INDEX_PATH.startsWith(PROJECT_ROOT)).toBe(true);
    expect(INDEX_PATH.endsWith("index.json")).toBe(true);
  });
});
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/paths.test.ts`
Expected: PASS (2 tests). If `CORPUS_ROOT` does not exist, run `git submodule update --init` first.

- [ ] **Step 5: Commit**

```bash
git add src/core/types.ts src/core/paths.ts src/core/paths.test.ts
git commit -m "feat: add core types and resolved corpus paths"
```

---

## Task 3: Section classification

**Files:**
- Create: `src/core/corpus.ts` (partial — `classifySection` only)
- Test: `src/core/corpus.test.ts`

- [ ] **Step 1: Write the failing test `src/core/corpus.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { classifySection } from "./corpus.js";

describe("classifySection", () => {
  it("classifies phase 1 specs before generic specs", () => {
    expect(classifySection("docs/specs/phase 1/01-libp2p host spec.md")).toBe("phase1");
    expect(classifySection("docs/specs/phase 1/hostile reviews/01-libp2p host hostile review.md")).toBe("phase1");
    expect(classifySection("docs/specs/Zenon Portal/overview.md")).toBe("specs");
  });

  it("classifies the main doc sections", () => {
    expect(classifySection("docs/architecture/architecture-overview.md")).toBe("architecture");
    expect(classifySection("docs/notes/pillars.md")).toBe("notes");
    expect(classifySection("docs/research/bitcoin-anchoring.md")).toBe("research");
    expect(classifySection("essays/SATOSHI'S_PREMISE.md")).toBe("essays");
  });

  it("treats root-level and unknown locations as papers", () => {
    expect(classifySection("ZENON_GREENPAPER.pdf")).toBe("papers");
    expect(classifySection("greenpaper_series/intro.md")).toBe("papers");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/corpus.test.ts`
Expected: FAIL — cannot import `classifySection` (module not found / not exported).

- [ ] **Step 3: Create `src/core/corpus.ts` with `classifySection`**

```ts
import type { Section } from "./types.js";

export function classifySection(relPath: string): Section {
  const p = relPath.replace(/\\/g, "/");
  if (p.startsWith("docs/specs/phase 1/")) return "phase1";
  if (p.startsWith("docs/architecture/")) return "architecture";
  if (p.startsWith("docs/notes/")) return "notes";
  if (p.startsWith("docs/research/")) return "research";
  if (p.startsWith("docs/specs/")) return "specs";
  if (p.startsWith("essays/")) return "essays";
  return "papers";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/corpus.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/core/corpus.ts src/core/corpus.test.ts
git commit -m "feat: classify corpus paths into sections"
```

---

## Task 4: Title extraction

**Files:**
- Modify: `src/core/corpus.ts` (add `titleFromFilename`, `titleFromMarkdown`)
- Modify: `src/core/corpus.test.ts` (add cases)

- [ ] **Step 1: Add failing tests to `src/core/corpus.test.ts`**

Append:

```ts
import { titleFromFilename, titleFromMarkdown } from "./corpus.js";

describe("titleFromFilename", () => {
  it("strips extension and humanizes separators", () => {
    expect(titleFromFilename("docs/notes/state-proof-bundles.md")).toBe("state proof bundles");
    expect(titleFromFilename("ZENON_GREENPAPER.pdf")).toBe("ZENON GREENPAPER");
  });
});

describe("titleFromMarkdown", () => {
  it("prefers a frontmatter title", () => {
    const raw = "---\ntitle: Real Title\n---\n# Other Heading\nbody";
    expect(titleFromMarkdown(raw, "fallback")).toBe("Real Title");
  });

  it("falls back to the first H1 heading", () => {
    const raw = "intro line\n\n# The Heading\n\nbody";
    expect(titleFromMarkdown(raw, "fallback")).toBe("The Heading");
  });

  it("uses the fallback when neither is present", () => {
    expect(titleFromMarkdown("just body text", "fallback")).toBe("fallback");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/corpus.test.ts`
Expected: FAIL — `titleFromFilename` / `titleFromMarkdown` not exported.

- [ ] **Step 3: Add implementations to `src/core/corpus.ts`**

```ts
import matter from "gray-matter";

export function titleFromFilename(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.(md|pdf)$/i, "").replace(/[-_]+/g, " ").trim();
}

export function titleFromMarkdown(raw: string, fallback: string): string {
  try {
    const parsed = matter(raw);
    if (typeof parsed.data?.title === "string" && parsed.data.title.trim()) {
      return parsed.data.title.trim();
    }
    const m = parsed.content.match(/^\s*#\s+(.+?)\s*$/m);
    if (m) return m[1].trim();
  } catch {
    // malformed frontmatter — fall through to fallback
  }
  return fallback;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/corpus.test.ts`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add src/core/corpus.ts src/core/corpus.test.ts
git commit -m "feat: extract doc titles from filename, frontmatter, and H1"
```

---

## Task 5: Corpus filesystem walk

**Files:**
- Modify: `src/core/corpus.ts` (add `walkCorpus`)
- Modify: `src/core/corpus.test.ts` (add real-corpus test)

- [ ] **Step 1: Add failing test to `src/core/corpus.test.ts`**

Append:

```ts
import { walkCorpus } from "./corpus.js";
import { CORPUS_ROOT } from "./paths.js";

describe("walkCorpus (real corpus)", () => {
  const entries = walkCorpus(CORPUS_ROOT);

  it("finds many markdown docs and some PDFs", () => {
    expect(entries.length).toBeGreaterThan(100);
    expect(entries.some((e) => e.type === "md")).toBe(true);
    expect(entries.some((e) => e.type === "pdf")).toBe(true);
  });

  it("includes the phase 1 libp2p host spec, classified as phase1", () => {
    const spec = entries.find((e) => e.path === "docs/specs/phase 1/01-libp2p host spec.md");
    expect(spec).toBeDefined();
    expect(spec?.section).toBe("phase1");
  });

  it("returns forward-slash relative paths sorted ascending", () => {
    expect(entries.every((e) => !e.path.includes("\\"))).toBe(true);
    const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
    expect(entries.map((e) => e.path)).toEqual(sorted.map((e) => e.path));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/corpus.test.ts`
Expected: FAIL — `walkCorpus` not exported.

- [ ] **Step 3: Add `walkCorpus` to `src/core/corpus.ts`**

```ts
import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import type { DocEntry, DocType } from "./types.js";

export function walkCorpus(root: string): DocEntry[] {
  const out: DocEntry[] = [];

  function recurse(dir: string): void {
    for (const name of readdirSync(dir)) {
      if (name === ".git") continue;
      const abs = path.join(dir, name);
      if (statSync(abs).isDirectory()) {
        recurse(abs);
        continue;
      }
      const ext = path.extname(name).toLowerCase();
      const type: DocType | null = ext === ".md" ? "md" : ext === ".pdf" ? "pdf" : null;
      if (!type) continue;
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      out.push({
        path: rel,
        section: classifySection(rel),
        type,
        title: titleFromFilename(rel),
      });
    }
  }

  recurse(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/corpus.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/corpus.ts src/core/corpus.test.ts
git commit -m "feat: walk corpus tree into classified doc entries"
```

---

## Task 6: PDF text extraction

**Files:**
- Create: `src/core/pdf.ts`
- Test: `src/core/pdf.test.ts`

- [ ] **Step 1: Write the failing test `src/core/pdf.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import path from "node:path";
import { extractPdfText } from "./pdf.js";
import { CORPUS_ROOT } from "./paths.js";

describe("extractPdfText (real corpus)", () => {
  it("extracts non-trivial text from a corpus PDF", async () => {
    const pdf = path.join(CORPUS_ROOT, "docs/research/bitcoin_anchoring.pdf");
    const text = await extractPdfText(pdf);
    expect(text.length).toBeGreaterThan(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/pdf.test.ts`
Expected: FAIL — `extractPdfText` not exported.

- [ ] **Step 3: Create `src/core/pdf.ts`**

```ts
import { readFile } from "node:fs/promises";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export async function extractPdfText(absPath: string): Promise<string> {
  const data = new Uint8Array(await readFile(absPath));
  const doc = await getDocument({ data, useSystemFonts: true }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items
      .map((it: { str?: string }) => (typeof it.str === "string" ? it.str : ""))
      .join(" ");
    pages.push(text);
  }
  await doc.cleanup();
  return pages.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/pdf.test.ts`
Expected: PASS. If the named PDF is missing, pick any path from `npx tsx -e "import('./src/core/corpus.ts').then(m=>console.log(m.walkCorpus(process.env.PWD+'/zenon-developer-commons').filter(e=>e.type==='pdf').slice(0,3)))"` and update the test path.

- [ ] **Step 5: Commit**

```bash
git add src/core/pdf.ts src/core/pdf.test.ts
git commit -m "feat: extract text from PDFs via pdfjs-dist"
```

---

## Task 7: In-memory state, search, and snippets

**Files:**
- Create: `src/core/state.ts` (`buildState`, `searchState`, `makeSnippet`)
- Test: `src/core/state.test.ts`

- [ ] **Step 1: Write the failing test `src/core/state.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildState, searchState, makeSnippet } from "./state.js";
import type { IndexedDoc } from "./types.js";

const docs: IndexedDoc[] = [
  { path: "docs/notes/pillars.md", section: "notes", type: "md", title: "Pillars", body: "Pillars sign momentums and participate in consensus quorums." },
  { path: "docs/specs/phase 1/01-libp2p host spec.md", section: "phase1", type: "md", title: "libp2p Host", body: "The libp2p host configures transports and connection gating for peers." },
  { path: "docs/notes/dynamic-plasma.md", section: "notes", type: "md", title: "Dynamic Plasma", body: "Plasma meters account-chain throughput." },
];

describe("buildState + searchState", () => {
  const state = buildState(docs);

  it("indexes every doc and maps them by path", () => {
    expect(state.docs).toHaveLength(3);
    expect(state.byPath.get("docs/notes/pillars.md")?.title).toBe("Pillars");
  });

  it("finds the relevant doc by a body term", () => {
    const hits = searchState(state, "consensus");
    expect(hits[0]?.path).toBe("docs/notes/pillars.md");
    expect(hits[0]?.snippet).toContain("consensus");
  });

  it("filters by section", () => {
    const hits = searchState(state, "host", { section: "phase1" });
    expect(hits.every((h) => h.section === "phase1")).toBe(true);
  });

  it("respects the limit", () => {
    const hits = searchState(state, "plasma momentums host", { limit: 1 });
    expect(hits.length).toBeLessThanOrEqual(1);
  });
});

describe("makeSnippet", () => {
  it("centers on the first matching term and collapses whitespace", () => {
    const snip = makeSnippet("alpha beta gamma DELTA epsilon", "delta", 8);
    expect(snip.toLowerCase()).toContain("delta");
    expect(snip).not.toContain("\n");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/state.test.ts`
Expected: FAIL — `state.js` exports not found.

- [ ] **Step 3: Create `src/core/state.ts` (build + search + snippet portions)**

```ts
import MiniSearch from "minisearch";
import type { CorpusState, Hit, IndexedDoc } from "./types.js";

export const MS_OPTIONS = {
  idField: "path",
  fields: ["title", "body"],
  storeFields: ["path", "section", "title", "type"],
  searchOptions: { boost: { title: 2 }, fuzzy: 0.2, prefix: true },
};

export function buildState(docs: IndexedDoc[]): CorpusState {
  const search = new MiniSearch<IndexedDoc>(MS_OPTIONS);
  search.addAll(docs);
  const byPath = new Map(docs.map((d) => [d.path, d]));
  return { docs, byPath, search };
}

export function makeSnippet(body: string, query: string, radius = 160): string {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const lower = body.toLowerCase();
  let idx = -1;
  for (const t of terms) {
    const i = lower.indexOf(t);
    if (i !== -1 && (idx === -1 || i < idx)) idx = i;
  }
  if (idx === -1) idx = 0;
  const start = Math.max(0, idx - radius);
  const end = Math.min(body.length, idx + radius);
  const snip = body.slice(start, end).replace(/\s+/g, " ").trim();
  return (start > 0 ? "…" : "") + snip + (end < body.length ? "…" : "");
}

export function searchState(
  state: CorpusState,
  query: string,
  opts: { section?: string; limit?: number } = {},
): Hit[] {
  const { section, limit = 10 } = opts;
  let results = state.search.search(query);
  if (section) {
    results = results.filter((r) => state.byPath.get(r.id as string)?.section === section);
  }
  return results.slice(0, limit).map((r) => {
    const doc = state.byPath.get(r.id as string)!;
    return {
      path: doc.path,
      title: doc.title,
      section: doc.section,
      score: r.score,
      snippet: makeSnippet(doc.body, query),
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/state.ts src/core/state.test.ts
git commit -m "feat: build in-memory MiniSearch state with snippet search"
```

---

## Task 8: Persist and load the index

**Files:**
- Modify: `src/core/state.ts` (add `saveCorpus`, `loadCorpus`)
- Modify: `src/core/state.test.ts` (add round-trip test)

- [ ] **Step 1: Add failing test to `src/core/state.test.ts`**

Append:

```ts
import { saveCorpus, loadCorpus } from "./state.js";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

describe("saveCorpus + loadCorpus round-trip", () => {
  it("writes docs to JSON and reloads a working searchable state", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "zenon-idx-"));
    const file = path.join(dir, "index.json");
    saveCorpus(file, docs);
    const reloaded = loadCorpus(file);
    expect(reloaded.docs).toHaveLength(3);
    expect(searchState(reloaded, "consensus")[0]?.path).toBe("docs/notes/pillars.md");
  });

  it("throws a build-index hint when the file is missing", () => {
    expect(() => loadCorpus("/no/such/index.json")).toThrow(/build-index/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/state.test.ts`
Expected: FAIL — `saveCorpus` / `loadCorpus` not exported.

- [ ] **Step 3: Add `saveCorpus` and `loadCorpus` to `src/core/state.ts`**

```ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export function saveCorpus(filePath: string, docs: IndexedDoc[]): void {
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify({ docs }), "utf8");
}

export function loadCorpus(filePath: string): CorpusState {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(`Index not found at ${filePath}. Run: npm run build-index`);
  }
  const parsed = JSON.parse(raw) as { docs: IndexedDoc[] };
  return buildState(parsed.docs);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/state.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/state.ts src/core/state.test.ts
git commit -m "feat: persist and reload the corpus index as JSON"
```

---

## Task 9: list_docs, search_docs, read_doc tools

**Files:**
- Create: `src/core/tools.ts` (`SECTIONS`, `splitIntoParts`, `listDocs`, `searchDocs`, `readDoc`)
- Test: `src/core/tools.test.ts`

- [ ] **Step 1: Write the failing test `src/core/tools.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { buildState } from "./state.js";
import { listDocs, searchDocs, readDoc, splitIntoParts } from "./tools.js";
import type { IndexedDoc } from "./types.js";

const docs: IndexedDoc[] = [
  { path: "docs/specs/phase 1/01-libp2p host spec.md", section: "phase1", type: "md", title: "libp2p Host", body: "The libp2p host establishes transports and connection gating." },
  { path: "docs/specs/phase 1/hostile reviews/01-libp2p host hostile review.md", section: "phase1", type: "md", title: "libp2p Host Hostile Review", body: "Concern: connection gating may regress current peers." },
  { path: "docs/specs/phase 1/02-peer service discovery spec.md", section: "phase1", type: "md", title: "Peer Service Discovery", body: "Discovery advertises service capabilities to peers." },
  { path: "docs/notes/pillars.md", section: "notes", type: "md", title: "Pillars", body: "Pillars sign momentums and participate in consensus." },
];
const state = buildState(docs);

describe("splitIntoParts", () => {
  it("returns one part when under the size", () => {
    expect(splitIntoParts("abc", 10)).toEqual(["abc"]);
  });
  it("splits oversized content into chunks", () => {
    expect(splitIntoParts("abcde", 2)).toEqual(["ab", "cd", "e"]);
  });
});

describe("listDocs", () => {
  it("lists all docs by default", () => {
    expect(listDocs(state)).toContain("docs/notes/pillars.md");
    expect(listDocs(state)).toContain("4 document(s)");
  });
  it("filters by section", () => {
    const out = listDocs(state, "notes");
    expect(out).toContain("pillars.md");
    expect(out).not.toContain("libp2p host spec");
  });
  it("errors on an unknown section", () => {
    expect(listDocs(state, "bogus")).toMatch(/^ERROR:/);
  });
});

describe("searchDocs", () => {
  it("returns hits with snippets", () => {
    expect(searchDocs(state, "consensus")).toContain("pillars.md");
  });
  it("errors on empty query", () => {
    expect(searchDocs(state, "  ")).toMatch(/^ERROR:/);
  });
});

describe("readDoc", () => {
  it("returns the full body with a header", () => {
    const out = readDoc(state, "docs/notes/pillars.md");
    expect(out).toContain("Part 1/1");
    expect(out).toContain("consensus");
  });
  it("errors with suggestions for an unknown path", () => {
    expect(readDoc(state, "docs/notes/pillarz.md")).toMatch(/^ERROR:/);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/tools.test.ts`
Expected: FAIL — `tools.js` exports not found.

- [ ] **Step 3: Create `src/core/tools.ts` (these three tools + helpers)**

```ts
import type { CorpusState } from "./types.js";
import { searchState } from "./state.js";

export const SECTIONS = [
  "architecture",
  "notes",
  "research",
  "specs",
  "phase1",
  "essays",
  "papers",
] as const;

const PART_SIZE = 50000;

export function splitIntoParts(content: string, size = PART_SIZE): string[] {
  if (content.length <= size) return [content];
  const parts: string[] = [];
  for (let i = 0; i < content.length; i += size) parts.push(content.slice(i, i + size));
  return parts;
}

export function listDocs(state: CorpusState, section?: string): string {
  if (section && !SECTIONS.includes(section as (typeof SECTIONS)[number])) {
    return `ERROR: unknown section "${section}". Valid: ${SECTIONS.join(", ")}`;
  }
  const docs = state.docs.filter((d) => !section || d.section === section);
  const lines = docs.map((d) => `- [${d.section}] ${d.path} — ${d.title} (${d.type})`);
  return `${docs.length} document(s)${section ? ` in "${section}"` : ""}:\n${lines.join("\n")}`;
}

export function searchDocs(
  state: CorpusState,
  query: string,
  section?: string,
  limit = 10,
): string {
  if (!query.trim()) return "ERROR: query is empty";
  if (section && !SECTIONS.includes(section as (typeof SECTIONS)[number])) {
    return `ERROR: unknown section "${section}". Valid: ${SECTIONS.join(", ")}`;
  }
  const hits = searchState(state, query, { section, limit });
  if (hits.length === 0) {
    return `No matches for "${query}"${section ? ` in "${section}"` : ""}.`;
  }
  return hits
    .map((h, i) => `${i + 1}. ${h.path} — ${h.title} [${h.section}]\n   ${h.snippet}`)
    .join("\n\n");
}

export function readDoc(state: CorpusState, docPath: string, part = 1): string {
  const doc = state.byPath.get(docPath);
  if (!doc) {
    const base = docPath.split("/").pop() ?? docPath;
    const near = state.docs
      .filter((d) => d.path.includes(base))
      .slice(0, 5)
      .map((d) => d.path);
    return `ERROR: no document at "${docPath}".${
      near.length ? ` Did you mean:\n${near.join("\n")}` : " Use list_docs to browse."
    }`;
  }
  const parts = splitIntoParts(doc.body);
  const p = Math.min(Math.max(1, Math.floor(part)), parts.length);
  const header = `# ${doc.title}\nPath: ${doc.path} | Section: ${doc.section} | Part ${p}/${parts.length}\n\n`;
  return header + parts[p - 1];
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/tools.ts src/core/tools.test.ts
git commit -m "feat: add list_docs, search_docs, read_doc tool functions"
```

---

## Task 10: get_phase1_spec and get_reading_guide tools

**Files:**
- Modify: `src/core/tools.ts` (add `getPhase1Spec`, `getReadingGuide`)
- Modify: `src/core/tools.test.ts` (add cases)

- [ ] **Step 1: Add failing tests to `src/core/tools.test.ts`**

Append:

```ts
import { getPhase1Spec, getReadingGuide } from "./tools.js";

describe("getPhase1Spec", () => {
  it("bundles the spec, its hostile review, and neighbors", () => {
    const out = getPhase1Spec(state, 1);
    expect(out).toContain("## Specification");
    expect(out).toContain("connection gating"); // from spec body
    expect(out).toContain("## Hostile Review");
    expect(out).toContain("regress current peers"); // from review body
    expect(out).toContain("Next: #2");
  });

  it("errors with the valid range for an out-of-range number", () => {
    const out = getPhase1Spec(state, 99);
    expect(out).toMatch(/^ERROR:/);
    expect(out).toContain("1–2");
  });
});

describe("getReadingGuide", () => {
  it("includes the paper series order and phase 1 order", () => {
    const out = getReadingGuide();
    expect(out).toContain("GREENPAPER");
    expect(out).toContain("11. Implementation Readiness Checklist");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/core/tools.test.ts`
Expected: FAIL — `getPhase1Spec` / `getReadingGuide` not exported.

- [ ] **Step 3: Add implementations to `src/core/tools.ts`**

```ts
function phase1Number(p: string): number | null {
  const file = p.split("/").pop() ?? "";
  const m = file.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function isHostileReview(p: string): boolean {
  return p.toLowerCase().includes("hostile review");
}

export function getPhase1Spec(state: CorpusState, n: number): string {
  const specs = state.docs
    .filter(
      (d) =>
        d.section === "phase1" &&
        d.type === "md" &&
        !isHostileReview(d.path) &&
        phase1Number(d.path) !== null,
    )
    .sort((a, b) => phase1Number(a.path)! - phase1Number(b.path)!);

  if (specs.length === 0) return "ERROR: no Phase 1 specs found in the corpus.";

  const numbers = specs.map((s) => phase1Number(s.path)!);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const spec = specs.find((s) => phase1Number(s.path) === n);
  if (!spec) return `ERROR: no Phase 1 spec #${n}. Valid range: ${min}–${max}.`;

  const review = state.docs.find(
    (d) => d.section === "phase1" && isHostileReview(d.path) && phase1Number(d.path) === n,
  );
  const idx = specs.indexOf(spec);
  const prev = specs[idx - 1];
  const next = specs[idx + 1];
  const nav =
    (prev ? `Previous: #${phase1Number(prev.path)} ${prev.title}` : "Previous: (none)") +
    " | " +
    (next ? `Next: #${phase1Number(next.path)} ${next.title}` : "Next: (none)");

  return [
    `# Phase 1 — Spec #${n}: ${spec.title}`,
    nav,
    `\n## Specification (${spec.path})\n\n${spec.body}`,
    review
      ? `\n## Hostile Review (${review.path})\n\n${review.body}`
      : `\n## Hostile Review\n\n(none found for spec #${n})`,
  ].join("\n");
}

export function getReadingGuide(): string {
  return [
    "# Zenon Developer Commons — Reading Guide",
    "",
    "## Required first",
    "Read docs/architecture/bounded-verification-boundries.md before relying on any model.",
    "",
    "## Paper series order",
    "GREENPAPER → PURPLEPAPER → INDIGOPAPER → ORANGEPAPER",
    "",
    "## Phase 1 implementation order (use get_phase1_spec(n))",
    "1. libp2p Host",
    "2. Peer Service Discovery",
    "3. Peer Reachability Verification",
    "4. Peer Service Scoring",
    "5. libp2p Sync Protocol",
    "6. Sync Candidate Selection",
    "7. Sync Request Scheduling",
    "8. Initial Sync Strategy",
    "9. libp2p Gossip Protocol",
    "10. Current P2P Coexistence and Migration",
    "11. Implementation Readiness Checklist",
    "",
    "For each spec: read the spec, then its hostile review, then resolve open assumptions before proceeding.",
  ].join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/core/tools.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/core/tools.ts src/core/tools.test.ts
git commit -m "feat: add get_phase1_spec and get_reading_guide tools"
```

---

## Task 11: Build script (collectDocs + CLI)

**Files:**
- Create: `src/index/build.ts`
- Test: `src/index/build.test.ts`

- [ ] **Step 1: Write the failing test `src/index/build.test.ts`**

```ts
import { describe, it, expect } from "vitest";
import { collectDocs } from "./build.js";
import { buildState } from "../core/state.js";
import { getPhase1Spec } from "../core/tools.js";
import { CORPUS_ROOT } from "../core/paths.js";

describe("collectDocs (real corpus, markdown only for speed)", () => {
  it("reads markdown bodies and refines titles", async () => {
    const docs = await collectDocs(CORPUS_ROOT, false);
    const spec = docs.find((d) => d.path === "docs/specs/phase 1/01-libp2p host spec.md");
    expect(spec).toBeDefined();
    expect(spec!.body.length).toBeGreaterThan(50);
  });

  it("produces a state where get_phase1_spec(1) returns spec + review", async () => {
    const docs = await collectDocs(CORPUS_ROOT, false);
    const state = buildState(docs);
    const out = getPhase1Spec(state, 1);
    expect(out).toContain("## Specification");
    expect(out).toContain("## Hostile Review");
    expect(out).not.toContain("(none found");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/index/build.test.ts`
Expected: FAIL — `build.js` / `collectDocs` not found.

- [ ] **Step 3: Create `src/index/build.ts`**

```ts
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { walkCorpus, titleFromMarkdown } from "../core/corpus.js";
import { extractPdfText } from "../core/pdf.js";
import { saveCorpus } from "../core/state.js";
import { CORPUS_ROOT, INDEX_PATH } from "../core/paths.js";
import type { IndexedDoc } from "../core/types.js";

export async function collectDocs(root: string, includePdf = true): Promise<IndexedDoc[]> {
  const entries = walkCorpus(root);
  const docs: IndexedDoc[] = [];
  for (const e of entries) {
    const abs = path.join(root, e.path);
    if (e.type === "md") {
      const raw = await readFile(abs, "utf8");
      docs.push({ ...e, title: titleFromMarkdown(raw, e.title), body: raw });
    } else if (!includePdf) {
      docs.push({ ...e, body: "" });
    } else {
      try {
        docs.push({ ...e, body: await extractPdfText(abs) });
      } catch (err) {
        console.error(`PDF extract failed, indexing without body: ${e.path}: ${(err as Error).message}`);
        docs.push({ ...e, body: "" });
      }
    }
  }
  return docs;
}

async function main(): Promise<void> {
  console.error(`Indexing corpus at ${CORPUS_ROOT} …`);
  const docs = await collectDocs(CORPUS_ROOT, true);
  saveCorpus(INDEX_PATH, docs);
  const pdfCount = docs.filter((d) => d.type === "pdf").length;
  console.error(`Wrote ${docs.length} docs (${pdfCount} PDFs) → ${INDEX_PATH}`);
}

const isMain =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/index/build.test.ts`
Expected: PASS.

- [ ] **Step 5: Build the real index (includes PDFs)**

Run: `npm run build-index`
Expected: prints "Wrote N docs (M PDFs) → …/data/index.json" with N > 150, M ≈ 35. Creates `data/index.json`.

- [ ] **Step 6: Commit**

```bash
git add src/index/build.ts src/index/build.test.ts
git commit -m "feat: add corpus index build script (collectDocs + CLI)"
```

---

## Task 12: MCP server (tools + resources)

**Files:**
- Create: `src/server.ts`
- Test: `src/server.test.ts`

- [ ] **Step 1: Write the failing test `src/server.test.ts`**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/server.test.ts`
Expected: FAIL — `server.js` not found.

- [ ] **Step 3: Create `src/server.ts`**

```ts
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
      description: "Return Phase 1 spec #n with its hostile review and reading-order neighbors.",
      inputSchema: { n: z.number().int().positive() },
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
  const phase1Specs = state.docs.filter(
    (d) => d.section === "phase1" && d.type === "md" && !d.path.toLowerCase().includes("hostile review"),
  );
  for (const d of phase1Specs) {
    const slug = (d.path.split("/").pop() ?? d.path)
      .replace(/\.md$/i, "")
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/server.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck the whole project**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/server.ts src/server.test.ts
git commit -m "feat: register MCP tools and Phase 1 resources on the server"
```

---

## Task 13: stdio entrypoint + end-to-end smoke test

**Files:**
- Create: `src/stdio.ts`
- Test: `src/stdio.test.ts`

- [ ] **Step 1: Create `src/stdio.ts`**

```ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { loadCorpus } from "./core/state.js";
import { INDEX_PATH } from "./core/paths.js";

const state = loadCorpus(INDEX_PATH);
const server = createServer(state);
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Zenon docs MCP (stdio) ready.");
```

- [ ] **Step 2: Write the failing test `src/stdio.test.ts`**

```ts
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
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/stdio.test.ts`
Expected: PASS. (First run is slow — it spawns `tsx`.) If it times out, raise `testTimeout` in `vitest.config.ts`.

- [ ] **Step 4: Rebuild the full index (PDFs included) so dev runs have complete data**

Run: `npm run build-index`
Expected: "Wrote N docs (M PDFs) …" (the test overwrote it with markdown-only).

- [ ] **Step 5: Commit**

```bash
git add src/stdio.ts src/stdio.test.ts
git commit -m "feat: add stdio entrypoint with end-to-end smoke test"
```

---

## Task 14: HTTP entrypoint + smoke test

**Files:**
- Create: `src/http.ts`
- Test: `src/http.test.ts`

- [ ] **Step 1: Create `src/http.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing test `src/http.test.ts`**

```ts
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
```

- [ ] **Step 3: Run test to verify it passes**

Run: `npx vitest run src/http.test.ts`
Expected: PASS.

- [ ] **Step 4: Manual sanity check (optional)**

Run: `npm run start:http` then in another shell:
`curl -i -X POST http://127.0.0.1:3000/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"c","version":"0"}}}'`
Expected: HTTP 200. Stop the server with Ctrl-C.

- [ ] **Step 5: Commit**

```bash
git add src/http.ts src/http.test.ts
git commit -m "feat: add streamable-HTTP entrypoint with smoke test"
```

---

## Task 15: Full test pass, docs, and client config

**Files:**
- Modify: `CLAUDE.md` (add Commands + server architecture)
- Create: `README.md`
- Create: `.mcp.json` (local stdio client config example)

- [ ] **Step 1: Run the entire suite**

Run: `npm test`
Expected: all test files PASS.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Create `.mcp.json` (Claude Code / local stdio client config)**

```json
{
  "mcpServers": {
    "zenon-docs": {
      "command": "npx",
      "args": ["tsx", "src/stdio.ts"]
    }
  }
}
```

- [ ] **Step 4: Create `README.md`**

```markdown
# tminusz-mcp

MCP server exposing the `zenon-developer-commons` documentation corpus as searchable,
full-document context for AI agents implementing Zenon Phase 1.

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
```

- [ ] **Step 5: Update `CLAUDE.md` — add a Commands section after the intro**

Add this section immediately after the "## What this repository is" section:

```markdown
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
```

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md README.md .mcp.json
git commit -m "docs: add README, commands, server architecture, and client config"
```

---

## Self-review notes (verified against the spec)

- **Retrieval = full-doc + nav + keyword search** → Tasks 7–10 (MiniSearch, `read_doc` returns whole body, `list_docs`/`search_docs`).
- **TypeScript/Node + MCP SDK** → Tasks 1, 12–14.
- **PDFs extracted at build time** → Tasks 6, 11 (`collectDocs(root, true)` in `main`).
- **Both stdio and HTTP, shared core** → Tasks 13–14 share `createServer(state)` and one loaded `CorpusState`.
- **MiniSearch** → Task 7.
- **All five tools + Phase 1 resources** → Tasks 9, 10, 12.
- **Error handling (unknown path/section/spec-number; missing index)** → Tasks 8, 9, 10 return structured `ERROR:` strings / fail-fast load.
- **Paging guard for oversized PDFs** → `splitIntoParts` + `read_doc part` (Task 9).
- **Tests: core units + MCP smoke** → every core task has unit tests; Tasks 13–14 are transport smoke tests.

Type/name consistency checked: `CorpusState`, `IndexedDoc`, `buildState`, `saveCorpus`/`loadCorpus`,
`searchState`, `splitIntoParts`, `SECTIONS`, `createServer(state)`, `createHttpApp(state)` are used
identically across all tasks.
```
