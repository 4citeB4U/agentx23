// LEEWAY HEADER BLOCK
// File: playwright.config.ts
// Purpose: Playwright E2E test configuration for Agent Lee OS
// Security: LEEWAY-CORE-2026 compliant
// Performance: Optimized for sovereign agentic E2E testing
// Discovery: Part of Agent Lee OS test pipeline
/* ============================================================================
LEEWAY HEADER — DO NOT REMOVE
PROFILE: LEEWAY-ORDER
TAG: CORE.CONFIG.PLAYWRIGHT.TEST
REGION: 🟢 CORE
STACK: LANG=ts; FW=none; UI=none; BUILD=node
RUNTIME: node
TARGET: test-config

DISCOVERY_PIPELINE:
  MODEL=Voice>Intent>Location>Vertical>Ranking>Render;
  ROLE=support;
  INTENT_SCOPE=n/a;
  LOCATION_DEP=none;
  VERTICALS=n/a;
  RENDER_SURFACE=n/a;
  SPEC_REF=LEEWAY.v12.DiscoveryArchitecture

LEEWAY-LD:
{
  "@context": ["https://schema.org", {"leeway":"https://leeway.dev/ns#"}],
  "@type": "SoftwareSourceCode",
  "name": "Playwright Config",
  "programmingLanguage": "TypeScript",
  "runtimePlatform": "node",
  "about": ["LEEWAY"],
  "identifier": "CORE.CONFIG.PLAYWRIGHT.TEST",
  "license": "MIT",
  "dateModified": "2026-02-24"
}

5WH: WHAT=Playwright test config; WHY=E2E automation; WHO=Agent Lee team; WHERE=core; WHEN=2026-02-24; HOW=node
SPDX-License-Identifier: MIT
============================================================================ */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { outputFolder: "tests/e2e/reports" }], ["list"]],

  use: {
    baseURL: process.env.AGENT_LEE_URL || "http://localhost:6001",
    extraHTTPHeaders: {
      "x-neural-handshake":
        process.env.NEURAL_HANDSHAKE ||
        process.env.NEURAL_HANDSHAKE_KEY ||
        "AGENT_LEE_SOVEREIGN_V1",
    },
    trace: process.env.CI ? "on" : "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
  ],

  webServer: {
    command: "node backend/dist/index.js",
    url: "http://localhost:6001",
    env: { PORT: "6001", WS_PORT: "6003" },
    reuseExistingServer: !process.env.CI,
    timeout: 15_000,
  },
});
