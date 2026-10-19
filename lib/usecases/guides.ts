import type { Guide } from "../entities/guide";
import { libraryGuides } from "../gateways/library";
import { storagePlugin } from "../plugins/storage";

// Finding and keeping guides: library guides first, then live-generated ones from the configured storage.

export { libraryGuides };

const storage = storagePlugin();

export async function getGuide(slug: string): Promise<Guide | null> {
  return libraryGuides().find((g) => g.slug === slug) ?? (await storage.get(slug));
}

export async function saveGuide(g: Guide): Promise<void> {
  await storage.save(g);
}

export async function recentLiveGuides(limit = 12): Promise<Guide[]> {
  return storage.recent(limit);
}
