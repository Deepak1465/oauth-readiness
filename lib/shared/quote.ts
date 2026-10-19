// Deterministic citation check: is the quoted text really on the page? Catches invented or paraphrased
// quotes, which LLMs produce often. Pure text matching, no network (see gateways/web.ts for fetching).

export function normalize(s: string): string {
  return s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;| /g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&lsquo;|[‘’]/g, "'")
    .replace(/&ldquo;|&rdquo;|[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?)])/g, "$1") // "development mode ." on some rendered pages
    .toLowerCase()
    .trim();
}

// A quote passes if it appears verbatim after normalizing, or if each of its sentence fragments does
// (models often join two nearby sentences with "..." or drop a clause).
export function quoteAppears(quote: string, pageText: string): boolean {
  const page = normalize(pageText);
  const q = normalize(quote).replace(/^["']|["']$/g, "");
  if (q.length < 12) return false;
  if (page.includes(q)) return true;
  const parts = q.split(/\s*(?:\.\.\.|…)\s*/).filter((p) => p.length >= 12);
  return parts.length > 1 && parts.every((p) => page.includes(p));
}
