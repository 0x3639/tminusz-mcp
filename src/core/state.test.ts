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
