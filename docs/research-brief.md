# Library guide research brief

You write **one** OAuth readiness guide for one app, as JSON. Today is 2026-10-19.

The guide answers a developer building an AI agent who wants their users to connect this app with **the developer's own OAuth app** (not Composio's managed one):
*How hard is it to get an OAuth app ready, how long will it take (hands-on work vs waiting for approval), what could block it, and which steps can an agent do vs which need a human?*

Accuracy matters more than completeness. **Never guess.** If you can't establish something, set the fact to `null`, say why in `note`, and add it to `unknowns`.

## Output

Write `data/guides/<slug>.json` matching `Guide` in `lib/entities/guide.ts` (read it first, plus `lib/entities/rubric.ts` and `lib/entities/evidence.ts`). Do not edit any other file.

Field rules:

- `method`: `"library"`. `generatedAt`: `"2026-10-19T00:00:00Z"`. `tested`: `null` (hands-on results are added later by a human).
- `composio`: look the app up in `data/composio.json`. `managed: true` if any of its toolkits is in `managed`, `false` if only in `bringYourOwn`, `null` if absent. List matching toolkit slugs in `toolkits`.
- `scenario`: the case the verdict assumes. Default: **a public app any external user can connect, requesting the scopes an AI agent typically needs to read and act on the user's data** (name the scopes). Other meaningful cases (sign-in only, internal/workspace-only, a more restricted API) go in `variants` as short `{label, text}` entries, e.g. "Internal only: no verification needed because ...".
- `facts` (the 7 gates in `lib/entities/rubric.ts`): each `{ value: true|false|null, note, sourceIds }` for the scenario. `reviewRequired` = review before users outside your own team/org can connect. Every `true` gate and every `false` gate that a developer might assume is true must cite a source.
- `effort.handsOnHours` and `effort.waitDays`: ranges `{min, max}` (`max: null` = open-ended). Hands-on = active work (forms, privacy policy, demo video). Wait = calendar time for approval. When sources disagree, widen the range and cite all of them. `recurring`: anything annual or periodic (e.g. reassessment).
- `biggestBlocker`: one sentence, or `null` if there isn't one.
- `steps`: ordered. Each has `owner: "agent"` only if an AI agent with a browser or API could plausibly do it without the human's identity or legal authority (e.g. drafting a scope justification, filling a redirect URI, checking requirements). Account creation, accepting terms, identity/business verification, payment, recording a demo of the real app, and anything needing 2FA are `"you"`. `kind: "wait"` for review waits.
- `requirements`: concrete items (privacy policy URL, verified domain, demo video, logo, etc.).
- `gotchas`: nuances that bite (dev-mode user caps, token expiry, rate limits, admin consent, scope downgrades).
- `stuck`: common rejection reasons or failure modes with a fix.
- `summary`: two plain sentences. No marketing language.

## Sources and quotes (this is checked by code)

- Each `sources[]` entry is one URL plus one **verbatim** quote (one or two sentences) copied from that page as fetched. Use ids `s1`, `s2`, ... Reuse a URL in several entries if you need several quotes from it.
- Fetch every page you cite. Prefer the provider's own docs and policies.
- `level`: `official` = the provider's own domain (docs, help center, policy, developer blog). `secondary` = integration platforms or vendor guides about the provider (Nango, Pipedream, Nylas, etc.). `community` = forums, Reddit, Stack Overflow, HN, community.* sites. Never `tested`.
- `quoteVerified`: `null`. `checkedAt`: `"2026-10-19"`.
- Then run `npx tsx scripts/validate-guides.ts <slug>`. It validates the schema, checks cited ids exist, and fetches each URL to confirm the quote is on the page. Fix every "not found" quote (re-copy it exactly or replace the source) until all quotes on reachable pages verify. Pages that are "unreachable" to a plain fetch (JS-rendered) are acceptable, but prefer a reachable page saying the same thing.

## Report back (short)

Tier and confidence from the validator, quotes verified X/Y, the wait range, the biggest blocker, what you could not verify, and anything surprising or that contradicts common belief.
