import Link from "next/link";
import { GenerateBox } from "@/components/GenerateBox";
import { LibraryRuler } from "@/components/TimeRuler";
import type { Guide } from "@/lib/entities/guide";
import { TIER_NAMES, type Tier } from "@/lib/entities/rubric";
import { libraryGuides, recentLiveGuides } from "@/lib/usecases/guides";
import { formatRange, verdictFor } from "@/lib/entities/verdict";

export const dynamic = "force-dynamic";

const TIER_HELP: Record<Tier, string> = {
  1: "Create credentials and go. No review.",
  2: "Works now, with limits until a light review or re-consent.",
  3: "The provider reviews your app before outside users can connect.",
  4: "Review plus a security assessment, business verification or fees.",
  5: "Partner program, paid tier or sales-only access. The outcome is uncertain.",
};

// One row per app: the facts a developer scans for first, then the blocker in a clamped second line.
function GuideRows({ guides }: { guides: Guide[] }) {
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {guides.map((g) => {
        const v = verdictFor(g);
        return (
          <li key={g.slug} className={`tier-${v.tier}`} style={{ borderTop: "1px solid var(--rule)", padding: "14px 0" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 24px", alignItems: "baseline" }}>
              <Link href={`/guide/${g.slug}`} style={{ fontWeight: 700, fontSize: 19, minWidth: 220 }}>
                {g.name}
              </Link>
              <span className="tier-chip" style={{ minWidth: 300, ...(v.rated ? {} : { color: "var(--unknown)", ["--tier" as string]: "var(--unknown)" }) }}>
                {v.rated ? `${v.tier}. ${v.tierName}` : v.tierName}
              </span>
              <span>
                <span className="faint">Work </span>
                {formatRange(g.effort.handsOnHours, "hour")}
              </span>
              <span>
                <span className="faint">Wait </span>
                {formatRange(g.effort.waitDays, "day")}
              </span>
              {g.tested && <span style={{ fontSize: 14, color: "var(--ok)", fontWeight: 600 }}>Tested by hand</span>}
            </div>
            <p
              className="muted"
              title={g.biggestBlocker?.text}
              style={{ margin: "6px 0 0", maxWidth: "80ch", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}
            >
              {g.biggestBlocker ? `Blocker: ${g.biggestBlocker.text}` : "No blocker found."}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

export default async function Home() {
  const library = libraryGuides().sort((a, b) => verdictFor(a).tier - verdictFor(b).tier);
  const live = await recentLiveGuides().catch(() => []);

  return (
    <div className="wrap">
      <section style={{ paddingTop: 40 }}>
        <h1 style={{ fontSize: "clamp(36px, 6.5vw, 64px)", margin: 0, maxWidth: "16ch" }}>An hour, or six weeks?</h1>
        <p className="prose muted" style={{ fontSize: 20, marginTop: 16 }}>
          Before your agent can connect to someone&rsquo;s account, you may need your own OAuth app approved by the provider. Look up an app to see how long that takes,
          what can block it, and which steps an agent can do for you.
        </p>
        <div style={{ marginTop: 28, maxWidth: 720 }}>
          <GenerateBox />
        </div>
      </section>

      {library.length > 0 && (
        <section className="section" aria-labelledby="spread">
          <h2 id="spread">Time to production, from minutes to months</h2>
          <p className="muted prose" style={{ marginTop: -8 }}>
            Each line runs from the fastest to the slowest realistic path for the default case in that guide: your hands-on work plus the provider&rsquo;s wait. A dashed tail means the
            wait is open-ended or unknown.
          </p>
          <div style={{ marginTop: 20 }}>
            <LibraryRuler guides={library} />
          </div>
        </section>
      )}

      <section className="section" id="library" aria-labelledby="library-heading">
        <h2 id="library-heading">Library</h2>
        <p className="muted prose" style={{ marginTop: -8 }}>
          Researched in depth by Claude Code agents, with every quote checked against its page. Apps marked tested were also set up by hand.
        </p>
        {library.length ? <GuideRows guides={library} /> : <p>No library guides yet.</p>}
      </section>

      {live.length > 0 && (
        <section className="section" aria-labelledby="live-heading">
          <h2 id="live-heading">Recently generated</h2>
          <p className="muted prose" style={{ marginTop: -8 }}>Generated on request by the live agent. Faster and shallower than library guides, so check the evidence section.</p>
          <GuideRows guides={live} />
        </section>
      )}

      <section className="section" aria-labelledby="tiers">
        <h2 id="tiers">How to read the difficulty</h2>
        <p className="muted prose" style={{ marginTop: -8 }}>
          The tier is computed from seven facts about the provider by a fixed rule, so it means the same thing for every app. The AI only gathers the facts.{" "}
          <Link href="/method">How guides are made</Link>
        </p>
        <dl style={{ margin: 0 }}>
          {([1, 2, 3, 4, 5] as Tier[]).map((t) => (
            <div key={t} className={`tier-${t}`} style={{ display: "grid", gridTemplateColumns: "minmax(200px, 260px) 1fr", gap: 16, padding: "10px 0", borderTop: "1px solid var(--rule)" }}>
              <dt className="tier-chip">{t}. {TIER_NAMES[t]}</dt>
              <dd style={{ margin: 0 }} className="muted">{TIER_HELP[t]}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
