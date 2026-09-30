import { defineConfig, devices } from "@playwright/test";
import "dotenv/config";

// These tests run against a REAL deployment with a REAL Supabase backend — they
// are not mocked. Set PLAYWRIGHT_BASE_URL to your local dev server or your
// deployed Vercel URL before running. See tests/README.md for full setup.
export default defineConfig({
  testDir: "./tests",
  globalSetup: "./tests/setup/global-setup.ts",
  globalTeardown: "./tests/setup/global-teardown.ts",
  fullyParallel: false, // seeded test data is shared and mutated across specs
  workers: 1, // must be 1, not just fullyParallel:false — otherwise separate
  // spec FILES can still run concurrently in different workers and race on the
  // same seeded case/milestones/notes.
  retries: 1,
  reporter: "html",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
