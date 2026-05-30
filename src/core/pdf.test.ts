import { describe, it, expect } from "vitest";
import path from "node:path";
import { extractPdfText } from "./pdf.js";
import { CORPUS_ROOT } from "./paths.js";

describe("extractPdfText (real corpus)", () => {
  it("extracts non-trivial text from a corpus PDF", async () => {
    const pdf = path.join(
      CORPUS_ROOT,
      "docs/research/bounded_inclusion_without_merkle_final.pdf"
    );
    const text = await extractPdfText(pdf);
    expect(text.length).toBeGreaterThan(100);
  });
});
