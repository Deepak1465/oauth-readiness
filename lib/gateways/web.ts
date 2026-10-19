import { markdownToHtml } from "../mappers/markdown-to-html";

// Fetching pages from the web. Many developer portals render their docs with JavaScript, so a plain fetch
// returns an empty shell; for those we fall back to Jina's free reader (r.jina.ai), which renders the page.

const UA = "Mozilla/5.0 (compatible; oauth-readiness/1.0; +quote-check)";

export async function fetchPage(url: string, timeoutMs = 12000): Promise<{ finalUrl: string; text: string } | null> {
  try {
    const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,*/*" }, redirect: "follow", signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) return null;
    return { finalUrl: res.url || url, text: await res.text() };
  } catch {
    return null;
  }
}

export function looksEmpty(html: string): boolean {
  const text = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  return text.length < 1500;
}

export async function fetchReadable(url: string, timeoutMs = 12000): Promise<{ finalUrl: string; text: string; rendered: boolean } | null> {
  const direct = await fetchPage(url, timeoutMs);
  if (direct && !looksEmpty(direct.text)) return { ...direct, rendered: false };
  const reader = await fetchPage(`https://r.jina.ai/${direct?.finalUrl ?? url}`, timeoutMs + 8000);
  // The reader answers 200 even when the page itself is missing, and says so in a warning line.
  const missing = !!reader && /^Warning: Target URL returned error [45]\d\d/m.test(reader.text);
  if (!reader || missing || reader.text.length < 300) return direct ? { ...direct, rendered: false } : null;
  return { finalUrl: direct?.finalUrl ?? url, text: markdownToHtml(reader.text), rendered: true };
}
