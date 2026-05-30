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
