import type { Metadata } from "next";

export const metadata: Metadata = { title: "How guides are made" };

const LEVELS: [string, string][] = [
  ["Tested by us", "We created the OAuth app ourselves and recorded what happened, including where it differed from the docs."],
  ["Provider docs", "The provider's own documentation or policy pages. Strongest written evidence."],
  ["Secondary source", "Integration platforms and vendor guides writing about the provider. Useful, sometimes out of date."],
  ["Community report", "Forums, Stack Overflow, Reddit. Good for real wait times and rejection stories, but anecdotal."],
  ["Inferred", "Reasoned from other facts, with nothing stating it directly."],
];

export default function Method() {
  return (
    <article className="wrap prose" style={{ paddingTop: 32 }}>
      <h1 style={{ fontSize: "clamp(32px, 5vw, 46px)", margin: 0 }}>How guides are made</h1>
      <p className="muted" style={{ fontSize: 19 }}>
        The hard part of an integration is rarely the OAuth code. It&rsquo;s the provider&rsquo;s approval process: whether you can launch next week or are stuck in review for two months. These
        guides answer that question first, then show the steps.
      </p>

      <section className="section">
        <h2>Two ways a guide is written</h2>
        <h3 style={{ fontSize: 18, marginBottom: 4 }}>Library guides</h3>
        <p className="muted" style={{ marginTop: 0 }}>
          One Claude Code research agent per app reads the provider&rsquo;s docs, policies and developer reports, then writes a structured guide. Each agent works only on its own app and
          must copy every quote verbatim from a page it fetched. For some apps we also created the OAuth app by hand and recorded what actually happened.
        </p>
        <h3 style={{ fontSize: 18, marginBottom: 4 }}>Live guides</h3>
        <p className="muted" style={{ marginTop: 0 }}>When you submit an app that isn&rsquo;t in the library, a research agent runs on the spot:</p>
        <ol className="muted">
          <li>Gemini searches the web (Google Search grounding) and writes research notes.</li>
          <li>Code fetches the pages it used and keeps the passages about OAuth, review and verification.</li>
          <li>Gemini turns the notes into the guide format, quoting only from those passages.</li>
          <li>Code checks every quote against its page, sets each source&rsquo;s evidence level from its domain, and checks Composio&rsquo;s managed-app list.</li>
          <li>Code computes the difficulty tier from the facts.</li>
        </ol>
        <p className="muted">Live guides take about a minute and are shallower than library guides. Their evidence section shows exactly how much held up.</p>
      </section>

      <section className="section">
        <h2>What the AI decides, and what it doesn&rsquo;t</h2>
        <p className="muted">
          The AI gathers facts and writes the explanations. It doesn&rsquo;t pick the difficulty. The tier comes from seven yes, no or unknown facts by a fixed rule:
        </p>
        <ul className="muted">
          <li>Partner, paid or sales-only access, or no self-serve credentials: tier 5.</li>
          <li>Otherwise, a security assessment, business verification or fees: tier 4.</li>
          <li>Otherwise, provider review before outside users can connect: tier 3.</li>
          <li>Otherwise, limits until reviewed (user caps, short-lived tokens, warning screens): tier 2.</li>
          <li>Otherwise: tier 1.</li>
        </ul>
        <p className="muted">
          An unknown fact never raises the tier on its own, but it forces confidence to low and is listed on the guide, so you can see the tier might be higher.
        </p>
      </section>

      <section className="section">
        <h2>Evidence levels</h2>
        <dl style={{ margin: 0 }}>
          {LEVELS.map(([k, v]) => (
            <div key={k} style={{ padding: "10px 0", borderTop: "1px solid var(--rule)" }}>
              <dt style={{ fontWeight: 600 }}>{k}</dt>
              <dd style={{ margin: 0 }} className="muted">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="muted">
          Every quote is checked by code against the live page. If a quote from the provider&rsquo;s docs can&rsquo;t be found, that source counts one level lower when we work out confidence.
        </p>
      </section>

      <section className="section">
        <h2>Agent steps and your steps</h2>
        <p className="muted">
          A step is marked <strong>Agent</strong> when an AI agent could do it or draft it without your identity or legal authority: checking requirements, filling in redirect URIs and
          scopes, drafting a scope justification. It&rsquo;s marked <strong>You</strong> when it needs your account, your agreement to terms, identity or business verification, payment,
          2FA, or a recording of your real product.
        </p>
      </section>

      <section className="section">
        <h2>Limits</h2>
        <ul className="muted">
          <li>Provider rules change. Every guide and source is dated, and nothing re-checks guides automatically yet.</li>
          <li>Some docs only render with JavaScript, so their quotes can&rsquo;t be checked automatically and are marked as such.</li>
          <li>Wait times are mostly self-reported by developers. We show ranges, never a single promise.</li>
          <li>Live guides run on a free model tier, so they can be rate-limited.</li>
        </ul>
      </section>
    </article>
  );
}
