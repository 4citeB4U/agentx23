import fs from 'fs/promises';
import net from 'net';
import path from 'path';

export type AgentSystemStatus = {
    schemaVersion: '1.0';
    generatedAt: string;
    auth: {
        configured: boolean;
        present: boolean;
        valid: boolean;
    };
    ports: {
        expected: number[];
        active: Array<{ port: number; active: boolean; note?: string }>;
    };
    connectors: {
        vscode: { connected: boolean; realUrl: string | null };
        fileExplorer: { connected: boolean; gateway: string };
        desktop: { connected: boolean; port: number };
    };
    mcp: {
        bridge: { connected: boolean; port: number };
        modules: {
            testsprite: Record<string, any>;
            playwright: Record<string, any>;
            insforge: Record<string, any>;
            stitch: Record<string, any>;
        };
    };
};

const EXPECTED_PORTS = [8000, 8001, 8002, 8003, 8004, 8005] as const;
const MCP_BRIDGE_PORT = Number(process.env.MCP_BRIDGE_PORT || 8002);

function nowIso() {
    return new Date().toISOString();
}

function tcpCheck(port: number, host: string = '127.0.0.1', timeoutMs: number = 250): Promise<boolean> {
    return new Promise((resolve) => {
        const socket = new net.Socket();

        const done = (ok: boolean) => {
            try { socket.destroy(); } catch { }
            resolve(ok);
        };

        socket.setTimeout(timeoutMs);
        socket.once('connect', () => done(true));
        socket.once('timeout', () => done(false));
        socket.once('error', () => done(false));
        socket.connect(port, host);
    });
}

async function readUiRuntimeConfig(): Promise<{ vscodeReal?: string | null } | null> {
    const candidates = [
        path.resolve(process.cwd(), 'ui.runtime.json'),
        path.resolve(process.cwd(), '..', 'ui.runtime.json')
    ];

    for (const p of candidates) {
        try {
            const raw = await fs.readFile(p, 'utf8');
            return JSON.parse(raw);
        } catch {
            // ignore
        }
    }
    return null;
}

async function fetchJsonWithTimeout(url: string, timeoutMs: number = 600): Promise<any | null> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        if (!res.ok) return null;
        return await res.json().catch(() => null);
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

let cache: { atMs: number; value: AgentSystemStatus } | null = null;

export const systemStatusService = {
    async getStatus(handshakeHeader?: string): Promise<AgentSystemStatus> {
        const nowMs = Date.now();
        if (cache && nowMs - cache.atMs < 1500) {
            // auth depends on request header; recompute only auth portion
            const expected = (process.env.NEURAL_HANDSHAKE || process.env.NEURAL_HANDSHAKE_KEY || '').trim();
            const provided = (handshakeHeader || '').trim();
            const configured = Boolean(expected);
            const present = Boolean(provided);
            const valid = Boolean(configured && present && provided === expected);
            return { ...cache.value, auth: { configured, present, valid }, generatedAt: nowIso() };
        }

        const expectedHandshake = (process.env.NEURAL_HANDSHAKE || process.env.NEURAL_HANDSHAKE_KEY || '').trim();
        const provided = (handshakeHeader || '').trim();
        const auth = {
            configured: Boolean(expectedHandshake),
            present: Boolean(provided),
            valid: Boolean(expectedHandshake && provided && provided === expectedHandshake)
        };

        const activeChecks = await Promise.all(EXPECTED_PORTS.map(async (p) => ({ port: p, active: await tcpCheck(p) })));

        const runtimeCfg = await readUiRuntimeConfig();
        const vscodeReal = typeof runtimeCfg?.vscodeReal === 'string' ? runtimeCfg?.vscodeReal : null;

        const bridgeStatus = await fetchJsonWithTimeout(`http://127.0.0.1:${MCP_BRIDGE_PORT}/status`, 700);
        const modules = bridgeStatus?.modules || null;

        const value: AgentSystemStatus = {
            schemaVersion: '1.0',
            generatedAt: nowIso(),
            auth,
            ports: {
                expected: [...EXPECTED_PORTS],
                active: activeChecks
            },
            connectors: {
                vscode: { connected: Boolean(vscodeReal), realUrl: vscodeReal },
                fileExplorer: { connected: true, gateway: '/api/fs' },
                desktop: { connected: activeChecks.find((p) => p.port === 8005)?.active || false, port: 8005 }
            },
            mcp: {
                bridge: { connected: Boolean(bridgeStatus), port: MCP_BRIDGE_PORT },
                modules: {
                    testsprite: (modules?.testsprite || { running: false }),
                    playwright: (modules?.playwright || { running: false }),
                    insforge: (modules?.insforge || { running: false }),
                    stitch: (modules?.stitch || { running: false })
                }
            }
        };

        cache = { atMs: nowMs, value };
        return value;
    }
};
