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
