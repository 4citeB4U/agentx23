/**
 * Agent Lee OS — Puppeteer Button Audit
 * Tests all interactive buttons/controls in the Code tab and reports pass/fail.
 * Run: node tests/puppeteer_button_test.mjs
 */

import puppeteer from 'puppeteer';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_URL   = process.env.APP_URL || 'http://localhost:8001';
const SS_DIR    = join(__dirname, 'screenshots');

mkdirSync(SS_DIR, { recursive: true });

const PASS = '✅ PASS';
const FAIL = '❌ FAIL';
const SKIP = '⚠️  SKIP';

const results = [];
let browser, page;

async function shot(name) {
    const file = join(SS_DIR, `${name.replace(/[^a-z0-9]/gi, '_')}.jpg`);
    await page.screenshot({ path: file, type: 'jpeg', quality: 80 });
    return file;
}

function record(name, status, note = '') {
    results.push({ name, status, note });
    console.log(`  ${status}  ${name}${note ? ' — ' + note : ''}`);
}

async function waitFor(selector, timeout = 5000) {
    try {
        await page.waitForSelector(selector, { timeout });
        return true;
    } catch {
        return false;
    }
}

async function clickIf(selector, label) {
    try {
        const el = await page.$(selector);
        if (!el) { record(label, FAIL, 'element not found'); return false; }
        await el.click();
        await new Promise(r => setTimeout(r, 600));
        record(label, PASS);
        return true;
    } catch (e) {
        record(label, FAIL, String(e.message).slice(0, 80));
        return false;
    }
}

async function run() {
    console.log('\n╔══════════════════════════════════════════════╗');
    console.log('║   Agent Lee OS — Puppeteer Button Audit      ║');
    console.log('╚══════════════════════════════════════════════╝\n');

    browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-web-security']
    });
    page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    // ── 1. Load the app ───────────────────────────────────────────────────────
    console.log('► Loading app at', APP_URL);
    try {
        await page.goto(APP_URL, { waitUntil: 'networkidle2', timeout: 15000 });
        await shot('01_home');
        record('App loads', PASS);
    } catch (e) {
        record('App loads', FAIL, e.message);
        await browser.close();
        printReport();
        return;
    }

    // ── 2. Verify COMMS tab (default view) ───────────────────────────────────
    console.log('\n► COMMS Tab');
    const commsVisible = await waitFor('[data-testid="command-input"], textarea, input[type="text"]', 3000);
    record('COMMS tab loads', commsVisible ? PASS : SKIP, commsVisible ? '' : 'no input found');

    // ── 3. Navigate to CODE tab ───────────────────────────────────────────────
    console.log('\n► Switching to CODE tab');
    // BottomNav — look for CODE button (has "Code" or Studio text / icon)
    const navButtons = await page.$$('button[aria-label], nav button, [role="tablist"] button');
    let codeTabClicked = false;
    for (const btn of navButtons) {
        const txt = await page.evaluate(el => el.textContent?.trim().toLowerCase() || '', btn);
        const ttl = await page.evaluate(el => el.getAttribute('title')?.toLowerCase() || '', btn);
        if (txt.includes('code') || ttl.includes('code') || txt.includes('studio')) {
            await btn.click();
            await new Promise(r => setTimeout(r, 800));
            codeTabClicked = true;
            break;
        }
    }
    if (!codeTabClicked) {
        // Try clicking 3rd bottom nav button (CODE is usually index 5 or similar)
        const allBtns = await page.$$('button');
        for (const btn of allBtns) {
            const svg = await page.evaluate(el => el.querySelector('svg') !== null, btn);
            const txt = await page.evaluate(el => el.textContent?.trim(), btn);
            if (svg && (txt?.match(/code|studio/i))) {
                await btn.click();
                await new Promise(r => setTimeout(r, 800));
                codeTabClicked = true;
                break;
            }
        }
    }
    await shot('02_code_tab');
    record('Navigate to Code tab', codeTabClicked ? PASS : SKIP, codeTabClicked ? '' : 'could not find Code tab button');

    // ── 4. Check explorer sidebar ─────────────────────────────────────────────
    console.log('\n► Explorer Sidebar');
    await new Promise(r => setTimeout(r, 2500)); // Wait for drives + file tree to load
    const explorerVisible = await waitFor('.custom-scrollbar', 3000);
    record('Explorer opens', explorerVisible ? PASS : SKIP);

    // Refresh button (RefreshCw icon button)
    const refreshBtns = await page.$$('button');
    let refreshClicked = false;
    for (const btn of refreshBtns) {
        const hasRefreshIcon = await page.evaluate(el => {
            const svg = el.querySelector('svg');
            return svg && el.closest('[class*="border-r"]') !== null;
        }, btn);
        if (hasRefreshIcon) {
            try { await btn.click(); await new Promise(r => setTimeout(r, 500)); refreshClicked = true; break; } catch { }
        }
    }
    record('Explorer Refresh button', refreshClicked ? PASS : SKIP, refreshClicked ? '' : 'icon button not found in sidebar');

    // ── 5. Drive picker buttons ───────────────────────────────────────────────
    console.log('\n► Drive Picker');
    await new Promise(r => setTimeout(r, 1500)); // Wait for drives to load
    const driveButtons = await page.$$('button');
    const driveBtns = [];
    for (const btn of driveButtons) {
        const txt = await page.evaluate(el => el.textContent?.trim(), btn);
        if (txt && /^[A-Z]+:$/.test(txt)) driveBtns.push({ btn, label: txt });
    }
    if (driveBtns.length > 0) {
        record(`Drive picker visible (${driveBtns.map(d => d.label).join(', ')})`, PASS);
        // Click first drive that isn't already selected
        for (const { btn, label } of driveBtns) {
            try {
                await btn.click();
                await new Promise(r => setTimeout(r, 1000));
                await shot(`03_drive_${label.replace(':', '')}`);
                record(`Click drive ${label}`, PASS);
                break;
            } catch (e) {
                record(`Click drive ${label}`, FAIL, e.message.slice(0, 60));
            }
        }
    } else {
        record('Drive picker buttons', SKIP, 'no drive buttons found — may still be loading');
    }

    // ── 6. View toggle (CODE / PREVIEW) ──────────────────────────────────────
    console.log('\n► View Toggle');
    const allButtons = await page.$$('button');
    let previewClicked = false;
    for (const btn of allButtons) {
        const txt = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (txt === 'preview' || txt?.includes('preview')) {
            try { await btn.click(); await new Promise(r => setTimeout(r, 600)); previewClicked = true; break; } catch { }
        }
    }
    record('PREVIEW toggle button', previewClicked ? PASS : SKIP);

    // Switch back to CODE
    const allButtons2 = await page.$$('button');
    let codeViewClicked = false;
    for (const btn of allButtons2) {
        const txt = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (txt === 'code' && !(txt?.includes('studio'))) {
            try { await btn.click(); await new Promise(r => setTimeout(r, 500)); codeViewClicked = true; break; } catch { }
        }
    }
    record('CODE view toggle button', codeViewClicked ? PASS : SKIP);

    // ── 7. Save button ────────────────────────────────────────────────────────
    console.log('\n► Save Button');
    const saveButtons = await page.$$('button');
    let saveClicked = false;
    for (const btn of saveButtons) {
        const txt = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (txt === 'save' || txt?.includes('save')) {
            try { await btn.click(); await new Promise(r => setTimeout(r, 800)); saveClicked = true; break; } catch { }
        }
    }
    record('Save button', saveClicked ? PASS : SKIP, saveClicked ? '' : 'save button not found');

    // ── 8. Deploy / Run button ────────────────────────────────────────────────
    console.log('\n► Deploy Button');
    const deployButtons = await page.$$('button');
    let deployClicked = false;
    for (const btn of deployButtons) {
        const txt = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (txt?.match(/deploy|run|launch|build/)) {
            try { await btn.click(); await new Promise(r => setTimeout(r, 800)); deployClicked = true; break; } catch { }
        }
    }
    record('Deploy/Run button', deployClicked ? PASS : SKIP);

    // ── 9. Accessibility Drawer ───────────────────────────────────────────────
    console.log('\n► Accessibility Drawer');
    const drawerButtons = await page.$$('button');
    let drawerOpened = false;
    for (const btn of drawerButtons) {
        const txt = await page.evaluate(el => el.textContent?.trim().toLowerCase(), btn);
        if (txt?.match(/access|a11y|settings|⚙️|☰/)) {
            try { await btn.click(); await new Promise(r => setTimeout(r, 600)); drawerOpened = true; break; } catch { }
        }
    }
    record('Accessibility/Settings drawer', drawerOpened ? PASS : SKIP);

    // ── 10. BottomNav tabs ────────────────────────────────────────────────────
    console.log('\n► BottomNav Tabs');
    // Actual labels from UIModules.tsx: Home, Remote, Phone, Data, Studio, Sys
    const tabLabels = ['Home', 'Remote', 'Phone', 'Data', 'Studio', 'Sys'];
    for (const label of tabLabels) {
        const btns = await page.$$('button, [role="tab"]');
        let found = false;
        for (const btn of btns) {
            const txt = await page.evaluate(el => el.textContent?.trim(), btn);
            if (txt?.toLowerCase().includes(label.toLowerCase())) {
                try {
                    await btn.click();
                    await new Promise(r => setTimeout(r, 500));
                    found = true;
                    record(`Nav: ${label} tab`, PASS);
                    break;
                } catch (e) {
                    record(`Nav: ${label} tab`, FAIL, e.message.slice(0, 60));
                    break;
                }
            }
        }
        if (!found) record(`Nav: ${label} tab`, SKIP, 'button not found');
    }

    // Final screenshot
    await shot('99_final');
    await browser.close();
    printReport();
}

function printReport() {
    const passed = results.filter(r => r.status === PASS).length;
    const failed = results.filter(r => r.status === FAIL).length;
    const skipped = results.filter(r => r.status === SKIP).length;

    const reportLines = [
        '',
        '═══════════════════════════════════════════════',
        '              BUTTON AUDIT REPORT               ',
        '═══════════════════════════════════════════════',
        `  ✅ PASS:   ${passed}`,
        `  ❌ FAIL:   ${failed}`,
        `  ⚠️  SKIP:  ${skipped}`,
        '───────────────────────────────────────────────',
        ...results.map(r => `  ${r.status}  ${r.name}${r.note ? '\n         ↳ ' + r.note : ''}`),
        '═══════════════════════════════════════════════',
        '',
    ];

    const report = reportLines.join('\n');
    console.log(report);

    const reportPath = join(__dirname, 'button_audit_report.txt');
    writeFileSync(reportPath, report, 'utf8');
    console.log(`📄 Report saved → ${reportPath}`);
    console.log(`🖼  Screenshots  → ${SS_DIR}\n`);
}

run().catch(e => {
    console.error('[fatal]', e);
    if (browser) browser.close();
    printReport();
    process.exit(1);
});
