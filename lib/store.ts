import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { Guide } from "./guide";

// Library guides live in the repo (data/guides). Live guides need somewhere durable so their links can be shared:
// Upstash Redis (free tier, REST) when configured, otherwise a local folder for development.

const LIBRARY_DIR = join(process.cwd(), "data", "guides");
const LOCAL_DIR = join(process.cwd(), "data", "generated");
const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

function parse(raw: string): Guide | null {
  const r = Guide.safeParse(JSON.parse(raw));
  return r.success ? r.data : null;
}

export function libraryGuides(): Guide[] {
  if (!existsSync(LIBRARY_DIR)) return [];
  return readdirSync(LIBRARY_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parse(readFileSync(join(LIBRARY_DIR, f), "utf8")))
    .filter((g): g is Guide => !!g);
}

async function redis(cmd: (string | number)[]): Promise<unknown> {
  const res = await fetch(redisUrl!, { method: "POST", headers: { authorization: `Bearer ${redisToken}` }, body: JSON.stringify(cmd), cache: "no-store" });
  if (!res.ok) throw new Error(`Storage error ${res.status}`);
  return ((await res.json()) as { result: unknown }).result;
}

export async function getGuide(slug: string): Promise<Guide | null> {
  const lib = libraryGuides().find((g) => g.slug === slug);
  if (lib) return lib;
  if (redisUrl && redisToken) {
    const raw = (await redis(["GET", `guide:${slug}`])) as string | null;
    return raw ? parse(raw) : null;
  }
  const file = join(LOCAL_DIR, `${slug}.json`);
  return existsSync(file) ? parse(readFileSync(file, "utf8")) : null;
}

export async function saveGuide(g: Guide): Promise<void> {
  const raw = JSON.stringify(g, null, 2);
  if (redisUrl && redisToken) {
    await redis(["SET", `guide:${g.slug}`, raw]);
    await redis(["ZADD", "guides:recent", Date.now(), g.slug]);
    return;
  }
  mkdirSync(LOCAL_DIR, { recursive: true });
  writeFileSync(join(LOCAL_DIR, `${g.slug}.json`), raw);
}

export async function recentLiveGuides(limit = 12): Promise<Guide[]> {
  if (redisUrl && redisToken) {
    const slugs = ((await redis(["ZRANGE", "guides:recent", 0, limit - 1, "REV"])) as string[]) ?? [];
    return (await Promise.all(slugs.map(getGuide))).filter((g): g is Guide => !!g);
  }
  if (!existsSync(LOCAL_DIR)) return [];
  return readdirSync(LOCAL_DIR)
    .filter((f) => f.endsWith(".json"))
    .map((f) => parse(readFileSync(join(LOCAL_DIR, f), "utf8")))
    .filter((g): g is Guide => !!g)
    .sort((a, b) => b.generatedAt.localeCompare(a.generatedAt))
    .slice(0, limit);
}
