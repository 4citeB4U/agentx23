import { exec } from 'child_process';
import { Router } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { aiService } from '../services/ai.js';
import { healthService } from '../services/health.js';
import { loggerService } from '../services/logger.js';
import { systemStatusService } from '../services/systemStatus.js';

const execAsync = promisify(exec);

export const servicesRouter = Router();

async function readRuntimeConfig(): Promise<any | null> {
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

// Runtime config (truthful bridges for REAL VS Code / Anti-Gravity URLs)
// Intended to be written by local bootstrap scripts; safe to read from UI.
servicesRouter.get('/runtime', async (req, res) => {
    try {
        const cfg = await readRuntimeConfig();
        res.json({
            updatedAt: cfg?.updatedAt || null,
            vscodeReal: cfg?.vscodeReal || null,
            antiGravityReal: cfg?.antiGravityReal || null
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get internal system telemetry (Port health + AI health)
servicesRouter.get('/telemetry', async (req, res) => {
    try {
        const systemHealth = healthService.getSystemStatus();
        const aiHealth = aiService.getHealth();

        res.json({
            ...systemHealth,
            ai: aiHealth
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Legacy status endpoint (kept for backward compatibility, but enhanced)
servicesRouter.get('/status', async (req, res) => {
    const status = healthService.getSystemStatus();
    res.json(status);
});

// Health check endpoint (lightweight check for neutral handshake verification)
servicesRouter.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString()
    });
});

// Agent System Status (schema-shaped)
// Used by UI to validate handshake and by the deterministic capabilities responder.
servicesRouter.get('/system-status', async (req, res) => {
    try {
        const handshake = typeof req.headers['x-neural-handshake'] === 'string' ? req.headers['x-neural-handshake'] : undefined;
        const status = await systemStatusService.getStatus(handshake);
        res.json(status);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
// Track mesh export
servicesRouter.post('/track-export', async (req, res) => {
    const { meshId, format } = req.body;
    await loggerService.log('export', `Mesh export: ${meshId}`, { format });
    res.json({ status: 'logged', meshId });
});

// ── System Health Aggregator (polls all layers, used by Diagnostics Panel) ──
let dnsCacheState: { resolved: boolean; hostname: string; since: string | null } | null = null;

async function pingService(url: string, timeoutMs = 4000): Promise<boolean> {
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), timeoutMs);
        const r = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        return r.ok;
    } catch {
        return false;
    }
}

servicesRouter.get('/system/health', async (req, res) => {
    const [brain, gateway, desktop, mcp] = await Promise.all([
        pingService('http://localhost:8004/health'),
        pingService('http://localhost:8101/health').catch(() => false),
        pingService('http://localhost:8005/status'),
        pingService('http://localhost:8002/health').catch(() => false)
    ]);

    res.json({
        timestamp: Date.now(),
        version: 'agent-lee-rev2',
        services: {
            backend:  true,
            brain,
            gateway,
            desktop,
            mcp
        },
        dns: dnsCacheState ? {
            hostname: dnsCacheState.hostname,
            resolved: dnsCacheState.resolved,
            since: dnsCacheState.since
        } : { resolved: null, hostname: null },
        voice: {
            state: 'PRIMARY',        // populated by ttsEnforcer when imported
            engine: 'edge-tts + Gemini Pro'
        },
        identity: 'AGENT_LEE_SOVEREIGN_V1'
    });
});

// DNS status push from dns-monitor service
servicesRouter.post('/system/dns-status', (req, res) => {
    dnsCacheState = req.body as typeof dnsCacheState;
    res.json({ ok: true });
});
