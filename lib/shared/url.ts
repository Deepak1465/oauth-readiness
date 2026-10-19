// URL and naming helpers shared by the agent, mappers and the API route.

export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

// Registrable-ish root: "developers.notion.com" -> "notion.com". Good enough for official-domain matching.
export function rootDomain(host: string): string {
  const parts = host.split(".");
  const twoLevelTld = parts.length > 2 && ["co", "com", "org", "net"].includes(parts.at(-2)!) && parts.at(-1)!.length === 2;
  return parts.slice(twoLevelTld ? -3 : -2).join(".");
}

// "https://Example.com/x" -> "example.com"
export function cleanRoot(d: string): string {
  return rootDomain(d.toLowerCase().trim().replace(/^https?:\/\//, "").replace(/\/.*$/, "").replace(/^www\./, ""));
}

export function slugify(s: string): string {
  return s.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\.[a-z.]+(\/.*)?$/, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

// If the user entered a website, return it as a full URL so the agent can start crawling there.
export function seedUrl(q: string): string | null {
  const t = q.trim();
  if (!/^(https?:\/\/)?[\w-]+(\.[\w-]+)+(:\d+)?(\/\S*)?$/.test(t)) return null;
  return t.startsWith("http") ? t : `https://${t}`;
}

// "developer.spotify.com" -> "spotify", "acme.localtest.me:4010/docs" -> "acme", "Google Drive" -> "Google Drive"
const GENERIC_LABELS = new Set(["www", "docs", "developer", "developers", "dev", "api", "app", "apps", "help", "support"]);
export function appTerm(q: string): string {
  const url = seedUrl(q);
  if (!url) return q.trim();
  const labels = hostOf(url).split(".");
  const meaningful = labels.slice(0, -1).filter((l) => !GENERIC_LABELS.has(l));
  return meaningful[0] ?? labels[0] ?? q;
}

// The guide slug for a request: the same for "Spotify", "spotify.com" and "https://developer.spotify.com/...".
export function slugFor(query: string): string {
  return slugify(appTerm(query));
}
