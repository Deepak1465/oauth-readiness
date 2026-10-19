import { z } from "zod";
import { Guide, type Source } from "../entities/guide";
import { quoteAppears } from "../shared/quote";
import { classify } from "./page-to-evidence";

// What the model returns when writing a guide. Kept flat and default-free: Gemini's JSON-schema subset is strict.
// The model cites sources by index into the list of pages we fetched; it never supplies URLs or evidence levels.
const cites = z.array(z.number().int()).describe("indexes into the SOURCES list, e.g. [0, 2]");
const fact = z.object({ value: z.enum(["yes", "no", "unknown"]), note: z.string(), sources: cites });
const range = z.object({ min: z.number(), max: z.number().nullable().describe("null when open-ended") });

export const LlmGuide = z.object({
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
export type LlmGuide = z.infer<typeof LlmGuide>;

export interface FetchedPage {
  title: string;
  url: string;
  html: string;
}

export interface GuideContext {
  slug: string;
  fallbackName: string;
  pages: FetchedPage[]; // the SOURCES list the model saw, in order
  officialRoots: string[];
  composio: Guide["composio"];
}

// Maps model output to a Guide: source indexes become ids, yes/no/unknown become true/false/null, every quote is
// checked against its page, and only sources that are cited or quoted are kept.
export function toGuide(g: LlmGuide, ctx: GuideContext): Guide {
  const today = new Date().toISOString().slice(0, 10);
  const used = new Set<number>();
  const mark = (ids: number[]) => [...new Set(ids)].filter((i) => i >= 0 && i < ctx.pages.length).map((i) => (used.add(i), `s${i + 1}`));
  const factOut = (f: LlmGuide["facts"]["gated"]) => ({ value: f.value === "unknown" ? null : f.value === "yes", note: f.note, sourceIds: mark(f.sources) });
  const facts = Object.fromEntries(Object.entries(g.facts).map(([k, f]) => [k, factOut(f)])) as Guide["facts"];
  const cited = (xs: { text: string; sources: number[] }[]) => xs.map((x) => ({ text: x.text, sourceIds: mark(x.sources) }));

  const assembled = {
    facts,
    steps: g.steps.map((s) => ({ title: s.title, owner: s.owner, kind: s.kind, detail: s.detail, sourceIds: mark(s.sources) })),
    effort: { handsOnHours: g.handsOnHours, waitDays: g.waitDays, recurring: cited(g.recurring), sourceIds: mark(g.effortSources) },
    biggestBlocker: g.biggestBlocker ? { text: g.biggestBlocker.text, sourceIds: mark(g.biggestBlocker.sources) } : null,
    requirements: cited(g.requirements),
    gotchas: cited(g.gotchas),
    stuck: g.stuck.map((s) => ({ problem: s.problem, fix: s.fix, sourceIds: mark(s.sources) })),
  };

  const quoteFor = new Map<number, string>();
  for (const q of g.quotes) if (!quoteFor.has(q.source)) quoteFor.set(q.source, q.quote);
  const sources: Source[] = ctx.pages
    .map((p, i) => {
      const quote = quoteFor.get(i);
      return { id: `s${i + 1}`, url: p.url, title: p.title, level: classify(p.url, ctx.officialRoots), quote, quoteVerified: quote ? quoteAppears(quote, p.html) : null, checkedAt: today };
    })
    .filter((_, i) => used.has(i) || quoteFor.has(i));
  const first = ctx.pages[0]!;

  return Guide.parse({
    slug: ctx.slug,
    name: g.name || ctx.fallbackName,
    website: g.website,
    devPortalUrl: g.devPortalUrl,
    generatedAt: new Date().toISOString(),
    method: "live",
    composio: ctx.composio,
    summary: g.summary,
    scenario: g.scenario,
    variants: g.variants,
    tested: null,
    unknowns: g.unknowns,
    sources: sources.length ? sources : [{ id: "s1", url: first.url, title: first.title, level: classify(first.url, ctx.officialRoots), quoteVerified: null, checkedAt: today }],
    ...assembled,
  });
}
