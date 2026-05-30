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
