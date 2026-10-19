import type { Guide } from "@/lib/entities/guide";
import { verdictFor } from "@/lib/entities/verdict";

// Log-scale ruler from 10 minutes to 6 months. Hands-on work is a solid bar; the approval wait follows it,
// solid up to the minimum and hatched across the uncertain part of the range.

const MIN_H = 1 / 6;
const MAX_H = 24 * 180;
const TICKS: [number, string][] = [
  [1 / 6, "10 min"],
  [1, "1 hour"],
  [8, "1 workday"],
  [24 * 7, "1 week"],
  [24 * 30, "1 month"],
  [24 * 180, "6 months"],
];

export function pos(hours: number): number {
  const h = Math.min(Math.max(hours, MIN_H), MAX_H);
  return (Math.log(h / MIN_H) / Math.log(MAX_H / MIN_H)) * 100;
}

// Rough end-to-end hours for placing an app on the shared ruler. Unknown or open-ended waits sit at the far end.
export function totalHours(g: Guide): { low: number; high: number; open: boolean } {
  const work = g.effort.handsOnHours;
  const wait = g.effort.waitDays;
  const low = work.min + (wait ? wait.min * 24 : 0);
  const open = !wait || wait.max === null;
  const high = (work.max ?? work.min) + (wait ? (wait.max ?? 180) * 24 : 24 * 180);
  return { low: Math.max(low, MIN_H), high, open };
}

function Axis({ y }: { y: number }) {
  return (
    <g>
      <line x1="0%" x2="100%" y1={y} y2={y} stroke="var(--rule)" />
      {TICKS.map(([h, label], i) => (
        <g key={label} className={label === "1 hour" || label === "1 month" ? "tick-minor" : undefined}>
          <line x1={`${pos(h)}%`} x2={`${pos(h)}%`} y1={y - 4} y2={y + 4} stroke="var(--ink-3)" />
          <text
            x={`${pos(h)}%`}
            y={y + 20}
            fontSize="12"
            fill="var(--ink-3)"
            textAnchor={i === 0 ? "start" : i === TICKS.length - 1 ? "end" : "middle"}
          >
            {label}
          </text>
        </g>
      ))}
    </g>
  );
}

export function GuideRuler({ guide }: { guide: Guide }) {
  const work = guide.effort.handsOnHours;
  const wait = guide.effort.waitDays;
  const workEnd = work.max ?? work.min;
  const waitMinEnd = workEnd + (wait ? wait.min * 24 : 0);
  const waitMaxEnd = wait ? workEnd + (wait.max ?? 180) * 24 : MAX_H;
  const label = `Hands-on work up to ${workEnd} hours, then ${wait ? (wait.max === null ? `${wait.min}+ days` : `${wait.min} to ${wait.max} days`) : "an unknown"} wait.`;
  return (
    <svg width="100%" height="64" role="img" aria-label={label} style={{ overflow: "visible", display: "block" }}>
      <defs>
        <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="6" height="6" fill="var(--surface)" />
          <line x1="0" y1="0" x2="0" y2="6" stroke="var(--wait)" strokeWidth="3" />
        </pattern>
      </defs>
      <rect x="0" y="8" width={`${pos(workEnd)}%`} height="14" rx="2" fill="var(--work)" />
      {wait && waitMinEnd > workEnd && (
        <rect x={`${pos(workEnd)}%`} y="8" width={`${pos(waitMinEnd) - pos(workEnd)}%`} height="14" fill="var(--wait)" />
      )}
      <rect
        x={`${pos(waitMinEnd)}%`}
        y="8"
        width={`${Math.max(pos(waitMaxEnd) - pos(waitMinEnd), 0)}%`}
        height="14"
        fill="url(#hatch)"
        stroke="var(--wait)"
        strokeWidth="1"
        opacity={wait ? 1 : 0.5}
      />
      <Axis y={36} />
    </svg>
  );
}

export function LibraryRuler({ guides }: { guides: Guide[] }) {
  const rows = guides
    .map((g) => ({ g, t: totalHours(g) }))
    .sort((a, b) => a.t.low - b.t.low);
  const rowH = 30;
  const top = 8;
  const axisY = top + rows.length * rowH + 8;
  return (
    <svg
      width="100%"
      height={axisY + 28}
      role="img"
      aria-label={`Time to production for ${rows.length} apps, from ${rows[0]?.g.name ?? ""} (fastest) to ${rows.at(-1)?.g.name ?? ""} (slowest).`}
      style={{ overflow: "visible", display: "block" }}
    >
      {rows.map(({ g, t }, i) => {
        const y = top + i * rowH;
        const x1 = pos(t.low);
        const x2 = pos(t.high);
        const tier = verdictTierClass(g);
        return (
          <a key={g.slug} href={`/guide/${g.slug}`} className={tier} aria-label={`${g.name} guide`}>
            <line x1={`${x1}%`} x2={`${Math.max(x2, x1 + 0.6)}%`} y1={y + 10} y2={y + 10} stroke="var(--tier)" strokeWidth="6" strokeLinecap="round" opacity="0.9" />
            {t.open && <line x1={`${x2}%`} x2="100%" y1={y + 10} y2={y + 10} stroke="var(--tier)" strokeWidth="2" strokeDasharray="3 4" />}
            <text x={x1 > 50 ? `${x1 - 1}%` : `${Math.max(x2, x1 + 0.6) + 1}%`} y={y + 14} fontSize="14" fontWeight="600" fill="var(--ink)" textAnchor={x1 > 50 ? "end" : "start"}>
              {g.name}
            </text>
          </a>
        );
      })}
      <Axis y={axisY} />
    </svg>
  );
}

function verdictTierClass(g: Guide): string {
  const v = verdictFor(g);
  return v.rated ? `tier-${v.tier}` : "tier-unrated";
}
