import type { CorpusState } from "./types.js";
import { searchState } from "./state.js";

export const SECTIONS = [
  "architecture",
  "notes",
  "research",
  "specs",
  "phase1",
  "essays",
  "papers",
] as const;

const PART_SIZE = 50000;

export function splitIntoParts(content: string, size = PART_SIZE): string[] {
  if (content.length <= size) return [content];
  const parts: string[] = [];
  for (let i = 0; i < content.length; i += size) parts.push(content.slice(i, i + size));
  return parts;
}

export function listDocs(state: CorpusState, section?: string): string {
  if (section && !SECTIONS.includes(section as (typeof SECTIONS)[number])) {
    return `ERROR: unknown section "${section}". Valid: ${SECTIONS.join(", ")}`;
  }
  const docs = state.docs.filter((d) => !section || d.section === section);
  const lines = docs.map((d) => `- [${d.section}] ${d.path} — ${d.title} (${d.type})`);
  return `${docs.length} document(s)${section ? ` in "${section}"` : ""}:\n${lines.join("\n")}`;
}

export function searchDocs(
  state: CorpusState,
  query: string,
  section?: string,
  limit = 10,
): string {
  if (!query.trim()) return "ERROR: query is empty";
  if (section && !SECTIONS.includes(section as (typeof SECTIONS)[number])) {
    return `ERROR: unknown section "${section}". Valid: ${SECTIONS.join(", ")}`;
  }
  const hits = searchState(state, query, { section, limit });
  if (hits.length === 0) {
    return `No matches for "${query}"${section ? ` in "${section}"` : ""}.`;
  }
  return hits
    .map((h, i) => `${i + 1}. ${h.path} — ${h.title} [${h.section}]\n   ${h.snippet}`)
    .join("\n\n");
}

export function readDoc(state: CorpusState, docPath: string, part = 1): string {
  const doc = state.byPath.get(docPath);
  if (!doc) {
    const base = docPath.split("/").pop() ?? docPath;
    const near = state.docs
      .filter((d) => d.path.includes(base))
      .slice(0, 5)
      .map((d) => d.path);
    return `ERROR: no document at "${docPath}".${
      near.length ? ` Did you mean:\n${near.join("\n")}` : " Use list_docs to browse."
    }`;
  }
  const parts = splitIntoParts(doc.body);
  const p = Math.min(Math.max(1, Math.floor(part)), parts.length);
  const header = `# ${doc.title}\nPath: ${doc.path} | Section: ${doc.section} | Part ${p}/${parts.length}\n\n`;
  return header + parts[p - 1];
}
