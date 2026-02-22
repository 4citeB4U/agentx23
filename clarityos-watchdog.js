/**
 * ClarityOS Watchdog — clarityos-watchdog.js
 * ─────────────────────────────────────────────
 * Runs every 60 seconds via PM2.
 * Checks all ClarityOS ports are alive.
 * If any are offline → triggers PM2 restart for that process.
 * Logs everything to C:\MCP-Servers\logs\watchdog.log
 *
 * PM2 ID: 33
 * To add manually: node pm2 start clarityos-watchdog.js --name clarity-watchdog
 */

const http  = require('http');
const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

const NODE = '"C:\\Program Files\\node-v22.17.1-win-x64\\node.exe"';
const PM2  = '"C:\\Tools\\Portable-VSCode-MCP-Kit\\node_modules\\pm2\\bin\\pm2"';
const LOG  = 'C:\\MCP-Servers\\logs\\watchdog.log';
const CHECK_INTERVAL_MS = 60 * 1000; // 60 seconds

// Map port → PM2 process name
const SERVICES = {
  3500: 'clarity-chat-api',
  4101: 'mcp-chrome-devtools',
  4102: 'mcp-insforge',
  4103: 'mcp-stitch',
  4104: 'mcp-testsprite',
  4105: 'mcp-spline',
};

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  try {
    fs.mkdirSync(path.dirname(LOG), { recursive: true });
    fs.appendFileSync(LOG, line + '\n');
  } catch {}
}

function checkPort(port) {
  return new Promise(resolve => {
    const req = http.get({ hostname: '127.0.0.1', port, path: '/health', timeout: 3000 }, res => {
      let body = '';
      res.on('data', d => body += d);
      res.on('end', () => resolve({ ok: res.statusCode === 200, status: res.statusCode, body }));
    });
    req.on('error', () => resolve({ ok: false }));
    req.on('timeout', () => { req.destroy(); resolve({ ok: false }); });
  });
}

function pm2Restart(name) {
  try {
    const cmd = `${NODE} ${PM2} restart "${name}" 2>&1`;
    const out = execSync(cmd, { timeout: 15000 }).toString().trim();
    log(`[RESTART] ${name} → ${out.slice(0, 120)}`);
  } catch (e) {
    log(`[RESTART-ERR] ${name} → ${e.message.slice(0, 120)}`);
  }
}

async function runChecks() {
  const entries = Object.entries(SERVICES);
  let allOk = true;
  for (const [port, name] of entries) {
    const result = await checkPort(Number(port));
    if (!result.ok) {
      allOk = false;
      log(`[DOWN] ${name} (port ${port}) — restarting…`);
      pm2Restart(name);
    }
  }
  if (allOk) {
    log(`[OK] All ${entries.length} services healthy`);
  }
}

// Initial boot check after 10s (give PM2 time to start)
setTimeout(() => {
  log('[START] ClarityOS Watchdog online');
  runChecks();
  setInterval(runChecks, CHECK_INTERVAL_MS);
}, 10_000);
