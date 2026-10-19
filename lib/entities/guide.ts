import { z } from "zod";
import { EvidenceLevel } from "./evidence";

// One shared contract for library guides (researched offline), live guides (Gemini) and the UI.
// The LLM never picks the tier: it records gate facts, and lib/verdict.ts computes the tier from them.

export const Source = z.object({
  id: z.string(), // "s1", "s2", ...
  url: z.string(),
  title: z.string(),
  level: EvidenceLevel, // set by code from the domain (official vs secondary vs community), or "tested"
  quote: z.string().optional(), // verbatim text that backs the claims citing this source
  quoteVerified: z.boolean().nullable().default(null), // null = not checked yet
  checkedAt: z.string(), // ISO date
});
export type Source = z.infer<typeof Source>;

const Cites = z.array(z.string()).default([]); // source ids

// A gate fact: true/false, or null when we searched and could not tell.
export const Fact = z.object({
  value: z.boolean().nullable(),
  note: z.string().default(""),
  sourceIds: Cites,
});
export type Fact = z.infer<typeof Fact>;

export const Facts = z.object({
  selfServeCredentials: Fact, // client id/secret without talking to anyone
  devModeLimits: Fact, // user cap, token expiry, "unverified app" screen until a light review
  reviewRequired: Fact, // provider review before users outside your team can connect
  securityAssessment: Fact, // third-party assessment, e.g. Google CASA
  businessVerification: Fact, // legal entity / business verification
  fees: Fact, // mandatory fees
  gated: Fact, // partner program, paid API tier, or sales-only access
});
export type Facts = z.infer<typeof Facts>;

export const Range = z.object({ min: z.number().nonnegative(), max: z.number().nonnegative().nullable() });

export const Step = z.object({
  title: z.string(),
  owner: z.enum(["agent", "you"]), // can an agent do this, or must a human
  kind: z.enum(["work", "wait"]),
  detail: z.string(),
  sourceIds: Cites,
});

export const Cited = z.object({ text: z.string(), sourceIds: Cites });

export const Observation = z.object({
  step: z.string(),
  docsSaid: z.string(),
  weSaw: z.string(),
  matched: z.boolean(),
});

export const Guide = z.object({
  slug: z.string(),
  name: z.string(),
  website: z.string(),
  devPortalUrl: z.string().nullable(),
  generatedAt: z.string(),
  method: z.enum(["library", "live"]), // library = researched offline by Claude Code agents; live = Gemini on request
  composio: z.object({ managed: z.boolean().nullable(), toolkits: z.array(z.string()).default([]) }),
  summary: z.string(), // two sentences, plain language
  scenario: z.string(), // what the verdict assumes, e.g. "Public app reading users' Gmail"
  facts: Facts,
  effort: z.object({
    handsOnHours: Range,
    waitDays: Range.nullable(), // null = unknown
    recurring: z.array(Cited).default([]),
    sourceIds: Cites,
  }),
  biggestBlocker: Cited.nullable(),
  variants: z.array(z.object({ label: z.string(), text: z.string() })).default([]), // e.g. "Sign-in only scopes"
  steps: z.array(Step).min(1),
  requirements: z.array(Cited).default([]),
  gotchas: z.array(Cited).default([]),
  stuck: z.array(z.object({ problem: z.string(), fix: z.string(), sourceIds: Cites })).default([]),
  tested: z
    .object({ date: z.string(), summary: z.string(), minutes: z.number().nullable(), observations: z.array(Observation) })
    .nullable()
    .default(null),
  unknowns: z.array(z.string()).default([]),
  sources: z.array(Source).min(1),
});
export type Guide = z.infer<typeof Guide>;
