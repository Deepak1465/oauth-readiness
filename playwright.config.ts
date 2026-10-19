import { defineConfig } from "@playwright/test";

// Two suites:
//   oauth: a real OAuth flow and its edge cases against the fake Acme provider (fast, no AI calls)
//   agent: the guide agent researching the fake providers, scored against known answers (needs GEMINI_API_KEY in .env.local)
// Run: npx playwright test            (both)    npx playwright test --project=oauth    (fast only)

export default defineConfig({
  testDir: "tests",
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { trace: "retain-on-failure" },
  projects: [
    { name: "oauth", testMatch: /oauth\.spec\.ts/, timeout: 30_000 },
    { name: "agent", testMatch: /agent\.spec\.ts/, timeout: 240_000, retries: 1 },
  ],
  webServer: [
    {
      command: "node testbed/server.mjs",
      env: { CODE_TTL_MS: "3000" },
      url: "http://acme.localtest.me:4010/docs",
      reuseExistingServer: false,
    },
    {
      // A production build of the app on its own port, with isolated storage, so tests never touch your dev data.
      command: "npx next build && npx next start -p 3200",
      env: { GENERATED_DIR: "data/test-generated", RATE_LIMIT_PER_HOUR: "100" },
      url: "http://localhost:3200",
      timeout: 240_000,
      reuseExistingServer: false,
    },
  ],
});
