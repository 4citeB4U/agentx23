/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: CORE.SDK.VERIFY_UI_PERSONA.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = verify-ui-persona module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\scripts\verify-ui-persona.mjs
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
import path from 'path';
import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

async function runTest() {
    console.log('--- STARTING PERSONA VERIFICATION ---');

    const HINT_PORT = Number(process.env.VERIFY_UI_PORT || 4173);

    // 1. Start Dev Server — no --strictPort so vite finds the next free port
    let detectedUrl = null;
    const devServer = spawn('node', ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', String(HINT_PORT)], {
        cwd: rootDir,
        shell: true,
        env: { ...process.env, BROWSER: 'none' }
    });

    const parseViteUrl = (raw) => {
        // Strip ANSI color/bold escape codes before matching
        const stripped = raw.replace(/\x1B\[[0-9;]*m/g, '');
        const match = stripped.match(/Local:\s+(http:\/\/127\.0\.0\.1:\d+\/)/);
        if (match && !detectedUrl) {
            detectedUrl = match[1];
            console.log(`Detected server at: ${detectedUrl}`);
        }
    };

    devServer.stdout.on('data', (data) => {
        const output = data.toString();
        console.log(`[DEV_STDOUT] ${output}`);
        parseViteUrl(output);
    });

    devServer.stderr.on('data', (data) => {
        const output = data.toString();
        console.error(`[DEV_STDERR] ${output}`);
        // vite sometimes writes the ready banner to stderr
        parseViteUrl(output);
    });

    // Wait for vite to print the Local URL (up to 20 s)
    let waited = 0;
    while (!detectedUrl && waited < 20000) {
        await new Promise(r => setTimeout(r, 250));
        waited += 250;
    }
    if (!detectedUrl) {
        console.error('Vite did not print a Local URL within 20s');
        devServer.kill();
        process.exit(1);
    }
    const serverUrl = detectedUrl;

    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
        const page = await browser.newPage();

        // Catch browser logs
        page.on('console', msg => console.log(`[BROWSER_${msg.type().toUpperCase()}] ${msg.text()}`));

        // Intercept and Mock API
        await page.setRequestInterception(true);
        page.on('request', request => {
            const url = request.url();
            console.log(`[REQUEST] ${url}`);
            if (url.includes('/api/services/system-status') || url.includes('/api/services/runtime')) {
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    headers: { 'Access-Control-Allow-Origin': '*' },
                    body: JSON.stringify({
                        auth: { valid: true, configured: true },
                        ports: { active: [] },
                        mcp: { modules: {} },
                        schemaVersion: 3,
                        connectors: {
                            vscode: { connected: false },
                            fileExplorer: { connected: false, gateway: '' }
                        }
                    })
                });
            } else if (url.includes('/api/chat/tts')) {
                request.respond({
                    status: 200,
                    headers: { 'Content-Type': 'audio/mpeg', 'Access-Control-Allow-Origin': '*' },
                    body: Buffer.alloc(0)
                });
            } else if (url.includes('/api/chat')) {
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                    },
                    body: JSON.stringify({
                        id: 'agent-reply-test',
                        text: 'Agent Lee: Test sequence initiated. System integrity verified at 100%.'
                    })
                });
            } else if (url.includes('/api/device/screenshot')) {
                // 1x1 JPEG (valid) to keep RemoteView online during UI verification.
                const jpegBase64 = '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCABkAGQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGhAP/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCIf/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8BI//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8BI//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8CI//Z';
                request.respond({
                    status: 200,
                    headers: { 'Content-Type': 'image/jpeg' },
                    body: Buffer.from(jpegBase64, 'base64')
                });
            } else if (url.includes('/api/device/act')) {
                request.respond({
                    status: 200,
                    contentType: 'application/json',
                    headers: {
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                    },
                    body: JSON.stringify({ status: 'ok' })
                });
            } else {
                request.continue();
            }
        });

        console.log(`Navigating to ${serverUrl}...`);
        await page.goto(serverUrl, { waitUntil: 'networkidle2' });

        // Verify Title
        const title = await page.title();
        console.log(`Page Title: ${title}`);
        if (!title.includes('Agent Lee')) throw new Error('Title verification failed');

        // Verify Voxel Core
        const core = await page.$('#agent-core-container');
        if (!core) throw new Error('Voxel Core container not found');
        console.log('Voxel Core container detected.');

        // Test Command Input
        console.log('Testing command input...');
        // Wait for system-status poll to enable comms (mock sets auth.valid=true)
        await new Promise(r => setTimeout(r, 1500));
        await page.waitForSelector('[data-testid="command-input"]', { timeout: 12000 });
        await page.waitForFunction(
            () => !document.querySelector('[data-testid="command-input"]')?.disabled,
            { timeout: 10000 }
        );
        await page.type('[data-testid="command-input"]', 'Verify system integrity');
        await page.keyboard.press('Enter');

        // Verify the user message is echoed into the UI
        console.log('Verifying user message is visible in UI...');
        await page.waitForFunction(
            () => {
                // Check via data-testid attribute (avoids innerText scroll-clip issues)
                const userMsgs = document.querySelectorAll('[data-testid="user-message"]');
                if (userMsgs.length > 0) return true;
                // Fallback: full-document textContent (unlike innerText, never clips)
                return document.documentElement.textContent.includes('Verify system integrity');
            },
            { timeout: 15000 }
        );

        // Verify the agent reply appears
        console.log('Waiting for agent response...');
        await page.waitForFunction(
            () => {
                // Primary: look for any agent-message element after the welcome message
                const agentMsgs = document.querySelectorAll('[data-testid="agent-message"]');
                if (agentMsgs.length >= 2) return true;   // welcome + reply
                // Secondary: scan all agent-message text content
                for (const el of agentMsgs) {
                    if (el.textContent && el.textContent.includes('Test sequence initiated')) return true;
                }
                // Tertiary: full-document textContent scan
                return document.documentElement.textContent.includes('Test sequence initiated');
            },
            { timeout: 20000 }
        );

        // --- LIVE VIEW UI verification (button spacing / hit targets) ---
        const verifyRemoteControls = async (viewport, name) => {
            console.log(`Verifying LIVE controls (${name})...`);
            await page.setViewport(viewport);
            await page.click('button[aria-label="Remote"]');
            await page.waitForSelector('[data-testid="remote-control-zoom-in"]', { timeout: 12000 });
            await page.waitForSelector('[data-testid="remote-control-trackpad"]', { timeout: 12000 });

            const buttonTestIds = [
                'remote-control-zoom-out',
                'remote-control-zoom-in',
                'remote-control-send-text',
                'remote-control-aa-click',
                'remote-control-trackpad'
            ];

            const rects = await page.evaluate((ids) => {
                const getRect = (id) => {
                    const el = document.querySelector(`[data-testid="${id}"]`);
                    if (!el) return null;
                    const r = el.getBoundingClientRect();
                    return { id, x: r.x, y: r.y, w: r.width, h: r.height };
                };
                return ids.map(getRect);
            }, buttonTestIds);

            const missing = rects.filter(r => !r);
            if (missing.length) throw new Error(`Missing RemoteView controls: ${missing.map(m => m?.id).join(', ')}`);

            // Min hit target for touch: 44x44px (Apple/Microsoft guidance).
            rects.forEach((r) => {
                if (r.w < 44 || r.h < 44) {
                    throw new Error(`Control ${r.id} hit target too small (${Math.round(r.w)}x${Math.round(r.h)}).`);
                }
            });

            // No overlap between control buttons.
            for (let i = 0; i < rects.length; i++) {
                for (let j = i + 1; j < rects.length; j++) {
                    const a = rects[i];
                    const b = rects[j];
                    const overlap = !(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y);
                    if (overlap) throw new Error(`Controls overlap: ${a.id} overlaps ${b.id}`);
                }
            }
        };

        await verifyRemoteControls({ width: 390, height: 844, deviceScaleFactor: 2 }, 'mobile');
        await verifyRemoteControls({ width: 1280, height: 720, deviceScaleFactor: 1 }, 'desktop');

        console.log('--- PERSONA VERIFICATION SUCCESSFUL ---');
        process.exit(0);

    } catch (err) {
        console.error('--- PERSONA VERIFICATION FAILED ---');
        console.error(err);
        process.exit(1);
    } finally {
        await browser.close();
        devServer.kill();
    }
}

runTest();
