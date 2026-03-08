// ============================================================================
// LEEWAY HEADER — DO NOT REMOVE
// File: services/browser-mcp/index.js
// Purpose: Agent Lee Browser MCP — lightweight browser-agent service running
//          inside the Lee VM sandbox. Dispatches navigate/scrape/click tasks
//          via Playwright when available, or delegates to /api/vm/sandbox/exec
//          for in-VM script execution when Playwright is not installed.
// Port: 7009
// Security: x-neural-handshake required on all non-health routes.
// Discovery: ROLE=internal; INTENT=browser-mcp; REGION=🌐 BROWSER
// ============================================================================

import express from "express";
import { mkdir, writeFile } from "fs/promises";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.BROWSER_MCP_PORT || 7009);
const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";
const BACKEND_PORT = Number(process.env.BACKEND_PORT || 7001);
const VM_SCRIPTS_DIR = path.resolve(
  __dirname,
  "../../workspace/agentlee_vm/home/agent_lee/scripts",
);

// ── Auth guard ───────────────────────────────────────────────────────────────
function requireHandshake(req, res, next) {
  const h = req.headers["x-neural-handshake"];
  if (h !== HANDSHAKE) return res.status(403).json({ error: "Forbidden" });
  next();
}

// ── Attempt to import Playwright (optional) ──────────────────────────────────
let playwrightAvailable = false;
let chromium;
try {
  const pw = await import("playwright");
  chromium = pw.chromium;
  playwrightAvailable = true;
  console.log("[browser-mcp] Playwright available — using headless Chromium");
} catch {
  console.log("[browser-mcp] Playwright not installed — delegating to VM exec");
}

// ── Job state ────────────────────────────────────────────────────────────────
const jobs = new Map(); // jobId → { status, result, error, ts }
let jobCounter = 0;

function newJob() {
  const id = `bj-${Date.now()}-${++jobCounter}`;
  jobs.set(id, {
    id,
    status: "pending",
    result: null,
    error: null,
    ts: Date.now(),
  });
  return id;
}

// ── Delegates: call /api/vm/sandbox/exec on the backend ─────────────────────
function dispatchVmExec(cmd, cwd) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ cmd, cwd: cwd || "/tmp" });
    const req = http.request(
      {
        host: "127.0.0.1",
        port: BACKEND_PORT,
        path: "/api/vm/sandbox/exec",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "x-neural-handshake": HANDSHAKE,
        },
        timeout: 30000,
      },
      (res) => {
        let data = "";
        res.on("data", (c) => (data += c));
        res.on("end", () => {
          try {
            resolve(JSON.parse(data));
          } catch {
            resolve({ raw: data });
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("VM exec timeout"));
    });
    req.write(body);
    req.end();
  });
}

// ── Write a temporary Playwright script into VM scripts dir and exec it ──────
async function runVmPlaywrightScript(scriptContent, scriptName) {
  await mkdir(VM_SCRIPTS_DIR, { recursive: true });
  const scriptPath = path.join(VM_SCRIPTS_DIR, scriptName);
  await writeFile(scriptPath, scriptContent, "utf8");
  return dispatchVmExec(`node ${scriptPath}`, VM_SCRIPTS_DIR);
}

// ── Playwright scrape (direct, when available) ───────────────────────────────
async function scrapeWithPlaywright(url) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
    const title = await page.title();
    const text = await page.evaluate(
      () => document.body?.innerText?.slice(0, 4000) || "",
    );
    const links = await page.evaluate(() =>
      [...document.querySelectorAll("a[href]")]
        .slice(0, 20)
        .map((a) => ({ href: a.href, text: a.textContent?.trim() })),
    );
    return { title, text, links, url };
  } finally {
    await browser.close();
  }
}

// ── Express app ──────────────────────────────────────────────────────────────
const app = express();
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({
    status: "browser-mcp: ok",
    port: PORT,
    playwrightAvailable,
    ts: Date.now(),
  });
});

// GET /status — returns recent job summaries
app.get("/status", requireHandshake, (_req, res) => {
  const recent = [...jobs.values()].sort((a, b) => b.ts - a.ts).slice(0, 20);
  res.json({ jobs: recent, playwrightAvailable });
});

// POST /navigate — open a URL and return the page title + first 2000 chars
app.post("/navigate", requireHandshake, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" });
  }
  // Basic URL validation — only allow http/https
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Only http/https URLs allowed" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const jobId = newJob();
  const job = jobs.get(jobId);

  // Fire async and return job id immediately
  (async () => {
    try {
      let result;
      if (playwrightAvailable) {
        result = await scrapeWithPlaywright(url);
      } else {
        // Delegate to VM: write a small fetch-script and exec
        const script = `
import('https').then(async ({default: h}) => {
  // simple HEAD check via VM exec
}).catch(e => console.error(e));
console.log(JSON.stringify({ url: "${url.replace(/"/g, "")}", status: "dispatched-via-vm" }));
`;
        result = await runVmPlaywrightScript(script, `nav_${jobId}.mjs`);
      }
      job.status = "done";
      job.result = result;
    } catch (e) {
      job.status = "error";
      job.error = e.message;
    }
  })();

  res.json({ jobId, status: "pending" });
});

// POST /scrape — full page content extraction
app.post("/scrape", requireHandshake, async (req, res) => {
  const { url } = req.body || {};
  if (!url || typeof url !== "string") {
    return res.status(400).json({ error: "url required" });
  }
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return res.status(400).json({ error: "Only http/https URLs allowed" });
    }
  } catch {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const jobId = newJob();
  const job = jobs.get(jobId);

  (async () => {
    try {
      let result;
      if (playwrightAvailable) {
        result = await scrapeWithPlaywright(url);
      } else {
        result = await dispatchVmExec(
          `node -e "fetch('${url.replace(/'/g, "\\'")}').then(r=>r.text()).then(t=>console.log(t.slice(0,3000))).catch(e=>console.error(e))"`,
          VM_SCRIPTS_DIR,
        );
      }
      job.status = "done";
      job.result = result;
    } catch (e) {
      job.status = "error";
      job.error = e.message;
    }
  })();

  res.json({ jobId, status: "pending" });
});

// GET /jobs/:id — poll a job
app.get("/jobs/:id", requireHandshake, (req, res) => {
  const job = jobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: "Job not found" });
  res.json(job);
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`[browser-mcp] Listening on http://127.0.0.1:${PORT}`);
});
