import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Guide } from "../entities/guide";
import { parseGuide } from "../plugins/storage/types";

// Library guides: researched offline, committed to the repo in data/guides.
const LIBRARY_DIR = join(process.cwd(), "data", "guides");

export function libraryGuides(): Guide[] {
  if (!existsSync(LIBRARY_DIR)) return [];
  return readdirSync(LIBRARY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parseGuide(readFileSync(join(LIBRARY_DIR, f), "utf8")))
    .filter((g): g is Guide => !!g);
}
