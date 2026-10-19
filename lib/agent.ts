import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { composioLookup } from "./composio";
import { Guide, type Source } from "./guide";
import { quoteAppears, fetchReadable } from "./quotecheck";
import { searchAll } from "./search";
import { classify, excerpts, hostOf, relevance, relevantLinks, rootDomain } from "./sources";

// Live guide generation on Gemini's free tier. Two model calls; everything else is code:
//   1. (model) discover: name the provider's official domains and the doc pages likely to cover OAuth approval
//   2. (code)  web search when a backend answers (bonus, see lib/search.ts)
//   3. (code)  fetch candidates, crawl one hop of relevant links on the provider's own site, rank by relevance
//   4. (model) write: fill the guide schema, quoting only from the passages we fetched
//   5. (code)  verify every quote against its page, set evidence levels from domains, check Composio
// A URL the model suggests is only used if it actually loads. The model never sets evidence levels and never
// picks the difficulty tier (lib/verdict.ts does).

export type AgentEvent =
  | { type: "step"; id: string; label: string; detail?: string }
  | { type: "done"; slug: string }
  | { type: "error"; message: string };

// Free-tier models available to new keys (checked 2026-10-19). If one is overloaded we try the next.
const MODELS = process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ["gemini-3.6-flash", "gemini-3.8-flash", "gemini-3.5-flash-lite"];
const MAX_SOURCES = 10;

const Discovery = z.object({
  name: z.string().describe("the provider's official product name"),
  website: z.string(),
  officialDomains: z.array(z.string()).describe("root domains the provider owns, e.g. example.com, examplecdn.com"),
  docUrls: z
    .array(z.string())
    .describe("up to 10 full URLs of the provider's official pages on: registering an OAuth app, OAuth scopes/permissions, app review or verification, going to production or publishing, rate limits, developer terms or policies"),
});

const DISCOVER_PROMPT = (q: string) => `A developer wants to register their own OAuth app with "${q}" so their users can connect ${q} accounts to an AI agent product. Identify the provider and list the official documentation URLs most likely to describe: creating an OAuth app or client credentials; OAuth scopes and permissions; app review, verification or approval for public use; moving from development/test mode to production; partner programs or access tiers; rate limits; developer policies. Give real, specific URLs you are confident exist on the provider's own domains. Do not invent paths.`;

export function slugify(s: string): string {
  return s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.[a-z.]+(\/.*)?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

// "hubspot.com" -> "hubspot", "Google Drive" -> "google drive"
function appTerm(q: string): string {
  return /^(https?:\/\/)?[\w-]+(\.[\w-]+)+(\/.*)?$/.test(q) ? hostOf(q.startsWith("http") ? q : `https://${q}`).split(".").slice(-2, -1)[0] ?? q : q;
}

// What the model returns. Kept flat and default-free: Gemini's JSON-schema subset is strict.
const cites = z.array(z.number().int()).describe("indexes into the SOURCES list, e.g. [0, 2]");
const fact = z.object({ value: z.enum(["yes", "no", "unknown"]), note: z.string(), sources: cites });
const range = z.object({ min: z.number(), max: z.number().nullable().describe("null when open-ended") });
const LlmGuide = z.object({
  name: z.string().describe("the provider's official product name"),
  website: z.string(),
  devPortalUrl: z.string().nullable(),
  summary: z.string().describe("two plain sentences"),
  scenario: z.string().describe("the case the verdict assumes, naming typical scopes"),
  facts: z.object({
    selfServeCredentials: fact,
    devModeLimits: fact,
    reviewRequired: fact,
    securityAssessment: fact,
    businessVerification: fact,
    fees: fact,
    gated: fact,
  }),
  handsOnHours: range,
  waitDays: range.nullable(),
  effortSources: cites,
  recurring: z.array(z.object({ text: z.string(), sources: cites })),
  biggestBlocker: z.object({ text: z.string(), sources: cites }).nullable(),
  variants: z.array(z.object({ label: z.string(), text: z.string() })),
  steps: z.array(z.object({ title: z.string(), owner: z.enum(["agent", "you"]), kind: z.enum(["work", "wait"]), detail: z.string(), sources: cites })),
  requirements: z.array(z.object({ text: z.string(), sources: cites })),
  gotchas: z.array(z.object({ text: z.string(), sources: cites })),
  stuck: z.array(z.object({ problem: z.string(), fix: z.string(), sources: cites })),
  quotes: z.array(z.object({ source: z.number().int(), quote: z.string().describe("copied character-for-character from that source's passages") })),
  unknowns: z.array(z.string()),
});
type LlmGuide = z.infer<typeof LlmGuide>;

const ALLOWED = new Set(["type", "format", "title", "description", "enum", "items", "minItems", "maxItems", "minimum", "maximum", "anyOf", "properties", "additionalProperties", "required", "$defs", "$ref"]);
function geminiSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(geminiSchema);
  if (!node || typeof node !== "object") return node;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(node)) {
    if (k === "properties" || k === "$defs") out[k] = Object.fromEntries(Object.entries(v as object).map(([p, s]) => [p, geminiSchema(s)]));
    else if (ALLOWED.has(k)) out[k] = geminiSchema(v);
  }
  return out;
}

const PROMPT = (q: string, sources: { title: string; url: string; text: string }[]) => `You write OAuth readiness guides. A developer building an AI agent product wants their external users to connect their "${q}" accounts through the developer's OWN OAuth app. Using ONLY the sources below, explain how hard it is to get that OAuth app ready and approved, how long it takes, what could block it, and which steps an agent can do. Today is ${new Date().toISOString().slice(0, 10)}.

Rules:
- Default scenario: a public app that any external user can connect, requesting the scopes an AI agent typically needs to read and act on the user's data. Other meaningful cases (sign-in only, internal-only, restricted APIs) go in "variants".
- facts describe the DEFAULT scenario only. A hurdle that applies only to a special API, partner product or add-on belongs in "variants", not in facts. Limits on unreviewed or uncertified apps (connection or user caps, token lifetimes) count as devModeLimits.
- facts: "yes"/"no" only when the sources support it; otherwise "unknown". If official sources describe the full path to production and a hurdle never appears in it, you may answer "no" with the note starting "Not mentioned in the official process:" and cite those sources. reviewRequired = review before users outside the developer's own team can connect. devModeLimits = user caps, short token lifetimes, or warning screens until a review. gated = partner program, paid API tier, sales-only or waitlist.
- handsOnHours = active work; waitDays = calendar wait for approval (null if the sources don't say). Widen ranges when sources disagree. Never invent numbers; if you estimate, say so in unknowns.
- steps: ordered. owner "agent" only if an AI agent with a browser or API could do it without the human's identity or legal authority (drafting text, filling technical fields, checking requirements). Creating accounts, accepting terms, identity/business verification, payment, recording a demo, 2FA are "you". Approval waits are kind "wait".
- Cite sources by index. Do not cite a source for something it doesn't say.
- quotes: for each source you cite, give one short quote (one or two sentences) COPIED EXACTLY from that source's passages. Choose the sentence that backs the most important claim you cite it for (a fact that sets difficulty, the wait, or the biggest blocker), not a generic introduction. Never paraphrase inside a quote.
- If the sources don't cover something, put it in "unknowns". Saying unknown is better than guessing.

SOURCES (index, title, url, then passages fetched from that page):
${sources.map((s, i) => `[${i}] ${s.title} — ${s.url}\n${s.text}`).join("\n\n")}`;

// Calls the first free model that answers, parsing against the schema; one retry with the error on bad JSON.
async function callModel<T>(ai: GoogleGenAI, contents: string, schema: z.ZodType<T>, onBusy: (model: string) => void): Promise<T> {
  let last: unknown;
  for (const model of MODELS) {
    let feedback = "";
    for (let attempt = 0; attempt < 2; attempt++) {
      let text: string;
      try {
        const res = await ai.models.generateContent({
          model,
          contents: contents + feedback,
          config: { responseMimeType: "application/json", responseJsonSchema: geminiSchema(z.toJSONSchema(schema)), temperature: 0.1 },
        });
        text = res.text ?? "";
      } catch (e) {
        last = e;
        const msg = e instanceof Error ? e.message : String(e);
        if (!/503|429|404|UNAVAILABLE|RESOURCE_EXHAUSTED|NOT_FOUND|overloaded|high demand/i.test(msg)) throw e;
        onBusy(model);
        break; // try the next model
      }
      try {
        return schema.parse(JSON.parse(text));
      } catch (e) {
        last = e;
        feedback = `\n\nYour previous output was invalid: ${(e instanceof Error ? e.message : "parse error").slice(0, 400)}. Return valid JSON.`;
      }
    }
  }
  throw last instanceof Error ? last : new Error("The model could not produce a valid answer.");
}

function cleanRoot(d: string): string {
  return rootDomain(d.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""));
}

type Page = { title: string; url: string; html: string; text: string; score: number; official: boolean };

// Run async work with a concurrency cap: the free reader service rate-limits bursts.
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i]!);
      }
    }),
  );
  return out;
}

async function load(url: string, title: string, officialRoots: Set<string>): Promise<Page | null> {
  const page = await fetchReadable(url, 10000);
  if (!page) return null;
  const text = excerpts(page.text, 5500);
  if (text.length < 200) return null; // JS-only shells and empty pages are useless as evidence
  const official = officialRoots.has(rootDomain(hostOf(page.finalUrl)));
  const pageTitle = page.text.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  return { title: pageTitle || title || hostOf(page.finalUrl), url: page.finalUrl, html: page.text, text, score: relevance(text) + (official ? 8 : 0), official };
}

export async function generateGuide(query: string, emit: (e: AgentEvent) => void): Promise<Guide> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set. Add it to .env.local.");
  const ai = new GoogleGenAI({ apiKey });
  const term = appTerm(query);
  const token = slugify(term).split("-")[0] ?? "";
  const busy = (id: string, label: string) => (model: string) => emit({ type: "step", id, label, detail: `${model} is busy, trying another free model` });

  // 1. Discover the provider and where its docs are likely to be.
  const L1 = "Identifying the provider and its developer docs";
  emit({ type: "step", id: "discover", label: L1 });
  const d = await callModel(ai, DISCOVER_PROMPT(term), Discovery, busy("discover", L1));
  const officialRoots = new Set([...d.officialDomains.map(cleanRoot), cleanRoot(hostOf(d.website.startsWith("http") ? d.website : `https://${d.website}`))].filter((r) => r.includes(".")));
  emit({ type: "step", id: "discover", label: L1, detail: `${d.name}, ${d.docUrls.length} candidate doc pages on ${[...officialRoots].join(", ")}` });

  // 2. Search (best effort).
  const L2 = "Searching for developer reports and review times";
  emit({ type: "step", id: "search", label: L2 });
  const found = await searchAll(d.name || term);
  emit({ type: "step", id: "search", label: L2, detail: found.searches ? `${found.searches} ${found.backend} searches, ${found.hits.length} results` : `${found.backend} unavailable right now, relying on the provider's docs` });

  // 3. Fetch candidates, then follow relevant links on the provider's site one hop.
  const L3 = "Reading the provider's docs and following relevant links";
  emit({ type: "step", id: "fetch", label: L3 });
  const candidates = [...d.docUrls.slice(0, 10).map((url) => ({ url, title: "" })), ...found.hits.slice(0, 12)].filter((c) => /^https?:\/\//.test(c.url));
  const first = (await pool(candidates, 6, (c) => load(c.url, c.title, officialRoots))).filter((p): p is Page => !!p);
  const seen = new Set([...candidates.map((c) => c.url), ...first.map((p) => p.url)]);
  const nextHops = first
    .filter((p) => p.official)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .flatMap((p) => relevantLinks(p.html, p.url, rootDomain(hostOf(p.url)), 6))
    .filter((u) => !seen.has(u) && (seen.add(u), true))
    .slice(0, 14);
  const second = (await pool(nextHops, 6, (u) => load(u, "", officialRoots))).filter((p): p is Page => !!p);
  const byUrl = new Map([...first, ...second].map((p) => [p.url, p]));
  const pages = [...byUrl.values()].sort((a, b) => b.score - a.score);
  // Keep the strongest pages, but always leave room for a couple of non-official reports (real wait times live there).
  const officialPages = pages.filter((p) => p.official).slice(0, MAX_SOURCES - 2);
  const fetched = [...officialPages, ...pages.filter((p) => !p.official).slice(0, MAX_SOURCES - officialPages.length)];
  if (!fetched.length) throw new Error(`Couldn't read any documentation for "${term}". Check the spelling, or enter the app's website.`);
  const misses = candidates.length - first.length;
  emit({ type: "step", id: "fetch", label: L3, detail: `${fetched.length} relevant pages kept (${officialPages.length} official), ${second.length} found by following links, ${misses} suggested URLs didn't load` });

  // 4. Write the guide from the passages.
  const L4 = "Writing the guide from the evidence";
  emit({ type: "step", id: "write", label: L4 });
  const g = await callModel(ai, PROMPT(d.name || term, fetched), LlmGuide, busy("write", L4));

  // 5. Code-side checks.
  emit({ type: "step", id: "verify", label: "Checking every quote against its page" });
  const today = new Date().toISOString().slice(0, 10);
  if (token.length >= 3) for (const p of fetched) if (rootDomain(hostOf(p.url)).includes(token)) officialRoots.add(rootDomain(hostOf(p.url)));

  const used = new Set<number>();
  const mark = (ids: number[]) => [...new Set(ids)].filter((i) => i >= 0 && i < fetched.length).map((i) => (used.add(i), `s${i + 1}`));
  const factOut = (f: LlmGuide["facts"]["gated"]) => ({ value: f.value === "unknown" ? null : f.value === "yes", note: f.note, sourceIds: mark(f.sources) });
  const facts = Object.fromEntries(Object.entries(g.facts).map(([k, f]) => [k, factOut(f)])) as Guide["facts"];
  const cited = (xs: { text: string; sources: number[] }[]) => xs.map((x) => ({ text: x.text, sourceIds: mark(x.sources) }));

  const quoteFor = new Map<number, string>();
  for (const q of g.quotes) if (!quoteFor.has(q.source)) quoteFor.set(q.source, q.quote);
  const assembled = {
    facts,
    steps: g.steps.map((s) => ({ title: s.title, owner: s.owner, kind: s.kind, detail: s.detail, sourceIds: mark(s.sources) })),
    effort: { handsOnHours: g.handsOnHours, waitDays: g.waitDays, recurring: cited(g.recurring), sourceIds: mark(g.effortSources) },
    biggestBlocker: g.biggestBlocker ? { text: g.biggestBlocker.text, sourceIds: mark(g.biggestBlocker.sources) } : null,
    requirements: cited(g.requirements),
    gotchas: cited(g.gotchas),
    stuck: g.stuck.map((s) => ({ problem: s.problem, fix: s.fix, sourceIds: mark(s.sources) })),
  };
  const sources: Source[] = fetched
    .map((s, i) => {
      const quote = quoteFor.get(i);
      return {
        id: `s${i + 1}`,
        url: s.url,
        title: s.title,
        level: classify(s.url, [...officialRoots]),
        quote,
        quoteVerified: quote ? quoteAppears(quote, s.html) : null,
        checkedAt: today,
      };
    })
    .filter((_, i) => used.has(i) || quoteFor.has(i));
  const quoted = sources.filter((s) => s.quote);
  emit({ type: "step", id: "verify", label: "Checking every quote against its page", detail: `${quoted.filter((s) => s.quoteVerified).length} of ${quoted.length} quotes found word for word` });

  emit({ type: "step", id: "verdict", label: "Computing difficulty from the facts" });
  return Guide.parse({
    slug: slugify(term), // from the request, so a repeat request for the same app hits the cache
    name: g.name || term,
    website: g.website,
    devPortalUrl: g.devPortalUrl,
    generatedAt: new Date().toISOString(),
    method: "live",
    composio: mergeComposio(g.name, term),
    summary: g.summary,
    scenario: g.scenario,
    variants: g.variants,
    tested: null,
    unknowns: g.unknowns,
    sources: sources.length ? sources : [{ id: "s1", url: fetched[0]!.url, title: fetched[0]!.title, level: classify(fetched[0]!.url, [...officialRoots]), quoteVerified: null, checkedAt: today }],
    ...assembled,
  });
}

// "Meta (Facebook & Instagram)" should match Composio's facebook and instagram toolkits, not just "meta".
function mergeComposio(name: string, query: string) {
  const inner = name.match(/\(([^)]*)\)/)?.[1] ?? "";
  const candidates = [name, query, ...inner.split(/&|,|\band\b/)].map((s) => s.trim()).filter(Boolean);
  const results = candidates.map(composioLookup);
  const toolkits = [...new Set(results.flatMap((r) => r.toolkits))];
  const managed = results.some((r) => r.managed === true) ? true : results.some((r) => r.managed === false) ? false : null;
  return { managed, toolkits };
}
