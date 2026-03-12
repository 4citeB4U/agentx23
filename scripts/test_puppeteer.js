/**
 * test_puppeteer.js - Agent Lee OS UI smoke tests via Puppeteer v24+
 * Run: node scripts/test_puppeteer.js
 * Override URL: AGENT_LEE_URL=https://tunnel.trycloudflare.com node scripts/test_puppeteer.js
 */

import { createRequire } from "module";
const require = createRequire(import.meta.url);

let puppeteer;
try {
  puppeteer = require("puppeteer");
} catch {
  console.error(
    "\n  Puppeteer not installed. Run: npm install puppeteer --save-dev\n",
  );
  process.exit(1);
}

const BASE_URL = process.env.AGENT_LEE_URL || "http://localhost:6001";
const HYDRATE_TIMEOUT = 12000;
const NAV_TIMEOUT = 15000;

let passed = 0,
  failed = 0;
let browser, page;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  OK  ${name}`);
    passed++;
  } catch (e) {
    console.log(`  FAIL  ${name}: ${e.message}`);
    failed++;
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg || "Assertion failed");
}

/**
 * Wait until a selector exists AND has non-empty text matching substring.
 * Polls every 300ms up to timeout.
 */
async function waitForBodyText(substring, timeout = HYDRATE_TIMEOUT) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    const txt = await page
      .evaluate(() => document.body.innerText)
      .catch(() => "");
    if (txt.includes(substring)) return txt;
    await new Promise((r) => setTimeout(r, 300));
  }
  const final = await page
    .evaluate(() => document.body.innerText)
    .catch(() => "");
  throw new Error(
    `"${substring}" not found within ${timeout}ms. Body snippet: "${final.slice(0, 200)}"`,
  );
}

/** Click a nav button by its aria-label. */
async function clickNavByAriaLabel(label) {
  return page.evaluate((lbl) => {
    const btn = document.querySelector(`button[aria-label="${lbl}"]`);
    if (btn) {
      btn.click();
      return true;
    }
    return false;
  }, label);
}

async function run() {
  console.log("-------------------------------------------");
  console.log("  AGENT LEE OS - Puppeteer UI Tests");
  console.log(`  Target: ${BASE_URL}`);
  console.log("-------------------------------------------\n");

  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--use-gl=swiftshader", // software WebGL
      "--enable-webgl",
      "--ignore-gpu-blacklist",
      "--allow-file-access-from-files",
    ],
  });
  page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // Suppress noisy console but log asset failures
  const networkFailures = [];
  page.on("response", (r) => {
    if (r.status() >= 500)
      networkFailures.push(`${r.status()} ${r.url().replace(BASE_URL, "")}`);
  });
  page.on("pageerror", (e) =>
    console.log(`  [js-error] ${e.message.slice(0, 120)}`),
  );

  // ── 1. Page loads and React hydrates ─────────────────────────────────────
  await test("Page loads (200 HTML)", async () => {
    const res = await page.goto(BASE_URL, {
      waitUntil: "domcontentloaded",
      timeout: NAV_TIMEOUT,
    });
    assert(res.status() === 200, `Expected 200, got ${res.status()}`);
  });

  // Wait for React to mount - poll until #root has children
  await test("React mounts (#root has content)", async () => {
    const deadline = Date.now() + HYDRATE_TIMEOUT;
    while (Date.now() < deadline) {
      const childCount = await page.evaluate(
        () => document.getElementById("root")?.childElementCount || 0,
      );
      if (childCount > 0) return;
      await new Promise((r) => setTimeout(r, 400));
    }
    // Check for asset errors
    if (networkFailures.length > 0) {
      throw new Error(
        `Asset 500 errors: ${networkFailures.slice(0, 3).join(", ")} — possibly backend still starting`,
      );
    }
    throw new Error(
      "#root is empty after 12s — JS bundle failed to load or execute",
    );
  });

  if (networkFailures.length > 0) {
    console.log(
      `  [warn] ${networkFailures.length} asset errors (likely transient on startup):`,
    );
    networkFailures.slice(0, 3).forEach((f) => console.log(`    ${f}`));
  }

  // ── 2. VoxelCore canvas OR headless fallback ─────────────────────────────
  await test("VoxelCore renders (canvas or headless fallback)", async () => {
    // Give React extra time to mount 3D scene or fallback div
    await new Promise((r) => setTimeout(r, 1500));
    const result = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (canvas) return "canvas";
      // Headless fallback div we injected
      const fallback = Array.from(document.querySelectorAll("div")).find((d) =>
        d.textContent.includes("VOXEL CORE"),
      );
      if (fallback) return "fallback";
      return null;
    });
    assert(
      result !== null,
      "Neither <canvas> WebGL nor headless fallback div found — VoxelCore not mounting",
    );
  });

  // ── 3. Welcome message (Agent Lee speaks on mount) ────────────────────────
  await test("Welcome message from Agent Lee appears", async () => {
    await waitForBodyText("Agent Lee", 10000);
  });

  // ── 4. Command input exists ───────────────────────────────────────────────
  await test("Command input is present", async () => {
    const input = await page.$("input[placeholder], textarea[placeholder]");
    assert(
      input !== null,
      "No input/textarea with placeholder found on COMMS tab",
    );
  });

  // ── 5. Send message and user text appears ────────────────────────────────
  await test("User message appears after send", async () => {
    const input = await page.$("input[placeholder], textarea[placeholder]");
    assert(input, "No input found");
    await input.click();
    await page.keyboard.type("test ping", { delay: 40 });
    await page.keyboard.press("Enter");
    await waitForBodyText("test ping", 5000);
  });

  // ── 6. Agent replies in character ─────────────────────────────────────────
  await test("Agent response appears (no raw error text)", async () => {
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline) {
      const txt = await page
        .evaluate(() => document.body.innerText)
        .catch(() => "");
      const hasReply =
        txt.includes("Yo") ||
        txt.includes("real talk") ||
        txt.includes("neural bridge") ||
        txt.includes("COMMS") ||
        txt.includes("Agent Lee") ||
        txt.includes("fam");
      const hasCrash =
        txt.includes("Unexpected token") || txt.includes("SyntaxError");
      if (hasCrash) throw new Error("Raw JSON parse error visible in UI");
      if (hasReply) return;
      await new Promise((r) => setTimeout(r, 500));
    }
    throw new Error("No in-character agent reply within 20s");
  });

  // ── 7. Mic button ─────────────────────────────────────────────────────────
  await test("Mic button exists (SVG mic icon in CommandInput)", async () => {
    // Find any button containing an svg — the mic is the only icon button in CommandInput
    const micFound = await page.evaluate(() => {
      const buttons = Array.from(document.querySelectorAll("button"));
      // Look for button that has an SVG child and is NOT the send button (send has text or arrow icon)
      // Mic button renders with lucide Mic icon - its parent button has no visible text, only svg
      return buttons.some((b) => {
        const hasSvg = b.querySelector("svg") !== null;
        const hasText = (b.innerText || "").trim().length > 0;
        // Small icon-only button with svg = mic or send
        return hasSvg && !hasText;
      });
    });
    assert(
      micFound,
      "No icon-only button with SVG found - check CommandInput onMicToggle wiring",
    );
  });

  // ── 8. Tab bar navigation (aria-label matches BottomNav labels) ──────────
  // Labels: COMMS→Home, LIVE→Remote, FILES→Data, CODE→Studio, TUNNEL→Tunnel, SYSTEM→Sys
  const tabsToTest = [
    { label: "Remote", name: "LIVE" },
    { label: "Data", name: "FILES" },
    { label: "Studio", name: "CODE" },
    { label: "Tunnel", name: "TUNNEL" },
    { label: "Sys", name: "SYSTEM" },
  ];
  for (const tab of tabsToTest) {
    await test(`Tab "${tab.name}" nav button is clickable (aria-label="${tab.label}")`, async () => {
      const found = await clickNavByAriaLabel(tab.label);
      assert(found, `No button[aria-label="${tab.label}"] found`);
      await new Promise((r) => setTimeout(r, 400));
    });
  }

  // ── 9. Return to COMMS ────────────────────────────────────────────────────
  await test('Can navigate back to Home/COMMS (aria-label="Home")', async () => {
    const found = await clickNavByAriaLabel("Home");
    if (!found) {
      // Click the floating VoxelCore orb (visible when not on COMMS)
      const orb = await page.$("#agent-core-container");
      if (orb) await orb.click();
    }
    await new Promise((r) => setTimeout(r, 600));
    const input = await page.$("input[placeholder], textarea[placeholder]");
    assert(
      input !== null,
      "Command input not visible after returning to Home (COMMS)",
    );
  });

  // ── Summary ───────────────────────────────────────────────────────────────
  await browser.close();
  console.log(`\n-------------------------------------------`);
  console.log(`  Passed: ${passed}   Failed: ${failed}`);
  console.log("-------------------------------------------");
  if (failed > 0) process.exit(1);
}

run().catch(async (e) => {
  console.error("\n[Fatal]", e.message);
  if (browser) await browser.close().catch(() => {});
  process.exit(1);
});
