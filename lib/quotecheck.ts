// Deterministic citation check: fetch the cited page and confirm the quoted text is really on it.
// Catches invented or paraphrased quotes, which LLMs produce often. Free, no model involved.

const UA = "Mozilla/5.0 (compatible; oauth-readiness/1.0; +quote-check)";

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

export async function fetchPage(url: string, timeoutMs = 12000): Promise<{ finalUrl: string; text: string } | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return { finalUrl: res.url || url, text: await res.text() };
  } catch {
    return null;
  }
}

// Many developer portals render their docs with JavaScript, so a plain fetch returns an empty shell.
// For those, fall back to Jina's free reader (r.jina.ai), which renders the page and returns Markdown.
// We turn that back into minimal HTML so excerpting, link-following and the quote check work unchanged.
function looksEmpty(html: string): boolean {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return text.length < 1500;
}

function markdownToHtml(md: string): string {
  const body = md.split(/\n?Markdown Content:\n/)[1] ?? md;
  // Pull links out first so stripping Markdown punctuation can't mangle URLs or the generated tags.
  const links: string[] = [];
  const text = body
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, t: string, u: string) => `\u0000${links.push(`<a href="${u}">${t.replace(/[*_`]/g, "")}</a>`) - 1}\u0000`)
    .replace(/^\s*>\s?/gm, "")
    .replace(/[*`#]+|\b_+|_+\b/g, "")
    .replace(/\|/g, " ");
  return text
    .split(/\n+/)
    .map((line) => `<p>${line.trim().replace(/\u0000(\d+)\u0000/g, (_, i) => links[Number(i)]!)}</p>`)
    .join("\n");
}

export async function fetchReadable(url: string, timeoutMs = 12000): Promise<{ finalUrl: string; text: string; rendered: boolean } | null> {
  const direct = await fetchPage(url, timeoutMs);
  if (direct && !looksEmpty(direct.text)) return { ...direct, rendered: false };
  const reader = await fetchPage(`https://r.jina.ai/${direct?.finalUrl ?? url}`, timeoutMs + 8000);
  if (!reader || reader.text.length < 300) return direct ? { ...direct, rendered: false } : null;
  return { finalUrl: direct?.finalUrl ?? url, text: markdownToHtml(reader.text), rendered: true };
}

// Returns true/false when the page was fetched, null when it could not be (blocked, timeout).
export async function checkQuote(url: string, quote: string | undefined): Promise<boolean | null> {
  if (!quote) return null;
  const page = await fetchPage(url);
  if (page && quoteAppears(quote, page.text)) return true;
  if (page && !looksEmpty(page.text)) return false;
  const rendered = await fetchReadable(url);
  if (!rendered) return null;
  return quoteAppears(quote, rendered.text);
}
