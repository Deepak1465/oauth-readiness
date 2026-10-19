import { describe, expect, it } from "vitest";
import { computeTier, type GateFacts } from "./rubric";

const open: GateFacts = {
  selfServeCredentials: true,
  devModeLimits: false,
  reviewRequired: false,
  securityAssessment: false,
  businessVerification: false,
  fees: false,
  gated: false,
};

describe("computeTier", () => {
  it("tier 1 when nothing gates the path", () => {
    expect(computeTier(open)).toEqual({ tier: 1, reasons: [] });
  });

  it("tier 2 for dev-mode limits only", () => {
    expect(computeTier({ ...open, devModeLimits: true }).tier).toBe(2);
  });

  it("tier 3 when review is required, regardless of dev-mode limits", () => {
    expect(computeTier({ ...open, devModeLimits: true, reviewRequired: true })).toEqual({ tier: 3, reasons: ["reviewRequired"] });
  });

  it("tier 4 lists every external requirement as a reason", () => {
    const r = computeTier({ ...open, reviewRequired: true, securityAssessment: true, fees: true });
    expect(r).toEqual({ tier: 4, reasons: ["securityAssessment", "fees"] });
  });

  it("tier 5 when gated, even with other gates", () => {
    expect(computeTier({ ...open, gated: true, securityAssessment: true })).toEqual({ tier: 5, reasons: ["gated"] });
  });

  it("tier 5 when credentials are not self-serve", () => {
    expect(computeTier({ ...open, selfServeCredentials: false })).toEqual({ tier: 5, reasons: ["selfServeCredentials"] });
  });
});
