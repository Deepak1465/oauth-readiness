// Validates data/guides/*.json: schema, every cited source id exists, and runs the quote check
// (writing quoteVerified back into the file). Usage: npx tsx scripts/validate-guides.ts [slug...]
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Guide } from "../lib/entities/guide";
import { verdictFor } from "../lib/entities/verdict";
import { missingSources, verifyQuotes } from "../lib/usecases/validate-guide";

const dir = join(import.meta.dirname, "..", "data", "guides");
const only = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith(".json") && (!only.length || only.includes(f.replace(".json", ""))));
let failed = 0;

for (const file of files) {
  const path = join(dir, file);
  const parsed = Guide.safeParse(JSON.parse(readFileSync(path, "utf8")));
  if (!parsed.success) {
    failed++;
    console.log(`FAIL ${file}\n${parsed.error.message}`);
    continue;
  }
  const g = parsed.data;
  const missing = missingSources(g);
  await verifyQuotes(g);
  writeFileSync(path, JSON.stringify(g, null, 2) + "\n");

  const v = verdictFor(g);
  const q = g.sources.filter((s) => s.quote);
  const ok = q.filter((s) => s.quoteVerified === true).length;
  const bad = q.filter((s) => s.quoteVerified === false).map((s) => s.id);
  const unreachable = q.filter((s) => s.quoteVerified === null).map((s) => s.id);
  if (missing.length) failed++;
  console.log(
    `${missing.length ? "FAIL" : "ok  "} ${file}  tier ${v.tier} (${v.tierName}), confidence ${v.confidence}` +
      `\n     quotes verified ${ok}/${q.length}` +
      (bad.length ? `  not found: ${bad.join(",")}` : "") +
      (unreachable.length ? `  unreachable: ${unreachable.join(",")}` : "") +
      (missing.length ? `\n     cited but missing sources: ${missing.join(",")}` : ""),
  );
}
console.log(`\n${files.length - failed}/${files.length} guides valid`);
process.exit(failed ? 1 : 0);
