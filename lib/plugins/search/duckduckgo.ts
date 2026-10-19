import { SearchBlocked, type SearchHit, type SearchPlugin } from "./types";

// DuckDuckGo's HTML page: no key, best effort. It shows a bot challenge after a few queries,
// and blocks most cloud servers outright.

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36";

export const duckduckgo: SearchPlugin = {
  name: "DuckDuckGo",
  delayMs: 1200,
  async search(query) {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { "user-agent": UA, accept: "text/html" },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status !== 200) throw new SearchBlocked(`DuckDuckGo ${res.status}`); // 202 = bot challenge
    const html = await res.text();
    const hits: SearchHit[] = [];
    for (const m of html.matchAll(/class="result__a" href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)) {
      const raw = m[1]!.replace(/&amp;/g, "&");
      const target = raw.includes("uddg=") ? decodeURIComponent(raw.split("uddg=")[1]!.split("&")[0]!) : raw;
      if (!target.startsWith("http") || target.includes("duckduckgo.com/y.js")) continue; // skip ads
      hits.push({ url: target, title: m[2]!.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#x27;/g, "'").trim() });
    }
    if (!hits.length && /anomaly|captcha/i.test(html)) throw new SearchBlocked("DuckDuckGo challenge");
    return hits;
  },
};
