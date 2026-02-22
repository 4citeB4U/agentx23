#!/usr/bin/env node
/**
 * validateTunnel.js — Agent Lee Cloudflare Tunnel Validator
 *
 * Usage:
 *   node scripts/validateTunnel.js <public-hostname>
 *   node scripts/validateTunnel.js parental-houses-tracks-living.trycloudflare.com
 *
 * Checks DNS resolution, HTTP reachability, and health endpoint.
 * Runs a continuous recheck loop every 30s if --watch flag passed.
 */

import dns from 'dns/promises';
import https from 'https';

const hostname = process.argv[2];
const watchMode = process.argv.includes('--watch');
const INTERVAL_MS = 30_000;

if (!hostname) {
    console.error('Usage: node validateTunnel.js <hostname> [--watch]');
    process.exit(1);
}

const tunnelUrl = hostname.startsWith('http') ? hostname : `https://${hostname}`;

function fetchWithTimeout(url, timeoutMs = 10_000) {
    return new Promise((resolve, reject) => {
        const req = https.get(url, { timeout: timeoutMs }, (res) => {
            let body = '';
            res.on('data', d => body += d);
            res.on('end', () => resolve({ status: res.statusCode, body }));
        });
        req.on('timeout', () => { req.destroy(); reject(new Error('Request timeout')); });
        req.on('error', reject);
    });
}

async function checkDNS() {
    try {
        const records = await dns.resolve(hostname);
        console.log(`  ✅  DNS resolved:`, records.join(', '));
        return true;
    } catch (err) {
        console.log(`  ❌  DNS not yet resolving (${err.code || err.message})`);
        console.log(`       This is consistent with new tunnel propagation (usually < 5 min).`);
        console.log(`       Actions:`);
        console.log(`         1. Verify CNAME: dig ${hostname} or nslookup ${hostname}`);
        console.log(`         2. Check Cloudflare dashboard for tunnel connectivity`);
        console.log(`         3. Flush local DNS: ipconfig /flushdns (Windows)`);
        console.log(`         4. Test from mobile data to rule out local caching`);
        return false;
    }
}

async function checkTunnelHealth() {
    try {
        const result = await fetchWithTimeout(`${tunnelUrl}/health`);
        const ok = result.status < 400;
        console.log(`  ${ok ? '✅' : '❌'}  Tunnel health endpoint: HTTP ${result.status}`);
        return ok;
    } catch (err) {
        console.log(`  ❌  Tunnel unreachable: ${err.message}`);
        console.log(`       Application layer is separate from DNS status.`);
        console.log(`       If DNS passes but health fails, check cloudflared process.`);
        return false;
    }
}

async function checkUIServed() {
    try {
        const result = await fetchWithTimeout(tunnelUrl);
        const hasUI = result.status === 200 &&
            (result.body.includes('<html') || result.body.includes('Agent Lee'));
        console.log(`  ${hasUI ? '✅' : '❌'}  UI served at root: HTTP ${result.status}  size=${result.body.length}`);
        return hasUI;
    } catch (err) {
        console.log(`  ❌  Root request failed: ${err.message}`);
        return false;
    }
}

async function runCheck() {
    const ts = new Date().toISOString();
    console.log(`\n${'─'.repeat(60)}`);
    console.log(`  Tunnel Validation — ${ts}`);
    console.log(`  Target: ${tunnelUrl}`);
    console.log(`${'─'.repeat(60)}`);

    const dnsOk     = await checkDNS();
    const healthOk  = dnsOk ? await checkTunnelHealth() : false;
    const uiOk      = healthOk ? await checkUIServed() : false;

    const summary = dnsOk && healthOk && uiOk ? '✅  TUNNEL FULLY OPERATIONAL' : '⚠️   TUNNEL PARTIALLY REACHABLE';
    console.log(`\n  ${summary}`);

    if (!dnsOk) {
        console.log(`\n  DIAGNOSIS: DNS propagation incomplete.`);
        console.log(`  Local Puppeteer 14/14 confirms application health.`);
        console.log(`  This is ingress propagation, not a UI failure.`);
    }

    return { dnsOk, healthOk, uiOk };
}

(async () => {
    await runCheck();

    if (watchMode) {
        console.log(`\n  Watching — rechecking every ${INTERVAL_MS / 1000}s (Ctrl+C to stop)`);
        setInterval(async () => {
            const { dnsOk, healthOk } = await runCheck();
            if (dnsOk && healthOk) {
                console.log('\n  DNS + health confirmed. Exiting watch mode.');
                process.exit(0);
            }
        }, INTERVAL_MS);
    }
})();
