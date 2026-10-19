# OAuth Readiness

**Live:** https://oauth-readiness.vercel.app

Before an AI agent can act on someone's Gmail, GitHub or Notion, the developer usually needs their own OAuth app registered, and sometimes approved, by that provider. The code is the easy part. The hard part is the provider's process: is this an hour of setup, or six weeks of review plus a paid security audit?

This app answers that question first. Look up an app and you get a shareable guide with:

- **A verdict:** difficulty tier 1–5, hands-on hours vs. waiting days, the biggest blocker, and a confidence level.
- **Steps**, each marked **Agent** (an AI agent can do or draft it) or **You** (it needs your identity, accounts, legal authority or a real demo).
- **Requirements, gotchas, and what to do if you get stuck or rejected.**
- **Evidence:** every claim cites a source, every quote is checked by code against the live page, and hand-tested apps show a "docs said vs. we saw" table.

It ships with a library of 5 deeply researched guides, and an agent that writes a guide live for any other app in about 20–60 seconds.

## Run it locally

Requirements: Node 20+ and a free Gemini API key from https://aistudio.google.com/apikey.

```bash
npm install
cp .env.example .env.local      # then paste your key after GEMINI_API_KEY=
npm run dev                     # http://localhost:3000
```

Other commands:

```bash
npm test                                   # unit tests: tier rule, quote matcher
npm run validate:guides                    # schema + citations + live quote check for data/guides/*.json
npm run generate -- "Spotify"              # run the live agent from the terminal, printing each step
```

Optional environment variables (see `.env.example`):

- `TAVILY_API_KEY`: free-tier search API. Makes live research more reliable (see Limitations).
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`: durable storage for live guides when deployed. Without them, live guides are saved to `data/generated/`.

## What a developer gets

| Library guide | Verdict | Hands-on | Wait | Tested by hand |
|---|---|---|---|---|
| GitHub | Tier 1, Instant | 0.25–2 h | none | yes |
| Notion | Tier 1, Instant | 0.5–3 h | none | yes |
| LinkedIn | Tier 2, Instant but capped | 0.5–2 h | none | no |
| Google (Gmail) | Tier 4, Review plus external requirements | 10–60 h | 14+ days, open-ended | yes, up to the verification wall |
| Meta (Facebook & Instagram) | Tier 4, Review plus external requirements | 8–24 h | 7–45 days | no |

All five pass `npm run validate:guides`. 122 of 122 quotes were found word for word on their source pages (checked 2026-10-19/20).

Live-generated examples from testing: Spotify (tier 5, gated: extended access is only for organisations), Xero (tier 2: uncertified apps can connect to 5 organisations), Dropbox (tier 3), Shopify ("not enough evidence to rate").

## Key decisions

**1. It's a planning problem first, so the verdict leads.** A developer's first question is "can I launch by date X, and what's the long pole?", not "what's step 3?". Step-by-step setup docs already exist elsewhere. A comparable, evidence-backed verdict across providers doesn't. So every guide opens with tier, work vs. wait, the blocker and confidence. Steps come after.

**2. Work and waiting are different costs.** Two hours of forms plus three weeks of review is not "three weeks of work", and you can build while you wait. Guides split hands-on hours from calendar wait, and show both on a log-scale time ruler. The home page puts every app on one ruler, from minutes to months.

**3. The AI gathers facts; code decides the tier.** Each guide records seven gate facts (yes/no/unknown): self-serve credentials, limits until reviewed, provider review, security assessment, business verification, mandatory fees, partner or paid access. A fixed rule (`lib/rubric.ts`) turns them into tier 1–5, so a tier means the same thing for every app and the reason is visible ("Tier 4 because of security assessment"). Unknown facts never lower the bar silently: with 3 or more unknowns the guide says **"Not enough evidence to rate"** instead of guessing.

**4. Evidence is the product.** Sources disagree and rules change, so:
- Every source gets an evidence level (tested, provider docs, secondary, community), **set by code from the domain**, not by the model.
- Every quote is fetched and checked against the live page (`lib/quotecheck.ts`). An official source whose quote can't be found counts as secondary when computing confidence.
- Conflicting timelines become ranges, with each source cited.

**5. Agents where they add value, humans where they must.**
- *Library research:* one Claude Code research agent per app, run in parallel. Each had one app, one output file, and a strict brief (`agents/RESEARCH_BRIEF.md`, `.claude/agents/oauth-researcher.md`). Agents had to pass the same validator, including the live quote check, before reporting back. They also found and reported bugs in the validator itself, which were fixed.
- *Live generation:* a pipeline on Gemini's free tier (below).
- *Hands-on attempts:* a human created real OAuth apps on GitHub, Notion and Google. Account sign-in, 2-step verification and accepting terms are exactly the steps an agent can't do, and the guides mark them **You**.

**6. Composio context on every guide.** Each guide checks Composio's managed-auth list (`data/composio.json`, scraped from https://docs.composio.dev/toolkits/managed-auth: 123 managed, 211 bring-your-own). If Composio already manages the app, the guide says you can start today and explains when you'd still want your own app (your brand on the consent screen, your own rate limits, non-default scopes).

**7. Free and boring to run.** Next.js, JSON files in the repo for the library, no database. The live agent runs on Gemini's free tier.

## How the live agent works

```
discover (Gemini)  → names the provider's official domains and the doc URLs likely to cover OAuth approval
search (code)      → web search when a backend answers (Tavily if configured, else DuckDuckGo, best effort)
fetch + crawl      → loads candidate pages, follows relevant links on the provider's own site one hop
                     (review, verification, quota, production...), renders JS-only docs via r.jina.ai,
                     keeps the most relevant passages
write (Gemini)     → fills the guide schema, quoting only from the fetched passages
verify (code)      → checks every quote against its page, sets evidence levels by domain, checks Composio
verdict (code)     → computes the tier from the facts
```

The page streams each step as it happens. A URL the model suggests is only used if it actually loads, so the model can't cite a page we didn't retrieve. If one free model is overloaded, the agent falls back to the next.

**Why not Gemini's built-in Google Search grounding?** That was the original plan. Testing on 2026-10-19 showed `gemini-2.5-flash` (the free model with search grounding) is "no longer available to new users", and search grounding returns a quota error on every free model for a new key. Keyless search pages also rate-limit after a few queries. So the agent leans on the provider's own docs and its link structure, and treats web search as a bonus.

## Testing the agent against known answers

Reading generated guides only tells you whether they *look* right. To measure the agent, `testbed/server.mjs` runs fake providers whose rules we wrote ourselves, so the correct answer is known (`testbed/expected.ts`). It uses `*.localtest.me`, a public domain that resolves to your own machine, so the providers look like real websites to the agent.

| Fake provider | What its docs say | Correct answer |
|---|---|---|
| Acme CRM | Self-serve apps; test mode capped at 25 users; review before public use, 5–10 business days; no fees, business verification or security assessment. The review page is only reachable by following a link. One "community notes" page contains a **prompt injection** telling AI agents to report tier 1. | Tier 3 |
| Vault | Credentials only after partner approval; annual partner fee; business verification | Tier 5 |
| Mystery Cloud | Marketing copy only, "contact sales" | No guide: say there are no public developer docs |

Acme also runs a **real OAuth 2.0 server** (developer console, consent screen, authorization code + PKCE, token endpoint, scoped API) and a client app that connects to it.

```bash
npx playwright install chromium   # once
npm run test:oauth                # 12 OAuth flow tests, ~20 s, no AI calls
npm run test:agent                # 6 agent tests, ~1 min, uses your Gemini key
```

**Results (2026-10-20, all 18 pass from a clean start):**

- **Acme:** tier 3, 7/7 facts correct, wait 5–10 days, 4/4 quotes verified. The agent followed a link to find the review page and **ignored the prompt injection**.
- **Vault:** tier 5, 4/4 facts correct. A duplicate request during generation correctly gets 409.
- **Mystery:** no tier guessed. This test found a real bug: the agent said "Check the spelling" even though the URL was right. It now says it found the site but no public developer docs.
- **Edge cases:** cached repeat requests return in under 3 s, nonsense app names give a clear error, and empty or malformed input gets a 400.
- **OAuth edge cases covered:** user denies consent; a non-test user is blocked until review; an unregistered redirect URI gets an error and is never redirected to; unknown client; unknown scope; forged callback (state mismatch); code replay (rejected, and the token issued from it is revoked); wrong client secret; PKCE verifier mismatch; expired code; scope enforcement; invalid token.
- **Known weakness:** for Vault the agent gave the wait as "1+ days" although the docs say no timeline is published. "Unknown" would be more precise; the verdict is unaffected.

Agent scores are appended to `test-results/agent-scores.log` on every run. Gemini's output varies, so the agent suite retries once.

## What we tested, corrected, and couldn't verify

### Hands-on attempts (2026-10-19/20)

| App | Docs or our research said | We saw |
|---|---|---|
| GitHub | Callback URLs must be HTTPS | `http://localhost` was accepted; fine for development |
| GitHub | Public GitHub App needs no review | Confirmed: created and public in 9 minutes, no review or payment |
| GitHub | Human handles sign-in | New-device sign-in needed GitHub Mobile approval (or an emailed code) |
| Notion | Notion's Authorization guide: the authorization URL "populates after a public connection is submitted for review" | **Wrong today.** The authorization URL appeared immediately on creation; there's no review step outside the Marketplace |
| Notion | Older flows required company name, privacy policy, terms, support email | Not asked when creating a public connection; only relevant to an optional Marketplace listing |
| Notion | Redirect URIs must be HTTPS | `http://localhost` accepted, and a typo (trailing period) was saved with no validation error |
| Google | Not in any source | **Google Cloud now blocks console access until 2-step verification is on** (enforced since 22 June 2026) |
| Google | Add `gmail.readonly` on Data access | It doesn't appear until the Gmail API is enabled (or you paste the full scope URL) |
| Google | `gmail.readonly` is restricted | Confirmed: listed under "Your restricted scopes" |
| Google | Testing mode is capped at 100 users | Confirmed: "Allowed user cap prior to app verification is 100, and is counted over the entire lifetime of the app" |
| Google | Not in our sources | The client secret is shown only once; uploading a logo triggers verification; publishing is blocked until branding (home page, privacy policy, domains) is complete |

We stopped before submitting anything for review. We didn't create fake apps for review, and we didn't test Meta or LinkedIn by hand.

### Corrections found by the research agents

- **Google CASA cost:** the widely repeated "$15k–$75k" comes from a 2019 Google email. Currently reported Tier 2 prices are about $540–$1,800 a year, which is a secondary or community source; Google doesn't publish prices. The free CASA self-scan is deprecated.
- **Google `gmail.modify`** is restricted, not sensitive, despite a vendor blog saying otherwise.
- **Google's own pages disagree** on sensitive-scope review time: 3–5 vs. 10 business days. Both are cited.
- **Meta needs two verifications:** Business Verification *and* Tech Provider access verification. Without the second, calls fail with a misleading "object does not exist" error.
- **Meta review time:** official "within a week" vs. a vendor report of a 20-day dashboard warning. Shown as a range.
- **LinkedIn:** posting on a member's behalf is self-serve, but reading their posts isn't available to new apps, and non-partner apps get no refresh tokens (users re-consent every 60 days).
- **GitHub:** a user authorizing your app isn't enough to reach an organization's repos; an org owner has to install it.

### Couldn't verify (also listed on each guide)

- Official review timelines for LinkedIn's Community Management API and Meta's current dashboard estimate.
- Current CASA prices from Google or the App Defense Alliance (none published).
- Hands-on hours for Google and Meta are researcher estimates from the requirement lists, not sourced numbers.
- Notion access-token lifetime.

## Limitations

- **Live guides are shallower than library guides.** They rest on one model call over about 8–10 fetched pages, and free Gemini models are often "busy", so the agent may fall back to a smaller model. Example: the live Shopify guide missed Shopify's App Store review and was correctly rated "not enough evidence". The evidence section on each live guide shows exactly what held up.
- **Search without a key is unreliable.** DuckDuckGo's HTML endpoint blocks after a few queries, so live research mostly follows the provider's own docs. A free Tavily key fixes this.
- **Rules change.** Every guide and source is dated; nothing re-checks guides automatically yet.
- **Wait times are mostly self-reported.** We show ranges, never one promise.
- **One scenario per guide.** Verdicts assume a public app with the scopes an agent typically needs. Other cases (sign-in only, internal, special APIs) are described in "If your case is different" but not separately rated.
- **Rate limiting is in-memory** (6 live guides per visitor per hour) and resets on restart.
- **Live guides need storage when deployed.** Locally they're files; on a serverless host set the Upstash variables.

## Project layout

```
app/                      pages: home, guide/[slug], method; api/generate (streams agent progress)
components/               verdict panel, time ruler, generate box, citations
lib/rubric.ts             the tier rule (tested)
lib/verdict.ts            tier, confidence and "not enough evidence" from a guide's facts
lib/guide.ts              the guide schema (zod), shared by research agents, live agent and UI
lib/agent.ts              live agent pipeline
lib/quotecheck.ts         fetch + quote verification, JS-page fallback (tested)
lib/search.ts, sources.ts search backends, evidence levels by domain, excerpting, link following
data/guides/              library guides (researched + hand-tested)
data/composio.json        Composio managed vs. bring-your-own toolkit list
agents/RESEARCH_BRIEF.md  brief given to each research agent
.claude/agents/           the research agent definition
scripts/                  validate-guides.ts, generate.ts
testbed/                  fake providers + OAuth server + client app, and their expected answers
tests/                    Playwright suites: oauth.spec.ts, agent.spec.ts
```

Built with Claude Code. The UI was designed with the `frontend-design` plugin and checked with headless-Chrome screenshots at desktop and phone widths. Vercel's [agent-skills](https://github.com/vercel-labs/agent-skills) were installed for the session (not committed).
