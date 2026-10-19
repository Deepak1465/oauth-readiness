import { z } from "zod";

// Ordered strongest to weakest; confidence is capped by the weakest level behind a tier-deciding claim.
export const EVIDENCE_LEVELS = ["tested", "official", "secondary", "community", "inferred", "unknown"] as const;
export const EvidenceLevel = z.enum(EVIDENCE_LEVELS);
export type EvidenceLevel = z.infer<typeof EvidenceLevel>;

export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export function confidenceFor(level: EvidenceLevel): Confidence {
  switch (level) {
    case "tested":
    case "official":
      return "high";
    case "secondary":
      return "medium";
    default:
      return "low";
  }
}

export function weakest(levels: EvidenceLevel[]): EvidenceLevel {
  if (levels.length === 0) return "unknown";
  return levels.reduce((a, b) => (EVIDENCE_LEVELS.indexOf(a) >= EVIDENCE_LEVELS.indexOf(b) ? a : b));
}
