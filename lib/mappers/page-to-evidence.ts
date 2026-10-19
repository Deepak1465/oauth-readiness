import type { EvidenceLevel } from "../entities/evidence";
import { hostOf, rootDomain } from "../shared/url";

// Turns fetched pages into evidence: readable passages, a relevance score, links worth following,
// and an evidence level decided by code from the URL (never by the model).

const SECONDARY = ["nango.dev", "pipedream.com", "paragon", "nylas.com", "unipile.com", "merge.dev", "composio.dev", "arcade.dev", "auth0.com", "okta.com", "zapier.com", "medium.com", "dev.to"];
const COMMUNITY = ["reddit.com", "stackoverflow.com", "stackexchange.com", "news.ycombinator.com", "github.com/orgs/community", "discuss.", "community.", "forum", "groups.google.com", "quora.com"];

export function classify(url: string, officialRoots: string[]): EvidenceLevel {
  const host = hostOf(url);
  const lower = url.toLowerCase();
  if (COMMUNITY.some((c) => lower.includes(c))) return "community";
  if (officialRoots.includes(rootDomain(host))) return "official";
  if (SECONDARY.some((s) => host.includes(s))) return "secondary";
  return "secondary";
}

// Sentences around OAuth-approval keywords (plus one sentence of context either side) are what the model
// needs to quote, without blowing the free-tier token budget.
export const KEYWORDS = /review|verif|approv|\bfees?\b|scope|oauth|client id|client secret|redirect uri|publish|production|partner|assessment|audit|business|privacy polic|quota|rate limit|test user|sandbox|development mode|live mode|marketplace|submit|extension|access level|permission/i;

export function pageText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<nav[\s\S]*?<\/nav>|<footer[\s\S]*?<\/footer>|<header[\s\S]*?<\/header>|<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<\/(p|li|h\d|div|tr|section|dt|dd)>|<br\s*\/?>/gi, ". ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&quot;|&ldquo;|&rdquo;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .replace(/(\.\s*){2,}/g, ". ");
}

export function excerpts(html: string, maxChars = 6000): string {
  const sentences = pageText(html)
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 25 && s.length < 600);
  const keep = new Set<number>();
  sentences.forEach((s, i) => {
    if (KEYWORDS.test(s)) [i - 1, i, i + 1].forEach((j) => j >= 0 && j < sentences.length && keep.add(j));
  });
  let out = "";
  let prev = -2;
  for (const i of [...keep].sort((a, b) => a - b)) {
    const piece = (i === prev + 1 ? " " : "\n… ") + sentences[i];
    if (out.length + piece.length > maxChars) break;
    out += piece;
    prev = i;
  }
  return out.trim();
}

// How relevant a page is to OAuth approval: keyword density in its passages.
export function relevance(text: string): number {
  return (text.match(new RegExp(KEYWORDS.source, "gi")) ?? []).length;
}

// Links on the same site whose URL or anchor text suggests approval/review content: the crawler's next hops.
const LINK_HINT = /review|verif|approv|scope|oauth|authoriz|quota|production|publish|partner|go.?live|launch|app.?(registration|setup|settings)|permission|access.?level|limits|policy|polic(y|ies)|requirements|distribution|marketplace/i;

export function relevantLinks(html: string, baseUrl: string, root: string, max = 8): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a\s[^>]*href="([^"#]+)[^"]*"[^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string;
    try {
      url = new URL(m[1]!.replace(/&amp;/g, "&"), baseUrl).toString().replace(/#.*$/, "");
    } catch {
      continue;
    }
    if (!url.startsWith("http") || rootDomain(hostOf(url)) !== root || seen.has(url) || url === baseUrl) continue;
    const anchor = m[2]!.replace(/<[^>]+>/g, " ");
    if (!LINK_HINT.test(anchor) && !LINK_HINT.test(new URL(url).pathname)) continue;
    if (/\.(png|jpe?g|svg|pdf|zip)$|\/(login|signin|signup|careers|pricing|blog\/?$)/i.test(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}
