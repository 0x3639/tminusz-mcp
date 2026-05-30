import { describe, it, expect } from "vitest";
import { classifySection } from "./corpus.js";
import { titleFromFilename, titleFromMarkdown } from "./corpus.js";
import { walkCorpus } from "./corpus.js";
import { CORPUS_ROOT } from "./paths.js";

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
