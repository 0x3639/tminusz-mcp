import type { CorpusState, IndexedDoc } from "./types.js";
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

export function isPhase1Spec(doc: IndexedDoc): boolean {
  const file = (doc.path.split("/").pop() ?? "").toLowerCase();
  return (
    doc.section === "phase1" &&
    doc.type === "md" &&
    !isHostileReview(doc.path) &&
    file !== "readme.md"
  );
}

export function getPhase1Spec(state: CorpusState, selector: number | string): string {
  const specs = state.docs.filter(isPhase1Spec);
  if (specs.length === 0) return "ERROR: no Phase 1 specs found in the corpus.";

  const numbered = specs
    .filter((d) => phase1Number(d.path) !== null)
    .sort((a, b) => phase1Number(a.path)! - phase1Number(b.path)!);
  const namedTitles = specs
    .filter((d) => phase1Number(d.path) === null)
    .map((d) => d.title);

  let spec: IndexedDoc | undefined;

  if (typeof selector === "number") {
    spec = numbered.find((s) => phase1Number(s.path) === selector);
    if (!spec) {
      const min = numbered.length ? Math.min(...numbered.map((s) => phase1Number(s.path)!)) : 0;
      const max = numbered.length ? Math.max(...numbered.map((s) => phase1Number(s.path)!)) : 0;
      const named = namedTitles.length ? ` Named specs: ${namedTitles.join(", ")}.` : "";
      return `ERROR: no Phase 1 spec #${selector}. Valid range: ${min}–${max}.${named}`;
    }
  } else {
    const tokens = selector.toLowerCase().split(/\s+/).filter(Boolean);
    spec = specs.find((s) =>
      tokens.every(
        (t) => s.path.toLowerCase().includes(t) || s.title.toLowerCase().includes(t),
      ),
    );
    if (!spec) {
      const named = namedTitles.length ? namedTitles.join(", ") : "(none)";
      return `ERROR: no Phase 1 spec matching "${selector}". Named specs: ${named}.`;
    }
  }

  const num = phase1Number(spec.path);
  let review: IndexedDoc | undefined;
  if (num !== null) {
    review = state.docs.find(
      (d) => d.section === "phase1" && isHostileReview(d.path) && phase1Number(d.path) === num,
    );
  } else {
    const stem = (spec.path.split("/").pop() ?? "")
      .toLowerCase()
      .replace(/\.md$/, "")
      .replace(/\bspec\b/g, "")
      .split(/[-_\s]+/)
      .filter(Boolean);
    review = state.docs.find(
      (d) =>
        d.section === "phase1" &&
        isHostileReview(d.path) &&
        stem.every((t) => d.path.toLowerCase().includes(t)),
    );
  }

  let nav: string;
  if (num !== null) {
    const idx = numbered.indexOf(spec);
    const prev = numbered[idx - 1];
    const next = numbered[idx + 1];
    nav =
      (prev ? `Previous: #${phase1Number(prev.path)} ${prev.title}` : "Previous: (none)") +
      " | " +
      (next ? `Next: #${phase1Number(next.path)} ${next.title}` : "Next: (none)");
  } else {
    nav = "(named spec — not in the numbered 1–11 sequence)";
  }

  const heading =
    num !== null ? `# Phase 1 — Spec #${num}: ${spec.title}` : `# Phase 1 — ${spec.title}`;

  return [
    heading,
    nav,
    `\n## Specification (${spec.path})\n\n${spec.body}`,
    review
      ? `\n## Hostile Review (${review.path})\n\n${review.body}`
      : `\n## Hostile Review\n\n(none found)`,
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
    'Dynamic Plasma is also a Phase 1 spec — retrieve it by name: get_phase1_spec("Dynamic Plasma").',
    "",
    "For each spec: read the spec, then its hostile review, then resolve open assumptions before proceeding.",
  ].join("\n");
}
