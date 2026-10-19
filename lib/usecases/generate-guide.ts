import type { Guide } from "../entities/guide";
import { composioStatus } from "../gateways/composio";
import { assertLlmConfigured, generateStructured } from "../gateways/llm";
import { fetchReadable } from "../gateways/web";
import { LlmGuide, toGuide } from "../mappers/llm-to-guide";
import { excerpts, relevance, relevantLinks } from "../mappers/page-to-evidence";
import { searchAll } from "../plugins/search";
import { pool } from "../shared/pool";
import { appTerm, cleanRoot, hostOf, isPlaceholderHost, rootDomain, seedUrl, slugify } from "../shared/url";
import { DISCOVER_PROMPT, Discovery, WRITE_PROMPT } from "./prompts";

// Live guide generation on Gemini's free tier. Two model calls; everything else is code:
//   1. (model) discover: name the provider's official domains and the doc pages likely to cover OAuth approval
//   2. (code)  web search when a backend answers (bonus, see plugins/search)
//   3. (code)  fetch candidates, crawl one hop of relevant links on the provider's own site, rank by relevance
//   4. (model) write: fill the guide schema, quoting only from the passages we fetched
//   5. (code)  verify every quote against its page, set evidence levels from domains, check Composio
// A URL the model suggests is only used if it actually loads. The model never sets evidence levels and never
// picks the difficulty tier (entities/verdict.ts does).

export type AgentEvent =
  | { type: "step"; id: string; label: string; detail?: string }
  | { type: "done"; slug: string }
  | { type: "error"; message: string };

const MAX_SOURCES = 10;

type Page = { title: string; url: string; html: string; text: string; score: number; official: boolean };

type Stats = { thin: number; failed: Set<string> };

async function load(url: string, title: string, officialRoots: Set<string>, stats: Stats): Promise<Page | null> {
  const page = await fetchReadable(url, 10000);
  if (!page) {
    stats.failed.add(url);
    return null;
  }
  const text = excerpts(page.text, 5500);
  if (text.length < 200) {
    stats.thin++; // loaded, but nothing about OAuth, scopes or review on it
    return null;
  }
  const official = officialRoots.has(rootDomain(hostOf(page.finalUrl)));
  const pageTitle = page.text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  return { title: pageTitle || title || hostOf(page.finalUrl), url: page.finalUrl, html: page.text, text, score: relevance(text) + (official ? 8 : 0), official };
}

export async function generateGuide(query: string, emit: (e: AgentEvent) => void): Promise<Guide> {
  assertLlmConfigured();
  const term = appTerm(query);
  const token = slugify(term).split("-")[0] ?? "";
  const busy = (id: string, label: string) => (model: string) => emit({ type: "step", id, label, detail: `${model} is busy, trying another free model` });

  // 1. Discover the provider and where its docs are likely to be.
  const L1 = "Identifying the provider and its developer docs";
  emit({ type: "step", id: "discover", label: L1 });
  const d = await generateStructured(DISCOVER_PROMPT(term), Discovery, busy("discover", L1));
  const seed = seedUrl(query);
  // A typed name the model doesn't know is usually a typo; guessing a different app would be worse than asking.
  // A URL skips this: the site itself is the evidence, even for a provider the model has never heard of.
  if (!seed && !d.recognized) throw new Error(`Couldn't find an app called "${term}". Check the spelling, or enter the app's developer docs URL.`);
  const officialRoots = new Set(
    [...d.officialDomains.map(cleanRoot), cleanRoot(hostOf(d.website.startsWith("http") ? d.website : `https://${d.website}`)), ...(seed ? [rootDomain(hostOf(seed))] : [])].filter((r) => r.includes(".") && !isPlaceholderHost(r)),
  );
  emit({ type: "step", id: "discover", label: L1, detail: `${d.name}, ${d.docUrls.length} candidate doc pages on ${[...officialRoots].join(", ")}` });

  // 2. Search (best effort).
  const L2 = "Searching for developer reports and review times";
  emit({ type: "step", id: "search", label: L2 });
  const found = await searchAll(d.name || term);
  emit({ type: "step", id: "search", label: L2, detail: found.searches ? `${found.searches} ${found.backend} searches, ${found.hits.length} results` : `${found.backend} unavailable right now, relying on the provider's docs` });

  // 3. Fetch candidates, then follow relevant links on the provider's site one hop.
  const L3 = "Reading the provider's docs and following relevant links";
  emit({ type: "step", id: "fetch", label: L3 });
  // The URL the user typed comes first: it's the one source we know is right.
  const candidates = [...(seed ? [{ url: seed, title: "" }] : []), ...d.docUrls.slice(0, 10).map((url) => ({ url, title: "" })), ...found.hits.slice(0, 12)]
    .filter((c) => /^https?:\/\//.test(c.url) && !isPlaceholderHost(hostOf(c.url)))
    .filter((c, i, all) => all.findIndex((x) => x.url === c.url) === i);
  const stats: Stats = { thin: 0, failed: new Set() };
  const first = (await pool(candidates, 6, (c) => load(c.url, c.title, officialRoots, stats))).filter((p): p is Page => !!p);
  // The user named this site; if it doesn't load, guessed pages elsewhere would describe something else.
  if (seed && stats.failed.has(seed)) throw new Error(`Couldn't load ${seed}. Check that the address is right and publicly reachable.`);
  const seen = new Set([...candidates.map((c) => c.url), ...first.map((p) => p.url)]);
  const nextHops = first
    .filter((p) => p.official)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .flatMap((p) => relevantLinks(p.html, p.url, rootDomain(hostOf(p.url)), 6))
    .filter((u) => !seen.has(u) && (seen.add(u), true))
    .slice(0, 14);
  const second = (await pool(nextHops, 6, (u) => load(u, "", officialRoots, stats))).filter((p): p is Page => !!p);
  const byUrl = new Map([...first, ...second].map((p) => [p.url, p]));
  const pages = [...byUrl.values()].sort((a, b) => b.score - a.score);
  // Keep the strongest pages, but always leave room for a couple of non-official reports (real wait times live there).
  const officialPages = pages.filter((p) => p.official).slice(0, MAX_SOURCES - 2);
  const fetched = [...officialPages, ...pages.filter((p) => !p.official).slice(0, MAX_SOURCES - officialPages.length)];
  if (!fetched.length) {
    const name = d.name || term;
    if (stats.thin) throw new Error(`Found ${name}'s website, but no public developer docs about OAuth apps, scopes or app review. API access may be by request only, so check with ${name} directly.`);
    if (seed) throw new Error(`Couldn't load ${seed}. Check that the address is right and publicly reachable.`);
    throw new Error(`Couldn't find developer documentation for "${term}". Check the spelling, or enter the app's developer docs URL.`);
  }
  const misses = candidates.length - first.length;
  emit({ type: "step", id: "fetch", label: L3, detail: `${fetched.length} relevant pages kept (${officialPages.length} official), ${second.length} found by following links, ${misses} suggested URLs didn't load` });

  // 4. Write the guide from the passages.
  const L4 = "Writing the guide from the evidence";
  emit({ type: "step", id: "write", label: L4 });
  const g = await generateStructured(WRITE_PROMPT(d.name || term, fetched), LlmGuide, busy("write", L4));

  // 5. Code-side checks: quotes, evidence levels, Composio status. The tier is computed when the guide is shown.
  const L5 = "Checking every quote against its page";
  emit({ type: "step", id: "verify", label: L5 });
  if (token.length >= 3) for (const p of fetched) if (rootDomain(hostOf(p.url)).includes(token)) officialRoots.add(rootDomain(hostOf(p.url)));
  // No steps means the pages didn't describe an OAuth app process at all.
  if (!g.steps.length) throw new Error(`The pages found for "${d.name || term}" don't describe how to set up or get approval for an OAuth app, so there isn't enough to write a guide. Try the app's developer docs URL.`);
  const guide = toGuide(g, {
    slug: slugify(term), // from the request, so a repeat request for the same app hits the cache
    fallbackName: term,
    pages: fetched,
    officialRoots: [...officialRoots],
    composio: composioStatus(g.name, term),
  });
  const quoted = guide.sources.filter((s) => s.quote);
  emit({ type: "step", id: "verify", label: L5, detail: `${quoted.filter((s) => s.quoteVerified).length} of ${quoted.length} quotes found word for word` });

  emit({ type: "step", id: "verdict", label: "Computing difficulty from the facts" });
  return guide;
}
