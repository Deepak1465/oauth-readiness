import { describe, expect, it } from "vitest";
import { quoteAppears } from "./quotecheck";

const page = `<html><body><p>Apps that request&nbsp;<b>restricted scopes</b> must complete a
  security assessment.</p><p>Verification can take 4–6 weeks.</p><script>var x = "fake quote here";</script></body></html>`;

describe("quoteAppears", () => {
  it("matches across tags, entities and whitespace", () => {
    expect(quoteAppears("Apps that request restricted scopes must complete a security assessment.", page)).toBe(true);
  });
  it("normalizes dashes and case", () => {
    expect(quoteAppears("verification can take 4-6 weeks", page)).toBe(true);
  });
  it("accepts fragments joined with an ellipsis", () => {
    expect(quoteAppears("restricted scopes must complete ... Verification can take 4-6 weeks", page)).toBe(true);
  });
  it("decodes numeric and hex entities, including apostrophes", () => {
    const p = "<p>You can&#x27;t use the app until it&#8217;s installed&#39;.</p>";
    expect(quoteAppears("You can't use the app until it's installed", p)).toBe(true);
  });
  it("ignores stray spaces before punctuation", () => {
    expect(quoteAppears("Newly-created apps begin in development mode.", "<p>Newly-created apps begin in <b>development mode</b> .</p>")).toBe(true);
  });
  it("rejects paraphrases", () => {
    expect(quoteAppears("Restricted scopes require a third-party security audit.", page)).toBe(false);
  });
  it("ignores script contents and very short quotes", () => {
    expect(quoteAppears("fake quote here", page)).toBe(false);
    expect(quoteAppears("weeks", page)).toBe(false);
  });
});
