/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: CORE.SDK.AUDIT_ALL_SCREENS.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = audit-all-screens module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\scripts\audit-all-screens.mjs
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const outDir = path.join(rootDir, 'verify_audit');
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const startDevServer = () => {
  const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
  const devServer = spawn('node', [viteBin, '--host', '127.0.0.1', '--port', '4174'], {
    cwd: rootDir,
    shell: false,
    env: { ...process.env }
  });

  return devServer;
};

const waitForServer = (devServer) => new Promise((resolve, reject) => {
  let resolved = false;
  const timeout = setTimeout(() => {
    if (!resolved) reject(new Error('Dev server startup timeout'));
  }, 30000);

  devServer.stdout.on('data', (data) => {
    const output = data.toString();
    const clean = output.replace(/\u001b\[[0-9;]*m/g, '');
    process.stdout.write(`[DEV] ${output}`);
    if (!resolved && /127\.0\.0\.1:4174|localhost:4174/.test(clean)) {
      resolved = true;
      clearTimeout(timeout);
      resolve('http://127.0.0.1:4174');
    }
  });

  devServer.stderr.on('data', (data) => {
    process.stderr.write(`[DEV_ERR] ${data.toString()}`);
  });

  devServer.on('exit', (code) => {
    if (!resolved) {
      clearTimeout(timeout);
      reject(new Error(`Dev server exited early: ${code}`));
    }
  });
});

const run = async () => {
  const devServer = startDevServer();
  let browser;

  try {
    const url = await waitForServer(devServer);
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto(url, { waitUntil: 'networkidle2' });
    await sleep(1000);

    const tabNames = ['comms', 'live', 'files', 'code', 'system'];
    const report = [];

    for (let i = 0; i < tabNames.length; i++) {
      await page.evaluate((index) => {
        const buttons = Array.from(document.querySelectorAll('div.fixed.bottom-6 button'));
        if (buttons[index]) {
          buttons[index].dispatchEvent(new MouseEvent('click', { bubbles: true }));
        }
      }, i);

      await sleep(900);

      const filePath = path.join(outDir, `${tabNames[i]}.png`);
      await page.screenshot({ path: filePath, fullPage: true });

      const tabData = await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const letsTalkRegex = /let[\u2019']s\s+talk/i;
        const hasUnsplash = bodyText.includes('unsplash') || Array.from(document.querySelectorAll('*')).some((el) => {
          const style = window.getComputedStyle(el);
          return (style.backgroundImage || '').includes('unsplash');
        });

        const coreContainer = document.querySelector('#agent-core-container');
        const canvases = coreContainer ? coreContainer.querySelectorAll('canvas').length : 0;
        const hasLetsTalkInput = Array.from(document.querySelectorAll('input, textarea')).some((el) => {
          const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
          const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
          return letsTalkRegex.test(placeholder) || letsTalkRegex.test(ariaLabel);
        });

        return {
          title: document.title,
          hasActiveThread: bodyText.includes('Active Thread'),
          hasSecureComms: bodyText.includes('Secure Comms'),
          hasChatsLabel: bodyText.includes('Chats'),
          hasLetsTalk: hasLetsTalkInput || letsTalkRegex.test(bodyText),
          hasUnsplash,
          canvasesInCore: canvases
        };
      });

      report.push({ tab: tabNames[i], ...tabData });
    }

    const reportPath = path.join(outDir, 'report.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`AUDIT_REPORT:${reportPath}`);

    const issues = [];
    for (const row of report) {
      if (row.hasUnsplash) issues.push(`${row.tab}: static unsplash background detected`);
      if (row.hasActiveThread) issues.push(`${row.tab}: obsolete Active Thread UI still visible`);
      if (row.hasSecureComms) issues.push(`${row.tab}: old 'Secure Comms' label still visible`);
      if (row.tab === 'comms' && !row.hasLetsTalk) issues.push(`${row.tab}: input placeholder not updated to "Let's talk"`);
      if (row.tab === 'comms' && row.canvasesInCore > 1) issues.push(`${row.tab}: multiple canvases in core container (${row.canvasesInCore})`);
    }

    console.log('AUDIT_ISSUES_START');
    if (issues.length === 0) {
      console.log('none');
    } else {
      for (const issue of issues) console.log(issue);
    }
    console.log('AUDIT_ISSUES_END');
  } finally {
    if (browser) await browser.close();
    devServer.kill();
  }
};

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
