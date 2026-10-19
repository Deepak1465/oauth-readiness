import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Cite } from "@/components/Cite";
import { CopyLink } from "@/components/CopyLink";
import { VerdictPanel } from "@/components/Verdict";
import type { Guide } from "@/lib/entities/guide";
import { getGuide } from "@/lib/usecases/guides";
import { verdictFor } from "@/lib/entities/verdict";

export const dynamic = "force-dynamic";

const LEVEL_TEXT: Record<Guide["sources"][number]["level"], string> = {
  tested: "Tested by us",
  official: "Provider docs",
  secondary: "Secondary source",
  community: "Community report",
  inferred: "Inferred",
  unknown: "Unknown",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const g = await getGuide((await params).slug);
  if (!g) return { title: "Guide not found" };
  const v = verdictFor(g);
  return { title: `${g.name} OAuth app approval`, description: `Tier ${v.tier}: ${v.tierName}. ${g.summary}` };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
  const guide = await getGuide((await params).slug);
  if (!guide) notFound();
  const g = guide;
  const date = g.generatedAt.slice(0, 10);

  return (
    <article className="wrap" style={{ paddingBottom: 24 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
        <Link href="/" style={{ fontSize: 15 }}>Back to all apps</Link>
        <CopyLink />
      </div>

      <h1 style={{ fontSize: "clamp(34px, 6vw, 52px)", margin: "20px 0 8px" }}>{g.name}</h1>
      <p className="muted" style={{ margin: 0, fontSize: 15 }}>
        {g.method === "library" ? "Library guide, researched by Claude Code agents" : "Generated live by the research agent (Gemini)"}, checked {date}.{" "}
        {g.tested ? <strong style={{ color: "var(--ok)" }}>Setup tested by hand on {g.tested.date}.</strong> : "Setup not tested by hand."}
      </p>
      <p className="prose" style={{ fontSize: 19, marginTop: 20 }}>{g.summary}</p>

      <VerdictPanel guide={g} />

      <ComposioNote guide={g} />

      {g.variants.length > 0 && (
        <section className="section" aria-labelledby="variants">
          <h2 id="variants">If your case is different</h2>
          <dl className="prose" style={{ margin: 0 }}>
            {g.variants.map((v) => (
              <div key={v.label} style={{ marginBottom: 14 }}>
                <dt style={{ fontWeight: 600 }}>{v.label}</dt>
                <dd style={{ margin: 0 }} className="muted">{v.text}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="section" aria-labelledby="steps">
        <h2 id="steps">Steps</h2>
        <p className="muted prose" style={{ marginTop: -8 }}>
          <span className="badge badge-agent">Agent</span> steps an AI agent can do or draft for you.{" "}
          <span className="badge badge-you">You</span> steps that need your identity, accounts, legal authority or a real demo.
        </p>
        <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {g.steps.map((s, i) => (
            <li
              key={i}
              style={{ display: "grid", gridTemplateColumns: "36px 1fr", gap: 12, padding: "16px 0", borderTop: "1px solid var(--rule)" }}
            >
              <span aria-hidden style={{ fontWeight: 700, fontSize: 20, color: s.kind === "wait" ? "var(--wait)" : "var(--ink-3)" }}>{i + 1}</span>
              <div className="prose">
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: 18 }}>{s.title}</h3>
                  <span className={`badge ${s.owner === "agent" ? "badge-agent" : "badge-you"}`}>{s.owner === "agent" ? "Agent" : "You"}</span>
                  {s.kind === "wait" && <span className="badge" style={{ borderColor: "var(--wait)", color: "var(--wait)" }}>Wait</span>}
                </div>
                <p style={{ margin: "6px 0 0" }} className="muted">
                  {s.detail}
                  <Cite ids={s.sourceIds} guide={g} />
                </p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "0 48px" }}>
        {g.requirements.length > 0 && (
          <section className="section" aria-labelledby="reqs">
            <h2 id="reqs">What you will need</h2>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {g.requirements.map((r, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  {r.text}
                  <Cite ids={r.sourceIds} guide={g} />
                </li>
              ))}
            </ul>
          </section>
        )}
        {g.gotchas.length > 0 && (
          <section className="section" aria-labelledby="gotchas">
            <h2 id="gotchas">Nuances that catch people out</h2>
            <ul style={{ paddingLeft: 20, margin: 0 }}>
              {g.gotchas.map((r, i) => (
                <li key={i} style={{ marginBottom: 8 }}>
                  {r.text}
                  <Cite ids={r.sourceIds} guide={g} />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {g.stuck.length > 0 && (
        <section className="section" aria-labelledby="stuck">
          <h2 id="stuck">If you get stuck or rejected</h2>
          <dl className="prose" style={{ margin: 0 }}>
            {g.stuck.map((s, i) => (
              <div key={i} style={{ marginBottom: 16 }}>
                <dt style={{ fontWeight: 600 }}>{s.problem}</dt>
                <dd style={{ margin: "2px 0 0" }} className="muted">
                  {s.fix}
                  <Cite ids={s.sourceIds} guide={g} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section className="section" aria-labelledby="evidence">
        <h2 id="evidence">Evidence</h2>
        {g.tested ? (
          <div className="prose" style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>What we tested by hand</h3>
            <p className="muted" style={{ margin: "0 0 12px" }}>
              {g.tested.summary}
              {g.tested.minutes !== null && ` Took ${g.tested.minutes} minutes.`}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 15 }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    <th style={{ padding: "6px 12px 6px 0" }}>Step</th>
                    <th style={{ padding: "6px 12px 6px 0" }}>Docs said</th>
                    <th style={{ padding: "6px 12px 6px 0" }}>We saw</th>
                    <th style={{ padding: "6px 0" }}>Match</th>
                  </tr>
                </thead>
                <tbody>
                  {g.tested.observations.map((o, i) => (
                    <tr key={i} style={{ borderTop: "1px solid var(--rule)", verticalAlign: "top" }}>
                      <td style={{ padding: "8px 12px 8px 0", fontWeight: 600 }}>{o.step}</td>
                      <td style={{ padding: "8px 12px 8px 0" }} className="muted">{o.docsSaid}</td>
                      <td style={{ padding: "8px 12px 8px 0" }}>{o.weSaw}</td>
                      <td style={{ padding: "8px 0", color: o.matched ? "var(--ok)" : "var(--bad)", fontWeight: 600 }}>{o.matched ? "Yes" : "No"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {g.unknowns.length > 0 && (
          <div className="prose" style={{ marginBottom: 28 }}>
            <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>What we could not verify</h3>
            <ul style={{ paddingLeft: 20, margin: 0 }} className="muted">
              {g.unknowns.map((u, i) => (
                <li key={i} style={{ marginBottom: 6 }}>{u}</li>
              ))}
            </ul>
          </div>
        )}

        <h3 style={{ fontSize: 18, margin: "0 0 6px" }}>Sources</h3>
        <p className="faint prose" style={{ fontSize: 14, marginTop: 0 }}>
          Each quote was checked by code against the live page. &ldquo;Not found on page&rdquo; means the quote may be paraphrased, so treat that claim with care.
        </p>
        <ol style={{ paddingLeft: 24, margin: 0 }}>
          {g.sources.map((s) => (
            <li key={s.id} id={`src-${s.id}`} style={{ marginBottom: 16, scrollMarginTop: 24 }} className="prose">
              <a href={s.url} target="_blank" rel="noreferrer" style={{ fontWeight: 600, overflowWrap: "anywhere" }}>{s.title}</a>
              <div style={{ fontSize: 14, display: "flex", gap: 8, flexWrap: "wrap", marginTop: 2 }}>
                <span className="badge">{LEVEL_TEXT[s.level]}</span>
                <QuoteState v={s.quoteVerified} hasQuote={!!s.quote} tested={s.level === "tested"} />
                <span className="faint">checked {s.checkedAt}</span>
              </div>
              {s.quote && (
                <blockquote style={{ margin: "6px 0 0", paddingLeft: 12, borderLeft: "3px solid var(--rule)" }} className="muted">
                  {s.quote}
                </blockquote>
              )}
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}

function QuoteState({ v, hasQuote, tested }: { v: boolean | null; hasQuote: boolean; tested: boolean }) {
  if (tested || !hasQuote) return null;
  if (v === true) return <span style={{ color: "var(--ok)", fontWeight: 600 }}>Quote found on page</span>;
  if (v === false) return <span style={{ color: "var(--bad)", fontWeight: 600 }}>Quote not found on page</span>;
  return <span className="faint">Page could not be checked automatically</span>;
}

function ComposioNote({ guide }: { guide: Guide }) {
  const c = guide.composio;
  if (c.managed === null) return null;
  return (
    <p className="prose" style={{ marginTop: 24, padding: "14px 16px", borderLeft: "4px solid var(--link)", background: "var(--surface)", borderRadius: "0 8px 8px 0" }}>
      {c.managed ? (
        <>
          <strong>You can start today without any of this.</strong> Composio already provides a managed OAuth app for {guide.name} ({c.toolkits.join(", ")}), so users can connect while you work through your own app. You need your own app for your brand on the consent screen, your own rate limits, or scopes beyond the defaults.
        </>
      ) : (
        <>
          <strong>Composio has no managed app here</strong> ({c.toolkits.join(", ")}), so you need your own OAuth app before users can connect at all. Start the slow steps first.
        </>
      )}{" "}
      <a href="https://docs.composio.dev/toolkits/managed-auth" target="_blank" rel="noreferrer">Managed auth list</a>
    </p>
  );
}
