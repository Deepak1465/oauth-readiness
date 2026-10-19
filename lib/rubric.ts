import { z } from "zod";

// Facts extracted for one path. The tier is computed from these in code, never chosen by an LLM.
export const GateFacts = z.object({
  selfServeCredentials: z.boolean(), // can create client id/secret without talking to anyone
  devModeLimits: z.boolean(), // user cap, token expiry, "unverified app" warning until a light review
  reviewRequired: z.boolean(), // provider review/listing before users outside your team
  securityAssessment: z.boolean(), // third-party assessment (e.g. Google CASA)
  businessVerification: z.boolean(), // legal entity / business verification
  fees: z.boolean(), // mandatory fees to get through review
  gated: z.boolean(), // partner program, paid API tier, or sales-only access
});
export type GateFacts = z.infer<typeof GateFacts>;

export const Tier = z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5)]);
export type Tier = z.infer<typeof Tier>;

export const TIER_NAMES: Record<Tier, string> = {
  1: "Instant",
  2: "Instant, capped",
  3: "Review required",
  4: "Review plus external requirements",
  5: "Gated",
};

export type GateName = keyof GateFacts;

export interface TierResult {
  tier: Tier;
  reasons: GateName[]; // the gates that set this tier, for "Tier 4 because ..."
}

export function computeTier(f: GateFacts): TierResult {
  const hit = (...gates: GateName[]) => gates.filter((g) => f[g]);
  const gated = hit("gated");
  if (gated.length || !f.selfServeCredentials) return { tier: 5, reasons: gated.length ? gated : ["selfServeCredentials"] };
  const external = hit("securityAssessment", "businessVerification", "fees");
  if (external.length) return { tier: 4, reasons: external };
  if (f.reviewRequired) return { tier: 3, reasons: ["reviewRequired"] };
  if (f.devModeLimits) return { tier: 2, reasons: ["devModeLimits"] };
  return { tier: 1, reasons: [] };
}
