import { join } from "node:path";
import { fileStorage } from "./file";
import { redisStorage } from "./redis";
import type { StoragePlugin } from "./types";

// Backend: Upstash Redis when configured (Vercel's integration injects UPSTASH_REDIS_REST_* or KV_REST_API_*
// depending on version), otherwise files. On a serverless host only /tmp is writable, and it doesn't survive
// between instances, so files there are a fallback only.

export function storagePlugin(): StoragePlugin {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) return redisStorage(url, token);
  const dir = process.env.GENERATED_DIR || (process.env.VERCEL ? join("/tmp", "generated") : join(process.cwd(), "data", "generated"));
  return fileStorage(dir);
}
