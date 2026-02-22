/**
 * TunnelService — Manages cloudflared / ngrok tunnel processes.
 * Spawns, monitors, and terminates tunnel child-processes.
 * Parses the live URL out of stdout/stderr and exposes it via getStatus().
 */

import { ChildProcess, spawn } from 'child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

export type TunnelProvider = 'cloudflare' | 'ngrok';

export interface TunnelStatus {
    running: boolean;
    provider: TunnelProvider | null;
    url: string | null;
    customDomain: string | null;
    log: string[];          // last 30 lines
    startedAt: string | null;
    pid: number | null;
}

const ROOT = join(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), '../../..');
const LOG_PATH = join(ROOT, 'workspace/cloudflared.log');
const URL_PATH = join(ROOT, 'workspace/tunnel_url.txt');

// Regexes to extract the public URL from output
// Only match actual tunnel hostnames, not the cloudflare.com TOS links in the log
const CF_URL_RE = /https:\/\/[a-z0-9-]+\.trycloudflare\.com(?=[\s|"']|$)/i;
const CF_NAMED_RE = /https:\/\/[a-zA-Z0-9-]+\.leewayinnovations\.io/i;
const CF_UUID_RE = /https:\/\/[a-f0-9-]{36}\.cfargotunnel\.com/i;
const NGROK_URL_RE = /https:\/\/[a-zA-Z0-9-]+\.ngrok[-a-zA-Z0-9.]*\.(app|dev|io|com)(?=[\s|"']|$)/i;

// Named tunnel name and ID registered via 'cloudflared tunnel login + create'
const NAMED_TUNNEL = 'agent-lee';

class TunnelServiceClass {
    private proc: ChildProcess | null = null;
    private _status: TunnelStatus = {
        running: false,
        provider: null,
        url: null,
        customDomain: null,
        log: [],
        startedAt: null,
        pid: null,
    };

    getStatus(): TunnelStatus {
        return { ...this._status, log: [...this._status.log] };
    }

    async start(provider: TunnelProvider, customDomain?: string): Promise<TunnelStatus> {
        if (this._status.running) await this.stop();

        this._status = {
            running: true,
            provider,
            url: null,
            customDomain: customDomain || null,
            log: [`[${new Date().toISOString()}] Starting ${provider} tunnel…`],
            startedAt: new Date().toISOString(),
            pid: null,
        };

        // Clear log file
        try { writeFileSync(LOG_PATH, ''); } catch { /* ok */ }

        const { cmd, args } = this._buildCommand(provider, customDomain);
        const child = spawn(cmd, args, {
            shell: false,
            stdio: ['ignore', 'pipe', 'pipe'],
            env: { ...process.env },
        });

        this.proc = child;
        this._status.pid = child.pid ?? null;

        const onData = (chunk: Buffer) => {
            const text = chunk.toString();
            // Write to log file
            try { appendFileSync(LOG_PATH, text); } catch { /* ok */ }

            // Try to extract URL
            if (!this._status.url) {
                const match = CF_URL_RE.exec(text) || CF_NAMED_RE.exec(text) || CF_UUID_RE.exec(text) || NGROK_URL_RE.exec(text);
                if (match) {
                    this._status.url = match[0];
                    try { writeFileSync(URL_PATH, this._status.url); } catch { /* ok */ }
                    this._appendLog(`[TUNNEL ACTIVE] ${this._status.url}`);
                }
            }

            // Keep last 30 log lines
            const lines = text.split('\n').filter(Boolean);
            for (const line of lines) this._appendLog(line);
        };

        child.stdout?.on('data', onData);
        child.stderr?.on('data', onData);

        child.on('exit', (code) => {
            this._appendLog(`[EXIT] process exited with code ${code}`);
            this._status.running = false;
            this.proc = null;
        });

        return this.getStatus();
    }

    async stop(): Promise<void> {
        if (this.proc) {
            this.proc.kill('SIGTERM');
            // Windows fallback
            try {
                const { execSync } = await import('child_process');
                if (this._status.pid) execSync(`taskkill /F /PID ${this._status.pid} /T`, { stdio: 'ignore' });
            } catch { /* ok */ }
            this.proc = null;
        }
        this._status.running = false;
        this._status.url = null;
        this._status.pid = null;
        this._appendLog('[STOPPED]');
    }

    /** Read saved URL from disk (persists across restarts) */
    getSavedUrl(): string | null {
        try {
            const saved = readFileSync(URL_PATH, 'utf8').trim();
            return saved.startsWith('https://') ? saved : null;
        } catch { return null; }
    }

    private _buildCommand(provider: TunnelProvider, customDomain?: string): { cmd: string; args: string[] } {
        if (provider === 'cloudflare') {
            const binary = 'C:\\Tools\\cloudflared.exe';
            if (customDomain) {
                // Named tunnel with custom domain route (requires DNS CNAME set in Cloudflare dashboard)
                // Step 1: cloudflared tunnel route dns agent-lee <customDomain>
                // Step 2: this will run the named tunnel for that domain
                return {
                    cmd: binary,
                    args: ['tunnel', 'run', NAMED_TUNNEL],
                };
            }
            // Quick tunnel — random trycloudflare.com URL, no DNS route required
            // To use named tunnel with a custom hostname, set a Cloudflare DNS route first:
            //   cloudflared tunnel route dns agent-lee <subdomain>.yourdomain.com
            // Then change these args to: ['tunnel', 'run', NAMED_TUNNEL]
            return {
                cmd: binary,
                args: ['tunnel', '--url', 'http://localhost:8001'],
            };
        } else {
            // ngrok
            const args = ['http', '8001', '--log=stdout'];
            if (customDomain) args.push(`--domain=${customDomain}`);
            return { cmd: 'ngrok', args };
        }
    }

    private _appendLog(line: string) {
        this._status.log.push(line);
        if (this._status.log.length > 50) this._status.log = this._status.log.slice(-50);
    }
}

export const TunnelService = new TunnelServiceClass();
