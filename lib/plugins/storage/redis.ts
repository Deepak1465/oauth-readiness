import type { Guide } from "../../entities/guide";
import { parseGuide, type StoragePlugin } from "./types";

// Upstash Redis over its REST API (free tier; no client library needed).
export function redisStorage(url: string, token: string): StoragePlugin {
  async function command(cmd: (string | number)[]): Promise<unknown> {
    const res = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(cmd), cache: "no-store" });
    if (!res.ok) throw new Error(`Storage error ${res.status}`);
    return ((await res.json()) as { result: unknown }).result;
  }
  const get = async (slug: string) => {
    const raw = (await command(["GET", `guide:${slug}`])) as string | null;
    return raw ? parseGuide(raw) : null;
  };
  return {
    name: "Upstash Redis",
    get,
    async save(g: Guide) {
      await command(["SET", `guide:${g.slug}`, JSON.stringify(g, null, 2)]);
      await command(["ZADD", "guides:recent", Date.now(), g.slug]);
    },
    async recent(limit) {
      const slugs = ((await command(["ZRANGE", "guides:recent", 0, limit - 1, "REV"])) as string[]) ?? [];
      return (await Promise.all(slugs.map(get))).filter((g): g is Guide => !!g);
    },
  };
}
