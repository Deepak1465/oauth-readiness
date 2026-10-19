import type { Guide } from "@/lib/entities/guide";
import type { GateName } from "@/lib/entities/rubric";
import { formatRange, GATE_LABELS, verdictFor } from "@/lib/entities/verdict";
import { Cite } from "./Cite";
import { GuideRuler } from "./TimeRuler";

const CONFIDENCE_TEXT = {
  high: "High: the gates that set this tier are backed by the provider's own docs or our own test.",
  medium: "Medium: the deciding facts rest on secondary sources such as integration platforms.",
  low: "Low: some facts are unknown or rest on forum reports. Verify before you plan around this.",
};

function GateRow({ name, guide }: { name: GateName; guide: Guide }) {
  const f = guide.facts[name];
  // For self-serve credentials "yes" is good news; for every other gate "yes" is a hurdle.
  const good = name === "selfServeCredentials" ? f.value === true : f.value === false;
  const mark = f.value === null ? "?" : good ? "No hurdle" : "Hurdle";
  const color = f.value === null ? "var(--unknown)" : good ? "var(--ok)" : "var(--bad)";
  const answer = f.value === null ? "Unknown" : f.value ? "Yes" : "No";
  return (
    <tr style={{ borderTop: "1px solid var(--rule)" }}>
      <th scope="row" style={{ textAlign: "left", fontWeight: 600, padding: "10px 12px 10px 0", verticalAlign: "top", whiteSpace: "nowrap" }}>
        {GATE_LABELS[name]}
      </th>
      <td style={{ padding: "10px 12px 10px 0", verticalAlign: "top", color, fontWeight: 600, whiteSpace: "nowrap" }}>
        <span aria-label={mark}>{answer}</span>
      </td>
      <td style={{ padding: "10px 0", verticalAlign: "top" }} className="muted">
        {f.note}
        <Cite ids={f.sourceIds} guide={guide} />
      </td>
    </tr>
  );
}

export function VerdictPanel({ guide }: { guide: Guide }) {
  const v = verdictFor(guide);
  const gates = Object.keys(guide.facts) as GateName[];
  return (
    <section
      className={v.rated ? `tier-${v.tier}` : "tier-unrated"}
      aria-labelledby="verdict-heading"
      style={{ background: "var(--surface)", border: "1px solid var(--rule)", borderTop: "4px solid var(--tier)", borderRadius: 10, padding: "24px clamp(16px, 3vw, 28px)", marginTop: 28 }}
    >
      <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 40px", alignItems: "baseline" }}>
        <h2 id="verdict-heading" style={{ margin: 0, fontSize: "clamp(28px, 4.5vw, 40px)", fontWeight: 700, color: v.rated ? "var(--tier)" : "var(--unknown)", lineHeight: 1.1 }}>
          {v.rated ? `Tier ${v.tier}: ${v.tierName}` : v.tierName}
        </h2>
        <dl style={{ display: "flex", gap: "8px 32px", flexWrap: "wrap", margin: 0 }}>
          <div>
            <dt className="faint" style={{ fontSize: 14 }}>Hands-on work</dt>
            <dd style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{formatRange(guide.effort.handsOnHours, "hour")}</dd>
          </div>
          <div>
            <dt className="faint" style={{ fontSize: 14 }}>Waiting for approval</dt>
            <dd style={{ margin: 0, fontSize: 20, fontWeight: 600 }}>{formatRange(guide.effort.waitDays, "day")}</dd>
          </div>
          <div>
            <dt className="faint" style={{ fontSize: 14 }}>Confidence</dt>
            <dd style={{ margin: 0, fontSize: 20, fontWeight: 600, textTransform: "capitalize" }}>{v.confidence}</dd>
          </div>
        </dl>
      </div>
      <p className="faint prose" style={{ margin: "10px 0 0", fontSize: 14 }}>
        Assumes: {guide.scenario}
      </p>
      {!v.rated && (
        <p className="prose" style={{ margin: "14px 0 0" }}>
          The agent couldn&rsquo;t establish {v.unknownGates.length} of the 7 facts that set difficulty, so it won&rsquo;t guess a tier. Known hurdles put it at tier {v.tier} or
          higher. Check the provider&rsquo;s developer docs directly, or regenerate later.
        </p>
      )}

      <div style={{ marginTop: 20 }}>
        <GuideRuler guide={guide} />
        <p className="faint" style={{ fontSize: 13, margin: "4px 0 0" }}>
          Solid dark bar: your hands-on work. Amber: the minimum wait. Hatched: the range sources disagree on, or an open-ended wait.
          <Cite ids={guide.effort.sourceIds} guide={guide} />
        </p>
      </div>

      {guide.biggestBlocker && (
        <p style={{ margin: "20px 0 0", fontSize: 18 }} className="prose">
          <strong>Biggest blocker:</strong> {guide.biggestBlocker.text}
          <Cite ids={guide.biggestBlocker.sourceIds} guide={guide} />
        </p>
      )}

      {guide.effort.recurring.length > 0 && (
        <p style={{ margin: "12px 0 0" }} className="prose muted">
          <strong style={{ color: "var(--ink)" }}>Recurring:</strong>{" "}
          {guide.effort.recurring.map((r, i) => (
            <span key={i}>
              {r.text}
              <Cite ids={r.sourceIds} guide={guide} />{" "}
            </span>
          ))}
        </p>
      )}

      <details style={{ marginTop: 20 }}>
        <summary style={{ cursor: "pointer", fontWeight: 600 }}>
          {v.rated ? `Why tier ${v.tier}?` : "What we know so far."} {v.reasons.length ? `Set by: ${v.reasons.map((r) => GATE_LABELS[r].toLowerCase()).join(", ")}.` : "Nothing gates this path."}
          {v.unknownGates.length > 0 && ` ${v.unknownGates.length} fact${v.unknownGates.length > 1 ? "s" : ""} unknown, so the tier could be higher.`}
        </summary>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 15 }}>
          <caption className="faint" style={{ textAlign: "left", fontSize: 13, paddingBottom: 6 }}>
            The tier is computed from these seven facts by a fixed rule, not chosen by the AI. {CONFIDENCE_TEXT[v.confidence]}
          </caption>
          <tbody>
            {gates.map((g) => (
              <GateRow key={g} name={g} guide={guide} />
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
