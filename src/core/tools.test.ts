import { describe, it, expect } from "vitest";
import { buildState } from "./state.js";
import { listDocs, searchDocs, readDoc, splitIntoParts, getPhase1Spec, getReadingGuide } from "./tools.js";
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
