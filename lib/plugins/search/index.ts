import { duckduckgo } from "./duckduckgo";
import { tavily } from "./tavily";
import type { SearchHit, SearchPlugin } from "./types";

// Web search is a bonus, not a dependency: Gemini's search grounding isn't on the free tier for new keys
// (verified 2026-10-19) and keyless search rate-limits quickly. The agent mainly crawls the provider's own docs.
// Backend: Tavily when TAVILY_API_KEY is set, otherwise DuckDuckGo.

export type { SearchHit } from "./types";

export function searchPlugin(): SearchPlugin {
  const key = process.env.TAVILY_API_KEY;
  return key ? tavily(key) : duckduckgo;
}

export function queriesFor(app: string): string[] {
  return [
    `${app} API OAuth app review verification production access`,
    `${app} developer app review how long waiting approval`,
    `${app} API partner program OR quota extension OR app verification requirements`,
  ];
}

export async function searchAll(app: string, plugin = searchPlugin()): Promise<{ hits: SearchHit[]; backend: string; searches: number }> {
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  let searches = 0;
  for (const q of queriesFor(app)) {
    try {
      const results = await plugin.search(q);
      searches++;
      for (const h of results.slice(0, 6)) {
        const k = h.url.replace(/[#?].*$/, "").replace(/\/$/, "");
        if (!seen.has(k)) {
          seen.add(k);
          hits.push(h);
        }
      }
    } catch {
      break; // blocked or down: stop searching, the other discovery paths still work
    }
    if (plugin.delayMs) await new Promise((r) => setTimeout(r, plugin.delayMs));
  }
  return { hits, backend: plugin.name, searches };
}
