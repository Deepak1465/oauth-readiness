import { z } from "zod";

// The two prompts the agent sends, and the discovery schema. The guide schema lives in mappers/llm-to-guide.ts.

export const Discovery = z.object({
  name: z.string().describe("the provider's official product name"),
  website: z.string(),
  officialDomains: z.array(z.string()).describe("root domains the provider owns, e.g. example.com, examplecdn.com"),
  docUrls: z
    .array(z.string())
    .describe("up to 10 full URLs of the provider's official pages on: registering an OAuth app, OAuth scopes/permissions, app review or verification, going to production or publishing, rate limits, developer terms or policies"),
});

export const DISCOVER_PROMPT = (q: string) => `A developer wants to register their own OAuth app with "${q}" so their users can connect ${q} accounts to an AI agent product. Identify the provider and list the official documentation URLs most likely to describe: creating an OAuth app or client credentials; OAuth scopes and permissions; app review, verification or approval for public use; moving from development/test mode to production; partner programs or access tiers; rate limits; developer policies. Give real, specific URLs you are confident exist on the provider's own domains. Do not invent paths.`;

export const WRITE_PROMPT = (q: string, sources: { title: string; url: string; text: string }[]) => `You write OAuth readiness guides. A developer building an AI agent product wants their external users to connect their "${q}" accounts through the developer's OWN OAuth app. Using ONLY the sources below, explain how hard it is to get that OAuth app ready and approved, how long it takes, what could block it, and which steps an agent can do. Today is ${new Date().toISOString().slice(0, 10)}.

Rules:
- Default scenario: a public app that any external user can connect, requesting the scopes an AI agent typically needs to read and act on the user's data. Other meaningful cases (sign-in only, internal-only, restricted APIs) go in "variants".
- facts describe the DEFAULT scenario only. A hurdle that applies only to a special API, partner product or add-on belongs in "variants", not in facts. Limits on unreviewed or uncertified apps (connection or user caps, token lifetimes) count as devModeLimits.
- facts: "yes"/"no" only when the sources support it; otherwise "unknown". If official sources describe the full path to production and a hurdle never appears in it, you may answer "no" with the note starting "Not mentioned in the official process:" and cite those sources. reviewRequired = review before users outside the developer's own team can connect. devModeLimits = user caps, short token lifetimes, or warning screens until a review. gated = partner program, paid API tier, sales-only or waitlist.
- handsOnHours = active work; waitDays = calendar wait for approval (null if the sources don't say). Widen ranges when sources disagree. Never invent numbers; if you estimate, say so in unknowns.
- steps: ordered. owner "agent" only if an AI agent with a browser or API could do it without the human's identity or legal authority (drafting text, filling technical fields, checking requirements). Creating accounts, accepting terms, identity/business verification, payment, recording a demo, 2FA are "you". Approval waits are kind "wait".
- Cite sources by index. Do not cite a source for something it doesn't say.
- quotes: for each source you cite, give one short quote (one or two sentences) COPIED EXACTLY from that source's passages. Choose the sentence that backs the most important claim you cite it for (a fact that sets difficulty, the wait, or the biggest blocker), not a generic introduction. Never paraphrase inside a quote.
- If the sources don't cover something, put it in "unknowns". Saying unknown is better than guessing.

SOURCES (index, title, url, then passages fetched from that page):
${sources.map((s, i) => `[${i}] ${s.title} — ${s.url}\n${s.text}`).join("\n\n")}`;
