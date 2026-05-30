import { readdirSync, statSync } from "node:fs";
import path from "node:path";
import matter from "gray-matter";
import type { DocEntry, DocType, Section } from "./types.js";

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

export function walkCorpus(root: string): DocEntry[] {
  const out: DocEntry[] = [];

  function recurse(dir: string): void {
    for (const name of readdirSync(dir)) {
      if (name === ".git") continue;
      const abs = path.join(dir, name);
      if (statSync(abs).isDirectory()) {
        recurse(abs);
        continue;
      }
      const ext = path.extname(name).toLowerCase();
      const type: DocType | null = ext === ".md" ? "md" : ext === ".pdf" ? "pdf" : null;
      if (!type) continue;
      const rel = path.relative(root, abs).replace(/\\/g, "/");
      out.push({
        path: rel,
        section: classifySection(rel),
        type,
        title: titleFromFilename(rel),
      });
    }
  }

  recurse(root);
  return out.sort((a, b) => a.path.localeCompare(b.path));
}
