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
