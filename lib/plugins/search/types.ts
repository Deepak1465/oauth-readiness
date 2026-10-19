export interface SearchHit {
  url: string;
  title: string;
}

// A search backend. Throw SearchBlocked when the backend refuses or rate-limits, so the caller can stop early.
export interface SearchPlugin {
  name: string;
  search(query: string): Promise<SearchHit[]>;
  delayMs: number; // pause between queries, to stay polite to keyless endpoints
}

export class SearchBlocked extends Error {}
