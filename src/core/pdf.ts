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
