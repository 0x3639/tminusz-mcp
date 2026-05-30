import type { Section } from "./types.js";

export function classifySection(relPath: string): Section {
  const p = relPath.replace(/\\/g, "/");
  if (p.startsWith("docs/specs/phase 1/")) return "phase1";
  if (p.startsWith("docs/architecture/")) return "architecture";
  if (p.startsWith("docs/notes/")) return "notes";
  if (p.startsWith("docs/research/")) return "research";
  if (p.startsWith("docs/specs/")) return "specs";
  if (p.startsWith("essays/")) return "essays";
  return "papers";
}
