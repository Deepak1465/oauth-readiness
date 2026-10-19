import data from "@/data/composio.json";

// Composio's managed-auth list, scraped from docs.composio.dev/toolkits/managed-auth (see data/composio.json).
// "managed" means Composio already provides an OAuth app, so a developer can start without registering their own.

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function composioLookup(appName: string): { managed: boolean | null; toolkits: string[] } {
  const k = key(appName.replace(/\(.*\)/, "")); // "Google (Gmail)" -> "google"
  if (k.length < 3) return { managed: null, toolkits: [] };
  const hits = (list: { name: string; slug: string }[]) =>
    list.filter((t) => key(t.slug) === k || key(t.name) === k || key(t.name).startsWith(k) || key(t.slug).startsWith(k)).map((t) => t.slug);
  const managed = hits(data.managed);
  const byo = hits(data.bringYourOwn);
  if (managed.length) return { managed: true, toolkits: [...managed, ...byo] };
  if (byo.length) return { managed: false, toolkits: byo };
  return { managed: null, toolkits: [] };
}

// "Meta (Facebook & Instagram)" should match Composio's facebook and instagram toolkits, not just "meta".
export function composioStatus(name: string, query: string): { managed: boolean | null; toolkits: string[] } {
  const inner = name.match(/\(([^)]*)\)/)?.[1] ?? "";
  const candidates = [name, query, ...inner.split(/&|,|\band\b/)].map((s) => s.trim()).filter(Boolean);
  const results = candidates.map(composioLookup);
  const toolkits = [...new Set(results.flatMap((r) => r.toolkits))];
  const managed = results.some((r) => r.managed === true) ? true : results.some((r) => r.managed === false) ? false : null;
  return { managed, toolkits };
}
