import type { Guide } from "../entities/guide";
import { fetchPage, fetchReadable, looksEmpty } from "../gateways/web";
import { quoteAppears } from "../shared/quote";

// Deterministic citation check: fetch the cited page and confirm the quoted text is really on it.
// Catches invented or paraphrased quotes, which LLMs produce often. Free, no model involved.
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

// Every source id the guide cites somewhere; each must exist in guide.sources.
export function citedIds(g: Guide): string[] {
  return [
    ...Object.values(g.facts).flatMap((f) => f.sourceIds),
    ...g.effort.sourceIds,
    ...g.effort.recurring.flatMap((r) => r.sourceIds),
    ...(g.biggestBlocker?.sourceIds ?? []),
    ...g.steps.flatMap((s) => s.sourceIds),
    ...g.requirements.flatMap((r) => r.sourceIds),
    ...g.gotchas.flatMap((r) => r.sourceIds),
    ...g.stuck.flatMap((r) => r.sourceIds),
  ];
}

export function missingSources(g: Guide): string[] {
  const ids = new Set(g.sources.map((s) => s.id));
  return [...new Set(citedIds(g).filter((id) => !ids.has(id)))];
}

// Re-checks every quote (except hands-on "tested" sources) and records the result on the guide.
export async function verifyQuotes(g: Guide): Promise<void> {
  for (const s of g.sources) {
    if (s.level === "tested") continue;
    s.quoteVerified = await checkQuote(s.url, s.quote);
  }
}
