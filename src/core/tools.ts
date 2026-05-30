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

function phase1Number(p: string): number | null {
  const file = p.split("/").pop() ?? "";
  const m = file.match(/^(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function isHostileReview(p: string): boolean {
  return p.toLowerCase().includes("hostile review");
}

export function getPhase1Spec(state: CorpusState, n: number): string {
  const specs = state.docs
    .filter(
      (d) =>
        d.section === "phase1" &&
        d.type === "md" &&
        !isHostileReview(d.path) &&
        phase1Number(d.path) !== null,
    )
    .sort((a, b) => phase1Number(a.path)! - phase1Number(b.path)!);

  if (specs.length === 0) return "ERROR: no Phase 1 specs found in the corpus.";

  const numbers = specs.map((s) => phase1Number(s.path)!);
  const min = Math.min(...numbers);
  const max = Math.max(...numbers);
  const spec = specs.find((s) => phase1Number(s.path) === n);
  if (!spec) return `ERROR: no Phase 1 spec #${n}. Valid range: ${min}–${max}.`;

  const review = state.docs.find(
    (d) => d.section === "phase1" && isHostileReview(d.path) && phase1Number(d.path) === n,
  );
  const idx = specs.indexOf(spec);
  const prev = specs[idx - 1];
  const next = specs[idx + 1];
  const nav =
    (prev ? `Previous: #${phase1Number(prev.path)} ${prev.title}` : "Previous: (none)") +
    " | " +
    (next ? `Next: #${phase1Number(next.path)} ${next.title}` : "Next: (none)");

  return [
    `# Phase 1 — Spec #${n}: ${spec.title}`,
    nav,
    `\n## Specification (${spec.path})\n\n${spec.body}`,
    review
      ? `\n## Hostile Review (${review.path})\n\n${review.body}`
      : `\n## Hostile Review\n\n(none found for spec #${n})`,
  ].join("\n");
}

export function getReadingGuide(): string {
  return [
    "# Zenon Developer Commons — Reading Guide",
    "",
    "## Required first",
    "Read docs/architecture/bounded-verification-boundries.md before relying on any model.",
    "",
    "## Paper series order",
    "GREENPAPER → PURPLEPAPER → INDIGOPAPER → ORANGEPAPER",
    "",
    "## Phase 1 implementation order (use get_phase1_spec(n))",
    "1. libp2p Host",
    "2. Peer Service Discovery",
    "3. Peer Reachability Verification",
    "4. Peer Service Scoring",
    "5. libp2p Sync Protocol",
    "6. Sync Candidate Selection",
    "7. Sync Request Scheduling",
    "8. Initial Sync Strategy",
    "9. libp2p Gossip Protocol",
    "10. Current P2P Coexistence and Migration",
    "11. Implementation Readiness Checklist",
    "",
    "For each spec: read the spec, then its hostile review, then resolve open assumptions before proceeding.",
  ].join("\n");
}
