import { Guide } from "../../entities/guide";

// Where live-generated guides are kept so their share links keep working.
export interface StoragePlugin {
  name: string;
  get(slug: string): Promise<Guide | null>;
  save(guide: Guide): Promise<void>;
  recent(limit: number): Promise<Guide[]>;
}

export function parseGuide(raw: string): Guide | null {
  const r = Guide.safeParse(JSON.parse(raw));
  return r.success ? r.data : null;
}
