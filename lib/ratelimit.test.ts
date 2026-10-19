import { describe, expect, it } from "vitest";
import { RateLimiter } from "./ratelimit";

describe("RateLimiter", () => {
  it("allows up to the limit, then blocks, per key", () => {
    let t = 0;
    const rl = new RateLimiter(2, 1000, () => t);
    expect([rl.allow("a"), rl.allow("a"), rl.allow("a")]).toEqual([true, true, false]);
    expect(rl.allow("b")).toBe(true);
  });
  it("frees capacity once the window passes", () => {
    let t = 0;
    const rl = new RateLimiter(1, 1000, () => t);
    expect(rl.allow("a")).toBe(true);
    t = 999;
    expect(rl.allow("a")).toBe(false);
    t = 1001;
    expect(rl.allow("a")).toBe(true);
  });
});
