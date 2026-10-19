import { SearchBlocked, type SearchPlugin } from "./types";

// Tavily's search API: free tier, needs TAVILY_API_KEY.
export function tavily(key: string): SearchPlugin {
  return {
    name: "Tavily",
    delayMs: 0,
    async search(query) {
      const res = await fetch("https://api.tavily.com/search", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ query, max_results: 6 }),
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) throw new SearchBlocked(`Tavily ${res.status}`);
      const data = (await res.json()) as { results?: { url: string; title: string }[] };
      return (data.results ?? []).map((r) => ({ url: r.url, title: r.title }));
    },
  };
}
