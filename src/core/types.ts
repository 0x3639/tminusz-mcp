import type MiniSearch from "minisearch";

export type DocType = "md" | "pdf";

export type Section =
  | "architecture"
  | "notes"
  | "research"
  | "specs"
  | "phase1"
  | "essays"
  | "papers";

export interface DocEntry {
  path: string; // relative to corpus root, forward slashes
  section: Section;
  type: DocType;
  title: string;
}

export interface IndexedDoc extends DocEntry {
  body: string;
}

export interface CorpusState {
  docs: IndexedDoc[];
  byPath: Map<string, IndexedDoc>;
  search: MiniSearch<IndexedDoc>;
}

export interface Hit {
  path: string;
  title: string;
  section: string;
  score: number;
  snippet: string;
}
