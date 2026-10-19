import { defineConfig } from "vitest/config";

// Unit tests live next to the code; tests/ holds Playwright suites.
export default defineConfig({ test: { include: ["lib/**/*.test.ts"] } });
