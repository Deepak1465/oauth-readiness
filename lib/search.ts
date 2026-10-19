// Web search is a bonus, not a dependency. Gemini's built-in search grounding isn't available on the free
// tier for new keys (verified 2026-10-19), and keyless search pages rate-limit quickly. So the agent finds
// sources three ways (lib/agent.ts): the model names likely official doc URLs, code crawls the provider's
// site from them, and search results are added when a search backend answers.
//   - TAVILY_API_KEY set: Tavily's search API (free tier, needs sign-up)
//   - otherwise: DuckDuckGo's HTML page, best effort, stopping at the first sign of a block

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export interface SearchHit {
  url: string;
  title: string;
}

class Blocked extends Error {}

async function tavily(query: string, key: string): Promise<SearchHit[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, max_results: 6 }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Blocked(`Tavily ${res.status}`);
  const data = (await res.json()) as { results?: { url: string; title: string }[] };
  return (data.results ?? []).map((r) => ({ url: r.url, title: r.title }));
}

async function duckduckgo(query: string): Promise<SearchHit[]> {
  const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": UA, accept: "text/html" },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status !== 200) throw new Blocked(`DuckDuckGo ${res.status}`); // 202 = bot challenge
  const html = await res.text();
  const hits: SearchHit[] = [];
  for (const m of html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
    const raw = m[1]!.replace(/&amp;/g, "&");
    const target = raw.includes("uddg=") ? decodeURIComponent(raw.split("uddg=")[1]!.split("&")[0]!) : raw;
    if (!target.startsWith("http") || target.includes("duckduckgo.com/y.js")) continue; // skip ads
    hits.push({ url: target, title: m[2]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim() });
  }
  if (!hits.length && /anomaly|captcha/i.test(html)) throw new Blocked("DuckDuckGo challenge");
  return hits;
}

export function queriesFor(app: string): string[] {
  return [
    `${app} API OAuth app review verification production access`,
    `${app} developer app review how long waiting approval`,
    `${app} API partner program OR quota extension OR app verification requirements`,
  ];
}

export async function searchAll(app: string): Promise<{ hits: SearchHit[]; backend: string; searches: number }> {
  const key = process.env.TAVILY_API_KEY;
  const backend = key ? "Tavily" : "DuckDuckGo";
  const seen = new Set<string>();
  const hits: SearchHit[] = [];
  let searches = 0;
  for (const q of queriesFor(app)) {
    try {
      const results = key ? await tavily(q, key) : await duckduckgo(q);
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
    if (!key) await new Promise((r) => setTimeout(r, 1200));
  }
  return { hits, backend, searches };
}
