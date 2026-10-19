import { describe, expect, it } from "vitest";
import { isPlaceholderHost, slugFor } from "./url";

describe("slugFor", () => {
  it("gives one slug for a name, a domain and a developer URL", () => {
    expect(["Spotify", "spotify.com", "https://developer.spotify.com/documentation"].map(slugFor)).toEqual(["spotify", "spotify", "spotify"]);
  });
});

describe("isPlaceholderHost", () => {
  it("flags reserved example domains, not real ones", () => {
    expect(["example.com", "docs.example.org", "api.example", "foo.test", "localhost"].every(isPlaceholderHost)).toBe(true);
    expect(["github.com", "examplesite.com", "acme.localtest.me"].some(isPlaceholderHost)).toBe(false);
  });
});
