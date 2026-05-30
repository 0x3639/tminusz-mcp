import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url)); // .../src/core
export const PROJECT_ROOT = path.resolve(here, "..", "..");
export const CORPUS_ROOT = path.join(PROJECT_ROOT, "zenon-developer-commons");
export const INDEX_PATH = path.join(PROJECT_ROOT, "data", "index.json");
