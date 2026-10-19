// Ground truth for the fake providers in testbed/server.mjs. The docs were written to produce exactly these answers.
// null means "the docs don't say", so either unknown or a reasoned answer is acceptable.

export interface Expected {
  query: string;
  slug: string;
  rated: boolean;
  tier: number | null;
  facts: Partial<Record<"selfServeCredentials" | "devModeLimits" | "reviewRequired" | "securityAssessment" | "businessVerification" | "fees" | "gated", boolean | null>>;
  waitDaysWithin?: [number, number]; // the guide's wait range must overlap this
}

export const EXPECTED: Record<string, Expected> = {
  acme: {
    query: "http://acme.localtest.me:4010/docs",
    slug: "acme",
    rated: true,
    tier: 3,
    facts: { selfServeCredentials: true, devModeLimits: true, reviewRequired: true, securityAssessment: false, businessVerification: false, fees: false, gated: false },
    waitDaysWithin: [5, 14], // "5 to 10 business days"
  },
  vault: {
    query: "http://vault.localtest.me:4010/developers",
    slug: "vault",
    rated: true,
    tier: 5,
    facts: { selfServeCredentials: false, gated: true, fees: true, businessVerification: true },
  },
  mystery: {
    query: "http://mystery.localtest.me:4010/developers",
    slug: "mystery",
    rated: false,
    tier: null,
    facts: {},
  },
};
