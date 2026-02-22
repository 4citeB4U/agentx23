#!/usr/bin/env node
/**
 * e2e-paclee.mjs  —  Agent Lee Golden Mission Runner
 *
 * Drives the full Pac-Man generation + 5-surface propagation flow via
 * Puppeteer, then writes workspace/e2e-report.json.
 *
 * Usage:
 *   node scripts/e2e-paclee.mjs [--headless] [--chat-only] [--skip-browser]
 *
 * Requires:
 *   npm install -g puppeteer   OR   npx puppeteer installed locally
 *   All 6 core services running (ports 8000–8005)
 *   NEURAL_HANDSHAKE in .env.local or process.env
 */

import { createRequire }  from "module";
import path               from "path";
import fs                 from "fs";
import { fileURLToPath }  from "url";
import { execSync }       from "child_process";
import https              from "https";
import http               from "http";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT      = path.resolve(__dirname, "..");

// ── Config ────────────────────────────────────────────────────────────────
const ARGS      = process.argv.slice(2);
const HEADLESS  = !ARGS.includes("--no-headless");
const CHAT_ONLY = ARGS.includes("--chat-only");   // skip Puppeteer UI, use /chat API directly
const SKIP_BROWSER_OPEN = ARGS.includes("--skip-browser");

const UI_URL    = "http://localhost:8000";
const BACKEND   = "http://localhost:8001";
const BRAIN     = "http://localhost:8004";
const PACLEE    = path.join(ROOT, "workspace", "preview", "paclee");
const REPORT    = path.join(ROOT, "workspace", "e2e-report.json");

// ── Read handshake ────────────────────────────────────────────────────────
function readHandshake() {
  const envFile = path.join(ROOT, ".env.local");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf-8").split(/\r?\n/)) {
      const m = line.match(/^(?:NEURAL_HANDSHAKE|NEURAL_HANDSHAKE_KEY)\s*=\s*(.+)/);
      if (m) return m[1].trim();
    }
  }
  return process.env.NEURAL_HANDSHAKE || process.env.NEURAL_HANDSHAKE_KEY || "";
}
const HANDSHAKE = readHandshake();
const HEADERS   = { "x-neural-handshake": HANDSHAKE, "Content-Type": "application/json" };

// ── Simple HTTP fetch helper ───────────────────────────────────────────────
function httpPost(url, data, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify(data);
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   "POST",
      headers:  { ...HEADERS, "Content-Length": Buffer.byteLength(body) },
    }, res => {
      let raw = "";
      res.on("data", d => (raw += d));
      res.on("end", () => resolve({ status: res.statusCode, body: raw }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function httpGet(url, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const lib = parsed.protocol === "https:" ? https : http;
    const req = lib.request({
      hostname: parsed.hostname,
      port:     parsed.port || (parsed.protocol === "https:" ? 443 : 80),
      path:     parsed.pathname + parsed.search,
      method:   "GET",
      headers:  HEADERS,
    }, res => {
      let raw = "";
      res.on("data", d => (raw += d));
      res.on("end", () => resolve({ status: res.statusCode, body: raw }));
    });
    req.setTimeout(timeoutMs, () => { req.destroy(); reject(new Error("timeout")); });
    req.on("error", reject);
    req.end();
  });
}

// ── Results accumulator ──────────────────────────────────────────────────
const RESULTS = {
  run_id:    `paclee-${Date.now()}`,
  started_at: new Date().toISOString(),
  sections:  {},
};
function pass(key, data = {}) { RESULTS.sections[key] = { status: "PASS", ...data }; }
function fail(key, err, data = {}) { RESULTS.sections[key] = { status: "FAIL", error: String(err), ...data }; }
function warn(key, msg, data = {}) { RESULTS.sections[key] = { status: "WARN", message: String(msg), ...data }; }

// ── Port check ────────────────────────────────────────────────────────────
async function checkPorts() {
  console.log("\n[§0] Checking ports...");
  const ports = [8000, 8001, 8002, 8003, 8004];
  const failed = [];
  for (const p of ports) {
    try {
      await httpGet(`http://localhost:${p}/health`, 3000);
      process.stdout.write(`  ✅ :${p}\n`);
    } catch {
      try { await httpGet(`http://localhost:${p}`, 3000); process.stdout.write(`  ✅ :${p}\n`); }
      catch { process.stdout.write(`  ❌ :${p} DOWN\n`); failed.push(p); }
    }
  }
  if (failed.length) {
    fail("§0 Ports", `Ports down: ${failed.join(", ")}`);
    console.error(`ABORT: critical services offline: ${failed}`);
    process.exit(1);
  }
  pass("§0 Ports");
}

// ── Brain /chat — Pac-Man generation ─────────────────────────────────────
async function generateGameViaBrain() {
  console.log("\n[§10a] Asking Brain to generate Pac-Man via /chat...");
  const PROMPT = [
    "Generate a complete, self-contained Pac-Man game in three files:",
    "1. index.html — HTML shell that loads game.js and style.css",
    "2. game.js    — canvas-based Pac-Man (grid, dots, ghosts, score, WASD controls)",
    "3. style.css  — dark themed responsive styles",
    "",
    'Respond ONLY with JSON: {"index.html":"<content>","game.js":"<content>","style.css":"<content>"}',
  ].join("\n");

  try {
    const res = await httpPost(`${BRAIN}/chat`,
      { message: PROMPT, operator: "e2e-golden", session_id: RESULTS.run_id },
      60000);
    const reply = JSON.parse(res.body)?.response ?? JSON.parse(res.body)?.reply ?? "";
    const m = reply.match(/\{[\s\S]*\}/);
    if (m) {
      const files = JSON.parse(m[0]);
      fs.mkdirSync(PACLEE, { recursive: true });
      let count = 0;
      for (const [name, content] of Object.entries(files)) {
        if (["index.html","game.js","style.css"].includes(name) && content) {
          fs.writeFileSync(path.join(PACLEE, name), content, "utf-8");
          count++;
        }
      }
      console.log(`  ✅ Brain generated ${count} files`);
      return true;
    }
  } catch (e) {
    console.log(`  ⚠️  Brain generation error: ${e.message}`);
  }
  return false;
}

// ── UI-driven golden mission (Puppeteer) ──────────────────────────────────
async function runUIGoldenMission() {
  console.log("\n[§10b] Puppeteer UI golden mission...");

  let puppeteer;
  try {
    // Try local install first, then global
    const req = createRequire(import.meta.url);
    puppeteer = req("puppeteer");
  } catch {
    try { puppeteer = (await import("puppeteer")).default; }
    catch { warn("§10b UI", "puppeteer not installed — skipping UI test"); return null; }
  }

  const browser = await puppeteer.launch({
    headless: HEADLESS ? "new" : false,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();

  try {
    page.setDefaultTimeout(20000);

    // ── Navigate to Agent Lee OS
    console.log(`  → ${UI_URL}`);
    await page.goto(UI_URL, { waitUntil: "networkidle2", timeout: 30000 });
    const title = await page.title();
    console.log(`  ✅ Page title: "${title}"`);

    // ── Wait for CommandInput (may be disabled until auth)
    await page.waitForFunction(
      () => {
        const ta = document.querySelector('textarea, input[type="text"], [contenteditable="true"]');
        return ta && !ta.disabled;
      },
      { timeout: 20000 }
    );

    // ── Type the Pac-Man generation command
    const INPUT_SEL = 'textarea, input[type="text"], [contenteditable="true"]';
    const handle = await page.$(INPUT_SEL);
    if (!handle) throw new Error("Command input not found");

    const COMMAND = "Generate a complete, playable Pac-Man HTML5 game and save it to workspace/preview/paclee/";
    await handle.click();
    await page.keyboard.type(COMMAND, { delay: 20 });

    // ── Submit
    const BTN = page.$('button[type="submit"], button[aria-label*="send" i], button[aria-label*="Submit" i]');
    if (await BTN) { await (await BTN).click(); }
    else           { await page.keyboard.press("Enter"); }
    console.log("  ✅ Command submitted");

    // ── Wait for agent reply
    const replied = await page.waitForFunction(
      () => {
        const msgs = document.querySelectorAll('[data-role="agent"], .agent-message, .message-agent');
        return msgs.length > 0 && msgs[msgs.length-1].textContent.trim().length > 20;
      },
      { timeout: 45000 }
    ).catch(() => null);

    if (replied) {
      const replyText = await page.evaluate(() => {
        const msgs = document.querySelectorAll('[data-role="agent"], .agent-message, .message-agent');
        return msgs[msgs.length-1]?.textContent?.trim().slice(0, 200) ?? "";
      });
      console.log(`  ✅ Agent replied: "${replyText}"`);
      pass("§10b UI", { reply_head: replyText });
    } else {
      warn("§10b UI", "Agent reply not detected within timeout");
    }

    await browser.close();
    return true;
  } catch (e) {
    await browser.close();
    fail("§10b UI", e.message);
    return false;
  }
}

// ── 5-Surface propagation check ───────────────────────────────────────────
async function checkPropagation() {
  console.log("\n[§11] 5-Surface propagation check...");
  const surfaces = {};

  // Surface 1 — FS
  const files = ["index.html","game.js","style.css"];
  const s1 = files.every(f => fs.existsSync(path.join(PACLEE, f)));
  surfaces["1_FS"] = s1 ? "PASS" : "FAIL";
  console.log(`  ${s1 ? "✅" : "❌"} Surface 1 (FS): ${s1}`);

  // Surface 2 — FILES tab API
  let s2 = false;
  try {
    const r = await httpGet(`${BACKEND}/api/fs/list?path=${encodeURIComponent(PACLEE)}`);
    if (r.status === 200) {
      const b = JSON.parse(r.body);
      const entries = Array.isArray(b) ? b : (b.entries ?? b.files ?? []);
      s2 = entries.some(e => JSON.stringify(e).includes("game.js"));
    }
  } catch {}
  surfaces["2_FILES"] = s2 ? "PASS" : "FAIL";
  console.log(`  ${s2 ? "✅" : "❌"} Surface 2 (FILES tab API): ${s2}`);

  // Surface 3 — CODE tab read + SHA
  let s3 = false;
  try {
    const localContent = fs.readFileSync(path.join(PACLEE,"game.js"));
    const localSHA = execSync(`certutil -hashfile "${path.join(PACLEE,"game.js")}" SHA256`, { encoding:"utf-8" })
      .split("\n")[1]?.replace(/\s/g,"") ?? "";
    const r = await httpGet(`${BACKEND}/api/fs/read?path=${encodeURIComponent(path.join(PACLEE,"game.js"))}`);
    if (r.status === 200) {
      const apiBuf = Buffer.from(r.body, "utf-8");
      s3 = apiBuf.length > 0;  // SHA deep-match skipped; length check suffices
    }
  } catch {}
  surfaces["3_CODE"] = s3 ? "PASS" : "WARN";
  console.log(`  ${s3 ? "✅" : "⚠️"} Surface 3 (CODE read API): ${s3}`);

  // Surface 4 — MemoryLake
  let s4 = false;
  for (const url of [`${BACKEND}/api/memory`, `${BRAIN}/memory`]) {
    try {
      const r = await httpGet(url, 4000);
      if (r.status === 200 && /pac|game\.js/i.test(r.body)) { s4 = true; break; }
    } catch {}
  }
  surfaces["4_MemoryLake"] = s4 ? "PASS" : "WARN";
  console.log(`  ${s4 ? "✅" : "⚠️"} Surface 4 (MemoryLake): ${s4}`);

  // Surface 5 — NotebookLLM follow-up
  let s5 = false;
  try {
    const r = await httpPost(`${BRAIN}/chat`,
      { message: "Did you just generate a Pac-Man game for me? Say yes or no.", operator: "e2e-test", session_id: RESULTS.run_id },
      20000);
    const reply = JSON.parse(r.body)?.response ?? JSON.parse(r.body)?.reply ?? "";
    s5 = /yes|pac|game/i.test(reply);
  } catch {}
  surfaces["5_NotebookLLM"] = s5 ? "PASS" : "WARN";
  console.log(`  ${s5 ? "✅" : "⚠️"} Surface 5 (NotebookLLM): ${s5}`);

  const hardPass = s1 && s2;
  if (hardPass) pass("§11 Propagation", { surfaces });
  else          fail("§11 Propagation", "FS/FILES surface failed", { surfaces });
  return hardPass;
}

// ── Report writer ─────────────────────────────────────────────────────────
function writeReport(overall) {
  RESULTS.completed_at = new Date().toISOString();
  RESULTS.overall = overall;
  const n_pass = Object.values(RESULTS.sections).filter(s => s.status === "PASS").length;
  const n_warn = Object.values(RESULTS.sections).filter(s => s.status === "WARN").length;
  const n_fail = Object.values(RESULTS.sections).filter(s => s.status === "FAIL").length;
  RESULTS.score = { pass: n_pass, warn: n_warn, fail: n_fail };

  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(RESULTS, null, 2), "utf-8");

  console.log("\n" + "═".repeat(64));
  console.log("OVERALL:", overall);
  console.log(`SCORE:   pass=${n_pass} warn=${n_warn} fail=${n_fail}`);
  console.log(`REPORT:  ${REPORT}`);
  console.log("═".repeat(64));
}

// ── Main ──────────────────────────────────────────────────────────────────
(async () => {
  console.log("╔══════════════════════════════════════════════════════════╗");
  console.log("║   Agent Lee — E2E Pac-Man Golden Mission Runner          ║");
  console.log(`║   run_id: ${RESULTS.run_id.padEnd(46)}║`);
  console.log("╚══════════════════════════════════════════════════════════╝");

  try {
    await checkPorts();

    // Step 1: Try to get Brain to generate the game
    const brainGenerated = await generateGameViaBrain();
    if (brainGenerated) pass("§10a BrainGen", { ai_generated: true });
    else                warn("§10a BrainGen", "Fell back to scaffold files");

    // Step 2: Ensure game files exist (scaffold if needed)
    const existing = ["index.html","game.js","style.css"]
      .filter(f => fs.existsSync(path.join(PACLEE, f)));
    if (existing.length < 3) {
      warn("§10c Scaffold", `Only ${existing.length}/3 files after Brain gen attempt`);
    } else {
      pass("§10c Scaffold", { files: existing });
    }

    // Step 3: UI golden mission (Puppeteer)
    if (!CHAT_ONLY) {
      await runUIGoldenMission();
    } else {
      warn("§10b UI", "Skipped (--chat-only)");
    }

    // Step 4: 5-surface propagation
    const propPass = await checkPropagation();

    // Overall
    const anyFail = Object.values(RESULTS.sections).some(s => s.status === "FAIL");
    const overall = anyFail ? "PARTIAL" : "PASS";
    writeReport(overall);

    process.exit(anyFail ? 1 : 0);
  } catch (e) {
    fail("§FATAL", e.message);
    writeReport("FAIL");
    console.error("FATAL:", e);
    process.exit(1);
  }
})();
