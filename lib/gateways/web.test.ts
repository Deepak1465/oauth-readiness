import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchReadable } from "./web";

// The reader fallback answers 200 for missing pages; those must not count as loaded.
describe("fetchReadable", () => {
  afterEach(() => vi.unstubAllGlobals());

  const stub = (direct: Response, reader: string) =>
    vi.stubGlobal("fetch", async (url: string) => (url.startsWith("https://r.jina.ai/") ? new Response(reader) : direct));

  it("treats a 404 as missing even when the reader returns a page", async () => {
    stub(new Response("Not found", { status: 404 }), `Title: Example\n\nWarning: Target URL returned error 404: Not Found\n\nMarkdown Content:\n${"text about oauth review ".repeat(40)}`);
    expect(await fetchReadable("https://example.org/docs/oauth")).toBeNull();
  });

  it("uses the reader for a JavaScript-rendered page that loaded", async () => {
    stub(new Response("<html><body><div id=root></div></body></html>"), `Title: Docs\n\nMarkdown Content:\n${"Apps must pass review before going live. ".repeat(20)}`);
    const page = await fetchReadable("https://docs.real-provider.dev/oauth");
    expect(page?.rendered).toBe(true);
    expect(page?.text).toContain("Apps must pass review");
  });
});
