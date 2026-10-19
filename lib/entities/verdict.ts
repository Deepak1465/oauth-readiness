import { computeTier, TIER_NAMES, type GateFacts, type GateName, type Tier } from "./rubric";
import { confidenceFor, weakest, type Confidence, type EvidenceLevel } from "./evidence";
import type { Guide } from "./guide";

export const GATE_LABELS: Record<GateName, string> = {
  selfServeCredentials: "Self-serve credentials",
  devModeLimits: "Limits until reviewed",
  reviewRequired: "Provider review",
  securityAssessment: "Security assessment",
  businessVerification: "Business verification",
  fees: "Mandatory fees",
  gated: "Partner or paid access",
};

export interface Verdict {
  tier: Tier;
  tierName: string;
  rated: boolean; // false when too little is known to rate honestly; tier is then only a lower bound
  reasons: GateName[];
  unknownGates: GateName[]; // facts we could not establish; the tier could be higher
  confidence: Confidence;
  weakestLevel: EvidenceLevel;
}

// Tier comes from the rubric; unknown gates count as "not hit" but are surfaced and cap confidence at low.
export function verdictFor(g: Guide): Verdict {
  const names = Object.keys(g.facts) as GateName[];
  const facts = Object.fromEntries(
    names.map((n) => [n, n === "selfServeCredentials" ? g.facts[n].value !== false : g.facts[n].value === true]),
  ) as GateFacts;
  const { tier, reasons } = computeTier(facts);
  const unknownGates = names.filter((n) => g.facts[n].value === null);

  // Confidence: the weakest evidence behind any gate that is true (plus self-serve, which every tier rests on).
  const deciding = names.filter((n) => g.facts[n].value === true);
  const byId = new Map(g.sources.map((s) => [s.id, s]));
  const levels = deciding.flatMap((n) => {
    const ids = g.facts[n].sourceIds;
    if (!ids.length) return ["inferred" as EvidenceLevel];
    return [bestLevel(ids.map((id) => byId.get(id)).filter((s) => !!s))];
  });
  const weakestLevel = weakest(levels);
  const confidence: Confidence = unknownGates.length ? "low" : confidenceFor(weakestLevel);

  // Unknown gates count as "not hit", so with many unknowns the tier would look easier than the evidence allows.
  const rated = unknownGates.length < 3 && g.facts.selfServeCredentials.value !== null;
  return { tier, tierName: rated ? TIER_NAMES[tier] : "Not enough evidence to rate", rated, reasons, unknownGates, confidence, weakestLevel };
}

const ORDER: EvidenceLevel[] = ["tested", "official", "secondary", "community", "inferred", "unknown"];

// A fact backed by several sources is as strong as its best one; an unverified quote drops "official" a notch.
function bestLevel(sources: Guide["sources"]): EvidenceLevel {
  if (!sources.length) return "inferred";
  const effective = sources.map((s) => (s.level === "official" && s.quoteVerified === false ? "secondary" : s.level));
  return effective.reduce((a, b) => (ORDER.indexOf(a) <= ORDER.indexOf(b) ? a : b));
}

export function formatRange(r: { min: number; max: number | null } | null, unit: "hour" | "day"): string {
  if (!r) return "Unknown";
  const u = (n: number) => `${unit}${n === 1 ? "" : "s"}`;
  if (unit === "day" && r.min === 0 && r.max === 0) return "None";
  if (r.max === null) return `${r.min}+ ${u(r.min)}`;
  if (r.min === r.max) return `${r.min} ${u(r.min)}`;
  return `${r.min}–${r.max} ${u(r.max)}`;
}
