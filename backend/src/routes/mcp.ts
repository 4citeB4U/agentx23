import { Router } from 'express';

export const mcpRouter = Router();
const MCP_BRIDGE_PORT = Number(process.env.MCP_BRIDGE_PORT || 8002);

const MCP_TOOLING_DIR = 'c:\\Tools\\Portable-VSCode-MCP-Kit\\vscode-mcp-tooling';

// Proxy to MCP bridge server
async function callMCPBridge(mcpName: string) {
    try {
        const response = await fetch(`http://localhost:${MCP_BRIDGE_PORT}/run/${mcpName}`, {
            method: 'POST'
        });
        return await response.json();
    } catch (error: any) {
        throw new Error(`MCP bridge not available: ${error.message}`);
    }
}

async function callMCPBridgeManager(pathname: string, init?: RequestInit) {
    const url = `http://localhost:${MCP_BRIDGE_PORT}${pathname}`;
    try {
        const response = await fetch(url, init);
        const data = await response.json().catch(() => null);
        if (!response.ok) {
            const err = data?.error || data?.message || `HTTP_${response.status}`;
            throw new Error(String(err));
        }
        return data;
    } catch (error: any) {
        throw new Error(`MCP bridge not available: ${error.message}`);
    }
}

// TestSprite endpoint
mcpRouter.post('/testsprite', async (req, res) => {
    try {
        const result = await callMCPBridge('testsprite');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Playwright endpoint
mcpRouter.post('/playwright', async (req, res) => {
    try {
        const result = await callMCPBridge('playwright');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// InsForge endpoint
mcpRouter.post('/insforge', async (req, res) => {
    try {
        const result = await callMCPBridge('insforge');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Stitch endpoint
mcpRouter.post('/stitch', async (req, res) => {
    try {
        const result = await callMCPBridge('stitch');
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get MCP status
mcpRouter.get('/status', async (req, res) => {
    try {
        const health = await fetch(`http://localhost:${MCP_BRIDGE_PORT}/health`);
        const bridgeStatus = health.ok ? 'online' : 'offline';
        const manager = health.ok
            ? await callMCPBridgeManager('/status', { method: 'GET' })
            : null;

        res.json({
            bridge: { status: bridgeStatus, port: MCP_BRIDGE_PORT },
            mcps: ['testsprite', 'playwright', 'insforge', 'stitch'],
            modules: manager?.modules || null
        });
    } catch (error) {
        res.json({
            bridge: {
                status: 'offline',
                port: MCP_BRIDGE_PORT
            },
            mcps: [],
            modules: null
        });
    }
});

// Start/Stop/Logs manager endpoints
mcpRouter.post('/start/:name', async (req, res) => {
    try {
        const name = String(req.params.name || '').trim().toLowerCase();
        const result = await callMCPBridgeManager(`/start/${encodeURIComponent(name)}`, { method: 'POST' });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

mcpRouter.post('/stop/:name', async (req, res) => {
    try {
        const name = String(req.params.name || '').trim().toLowerCase();
        const result = await callMCPBridgeManager(`/stop/${encodeURIComponent(name)}`, { method: 'POST' });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

mcpRouter.get('/logs/:name', async (req, res) => {
    try {
        const name = String(req.params.name || '').trim().toLowerCase();
        const tail = Math.max(1, Math.min(500, Number(req.query.tail || 150)));
        const result = await callMCPBridgeManager(`/logs/${encodeURIComponent(name)}?tail=${tail}`, { method: 'GET' });
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});
