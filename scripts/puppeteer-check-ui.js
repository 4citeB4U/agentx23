// Puppeteer: generic UI smoke test for Agent Lee frontend
// Usage: npm i puppeteer && node scripts/puppeteer-check-ui.js

const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer");

import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

(async () => {
  const url = 'http://127.0.0.1:6000';
  console.log('Launching Puppeteer...');
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => logs.push({type: msg.type(), text: msg.text()}));

  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    // Puppeteer: generic UI smoke test for Agent Lee frontend
    // Usage: npm i puppeteer && node scripts/puppeteer-check-ui.js

    import fs from 'fs';
    import path from 'path';
    import puppeteer from 'puppeteer';

    (async () => {
      const url = 'http://127.0.0.1:6000';
      console.log('Launching Puppeteer...');
      const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
      const page = await browser.newPage();
      const logs = [];
      page.on('console', msg => logs.push({type: msg.type(), text: msg.text()}));

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
        console.log('Page loaded:', url);

        // Basic checks
        const btnCount = await page.$$eval('button', els => els.length);
        console.log('Buttons found:', btnCount);

        // Try to locate common UI areas
        const bottomNavExists = await page.$('.bottom-nav, [data-test="bottom-nav"], #bottom-nav') !== null;
        const micButtonExists = await page.$('.mic-button, [data-test="mic"], button[aria-label*="mic"]') !== null;
        console.log('Bottom nav present:', bottomNavExists);
        console.log('Mic button present:', micButtonExists);

        // Click up to 6 visible buttons safely in page context
        const clickResults = await page.evaluate(() => {
          const res = [];
          const btns = Array.from(document.querySelectorAll('button')).slice(0,6);
          btns.forEach((b, i) => {
            try {
              b.click();
              res.push({i, ok: true, text: (b.innerText || b.getAttribute('aria-label') || b.className || '').slice(0,50)});
            } catch (e) {
              res.push({i, ok: false, err: e.message});
            }
          });
          return res;
        });

        console.log('Click results:', clickResults);

        // Snapshot
        const out = path.resolve('scripts', 'puppeteer-screenshot.png');
        await page.screenshot({ path: out, fullPage: true });
        console.log('Screenshot saved to', out);

        // Save console logs
        fs.writeFileSync(path.resolve('scripts','puppeteer-console.json'), JSON.stringify(logs, null, 2));
        console.log('Console logs saved to scripts/puppeteer-console.json');

      } catch (err) {
        console.error('Puppeteer check failed:', err.message);
      } finally {
        await browser.close();
        console.log('Puppeteer run complete.');
      }
    })();
    console.log("Puppeteer run complete.");
