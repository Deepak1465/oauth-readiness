import { generateGuide, type AgentEvent } from "@/lib/usecases/generate-guide";
import { slugFor } from "@/lib/shared/url";
import { RateLimiter } from "@/lib/shared/ratelimit";
import { getGuide, saveGuide } from "@/lib/usecases/guides";

export const maxDuration = 120;

// Free-tier protection: a few generations per visitor per hour, and one run per app at a time.
const PER_HOUR = Number(process.env.RATE_LIMIT_PER_HOUR || 6);
const limiter = new RateLimiter(PER_HOUR, 3600_000);
const inFlight = new Set<string>();

// Streams newline-delimited JSON events so the page can show the agent's progress as it happens.
export async function POST(req: Request) {
  const { query } = (await req.json().catch(() => ({}))) as { query?: string };
  const q = (query ?? "").trim().slice(0, 100);
  if (q.length < 2) return Response.json({ error: "Enter an app name or website." }, { status: 400 });

  const key = slugFor(q);
  const cached = await getGuide(key);
  if (cached) return stream(async (emit) => emit({ type: "done", slug: cached.slug }));

  if (inFlight.has(key)) return Response.json({ error: "A guide for this app is already being generated. Refresh in a minute." }, { status: 409 });
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter.allow(ip)) return Response.json({ error: `You've generated ${PER_HOUR} guides this hour. Open an existing guide or try again later.` }, { status: 429 });

  return stream(async (emit) => {
    inFlight.add(key);
    try {
      const guide = await generateGuide(q, emit);
      const existing = await getGuide(guide.slug); // the model may resolve "gh" to "github"
      if (!existing) await saveGuide(guide);
      emit({ type: "done", slug: guide.slug });
    } finally {
      inFlight.delete(key);
    }
  });
}

function stream(run: (emit: (e: AgentEvent) => void) => Promise<void>): Response {
  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const emit = (e: AgentEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await run(emit);
      } catch (e) {
        emit({ type: "error", message: friendly(e) });
      }
      controller.close();
    },
  });
  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}

function friendly(e: unknown): string {
  const msg = e instanceof Error ? e.message : String(e);
  if (/429|quota|RESOURCE_EXHAUSTED/i.test(msg)) return "The free Gemini quota is used up for now. Try again in a minute, or open a guide from the library.";
  if (/API key|PERMISSION_DENIED|401|403/i.test(msg)) return "The Gemini API key is missing or invalid on the server.";
  return msg.slice(0, 300);
}
