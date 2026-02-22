/**
 * DNS Monitor Service — Agent Lee Ingress Watcher
 *
 * Polls public hostname DNS resolution every 60s.
 * Reports status to backend /api/system/dns-status.
 * Auto-notifies via Telegram when DNS resolves.
 *
 * Usage: node services/dns-monitor/index.js [--hostname <host>]
 */

import dns from 'dns/promises';
import https from 'https';

const hostname   = process.env.PUBLIC_HOSTNAME || process.argv[2] || '';
const INTERVAL   = parseInt(process.env.DNS_CHECK_INTERVAL || '60000');
const TG_TOKEN   = process.env.TELEGRAM_BOT_TOKEN_2 || process.env.TELEGRAM_BOT_TOKEN || '';
const TG_CHAT    = process.env.TELEGRAM_USER_ID || '';
const BACKEND    = process.env.BACKEND_URL || 'http://localhost:8001';

if (!hostname) {
    console.log('[dns-monitor] No PUBLIC_HOSTNAME set. Waiting for tunnel to start...');
}

let lastStatus: 'unknown' | 'resolved' | 'unresolved' = 'unknown';
let resolvedSince: string | null = null;

async function checkDNS(): Promise<boolean> {
    if (!hostname) return false;
    try {
        const records = await dns.resolve(hostname);
        return records.length > 0;
    } catch {
        return false;
    }
}

async function postToBackend(status: { resolved: boolean; hostname: string; since: string | null }) {
    try {
        const body = JSON.stringify(status);
        const url = new URL('/api/system/dns-status', BACKEND);
        await fetch(url.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body
        });
    } catch {
        // Backend might not be up yet — that's ok
    }
}

async function sendTelegram(message: string) {
    if (!TG_TOKEN || !TG_CHAT) return;
    try {
        await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: TG_CHAT, text: message })
        });
    } catch { /* non-critical */ }
}

async function tick() {
    const resolved = await checkDNS();
    const ts = new Date().toISOString();

    const newStatus = resolved ? 'resolved' : 'unresolved';

    if (newStatus !== lastStatus) {
        if (resolved) {
            resolvedSince = ts;
            const msg = `Agent Lee DNS Monitor: ${hostname} is NOW RESOLVING as of ${ts}. Cloudflare tunnel is fully accessible.`;
            console.log(`[dns-monitor] ✅  ${msg}`);
            await sendTelegram(msg);
        } else {
            resolvedSince = null;
            console.log(`[dns-monitor] ❌  ${hostname} DNS not yet resolving. Propagation in progress.`);
            console.log('           Application layer health is separate from DNS status.');
        }
        lastStatus = newStatus;
    } else {
        console.log(`[dns-monitor] ${resolved ? '✅' : '⏳'}  ${hostname} — ${newStatus} (${ts})`);
    }

    await postToBackend({ resolved, hostname, since: resolvedSince });
}

console.log(`[dns-monitor] Starting. target=${hostname || 'WAITING'} interval=${INTERVAL}ms`);
tick();
setInterval(tick, INTERVAL);
