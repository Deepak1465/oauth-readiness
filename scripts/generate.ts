// Runs the live agent from the command line: npx tsx --env-file=.env.local scripts/generate.ts "Spotify"
// Writes data/generated/<slug>.json and prints the events and verdict.
import { generateGuide } from "../lib/agent";
import { saveGuide } from "../lib/store";
import { verdictFor } from "../lib/verdict";

const query = process.argv.slice(2).join(" ");
if (!query) {
  console.error('Usage: npx tsx --env-file=.env.local scripts/generate.ts "<app name or url>"');
  process.exit(1);
}
const t0 = Date.now();
const guide = await generateGuide(query, (e) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s]`, JSON.stringify(e)));
await saveGuide(guide);
const v = verdictFor(guide);
console.log(`\n${guide.name}: tier ${v.tier} (${v.tierName}), confidence ${v.confidence}, reasons ${v.reasons.join(",") || "none"}, unknown ${v.unknownGates.join(",") || "none"}`);
console.log(`sources ${guide.sources.length}, quotes verified ${guide.sources.filter((s) => s.quoteVerified).length}/${guide.sources.filter((s) => s.quote).length}, ${((Date.now() - t0) / 1000).toFixed(0)}s`);
