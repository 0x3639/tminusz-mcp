import matter from "gray-matter";
import type { Section } from "./types.js";

export function titleFromFilename(relPath: string): string {
  const base = relPath.split("/").pop() ?? relPath;
  return base.replace(/\.(md|pdf)$/i, "").replace(/[-_]+/g, " ").trim();
}

export function titleFromMarkdown(raw: string, fallback: string): string {
  try {
    const parsed = matter(raw);
    if (typeof parsed.data?.title === "string" && parsed.data.title.trim()) {
      return parsed.data.title.trim();
    }
    const m = parsed.content.match(/^\s*#\s+(.+?)\s*$/m);
    if (m) return m[1].trim();
  } catch {
    // malformed frontmatter — fall through to fallback
  }
  return fallback;
}

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
