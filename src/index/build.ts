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
