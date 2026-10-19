import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Guide } from "../../entities/guide";
import { parseGuide, type StoragePlugin } from "./types";

// JSON files in a folder: for local development and tests.
export function fileStorage(dir: string): StoragePlugin {
  const all = () =>
    existsSync(dir)
      ? readdirSync(dir)
          .filter((f) => f.endsWith(".json"))
          .map((f) => parseGuide(readFileSync(join(dir, f), "utf8")))
          .filter((g): g is Guide => !!g)
      : [];
  return {
    name: "files",
    async get(slug) {
      const file = join(dir, `${slug}.json`);
      return existsSync(file) ? parseGuide(readFileSync(file, "utf8")) : null;
    },
    async save(g) {
      mkdirSync(dir, { recursive: true });
      writeFileSync(join(dir, `${g.slug}.json`), JSON.stringify(g, null, 2));
    },
    async recent(limit) {
      return all()
        .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
        .slice(0, limit);
    },
  };
}
