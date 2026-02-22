import cors from 'cors';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import './env.js';
import { agentsRouter } from './routes/agents.js';
import { brainApiRouter } from './routes/brain.js';
import { chatRouter, startTelegramPolling } from './routes/chat.js';
import { deploymentRouter } from './routes/deployment.js';
import { deviceRouter } from './routes/device.js';
import { fileRouter } from './routes/files.js';
import { fsRouter } from './routes/fs.js';
import { mcpRouter } from './routes/mcp.js';
import { phoneRouter } from './routes/phone.js';
import { servicesRouter } from './routes/services.js';
import { tunnelRouter } from './routes/tunnel.js';
import { securityMiddleware } from './services/security.js';
import { setupWebSocket } from './ws.js';
import { terminalRouter, terminalWss } from './routes/terminal.js';
import { vmterminalRouter, vmterminalWss } from './routes/vmterminal.js';
import { creatorRouter } from './routes/creator.js';
import { cloudflareDeploymentRouter } from './routes/cfDeployment.js';
import { appsRouter, appsWss } from './routes/apps.js';
import { layersRouter } from './routes/layers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 8001);
const WS_PORT = Number(process.env.WS_PORT || 8003);
const app = express();

// Initialize WS
setupWebSocket(WS_PORT);

// Middleware
const ALLOWED_ORIGINS = [
    'http://localhost:8000',
    'http://localhost:8001',
    'http://localhost:5173',
    'http://127.0.0.1:8000',
    'http://127.0.0.1:8001',
    'https://zenobia-suborbiculate-facetely.ngrok-free.dev',
    'https://agentleeos.leewayinnovations.io',
    'https://agentlee.rapidwebdevelop.com',
];
const ALLOWED_ORIGIN_PATTERNS = [
    /\.trycloudflare\.com$/,
    /\.ngrok-free\.dev$/,
    /\.ngrok\.app$/,
    /\.ngrok\.io$/,
    /\.leewayinnovations\.io$/,
    /\.rapidwebdevelop\.com$/,
];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        if (ALLOWED_ORIGIN_PATTERNS.some(p => p.test(origin))) return cb(null, true);
        cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
}));
app.use(express.json());

// Creator auth routes bypass security middleware (they have their own vault-based auth)
app.use('/api/creator', creatorRouter);

app.use('/api', securityMiddleware);

// Routes
app.use('/api/files', fileRouter);
app.use('/api/fs', fsRouter);
app.use('/api/mcp', mcpRouter);
app.use('/api/services', servicesRouter);
app.use('/api/device', deviceRouter);
app.use('/api/chat', chatRouter);
app.use('/api/deployment', deploymentRouter);
app.use('/api/tunnel', tunnelRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/brain', brainApiRouter);
app.use('/api/phone', phoneRouter);
app.use('/api/terminal', terminalRouter);
app.use('/api/vmterminal', vmterminalRouter);
app.use('/api/deployment', cloudflareDeploymentRouter);
app.use('/api/apps', appsRouter);
app.use('/api/layers', layersRouter);

// Serve Static Frontend (Single-Port Mode)
const STATIC_PATH = path.join(__dirname, '../../.Agent_Lee_OS/dist');
app.use(express.static(STATIC_PATH));
app.use('/_e2e', express.static(path.join(__dirname, '../../_e2e')));
app.use('/workspace', express.static(path.join(__dirname, '../../workspace')));
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        port: PORT,
        timestamp: new Date().toISOString()
    });
});

// SPA Catch-all (Must be after API routes)
app.get('*', (req, res) => {
    if (req.path.startsWith('/api')) {
        return res.status(404).json({ error: 'API_ENDPOINT_NOT_FOUND' });
    }
    res.sendFile(path.join(STATIC_PATH, 'index.html'));
});

// Start server
const HOST = '0.0.0.0';
const httpServer = http.createServer(app);

// ── WebSocket upgrade routing (single-port, path-based) ──────────────────
httpServer.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url!, `http://localhost`);
    // Accept handshake via header OR ?handshake= query param (browsers can't set WS headers)
    const handshake = req.headers['x-neural-handshake'] || url.searchParams.get('handshake') || '';
    const HS = process.env.NEURAL_HANDSHAKE || 'AGENT_LEE_SOVEREIGN_V1';

    if (handshake !== HS) {
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
        return;
    }

    if (url.pathname === '/api/terminal/ws') {
        terminalWss.handleUpgrade(req as any, socket, head, (ws) => {
            terminalWss.emit('connection', ws, req);
        });
    } else if (url.pathname === '/api/vmterminal/ws') {
        vmterminalWss.handleUpgrade(req as any, socket, head, (ws) => {
            vmterminalWss.emit('connection', ws, req);
        });
    } else if (/^\/ws\/apps\/[^/?]+\/metrics/.test(url.pathname)) {
        appsWss.handleUpgrade(req as any, socket, head, (ws) => {
            appsWss.emit('connection', ws, req);
        });
    } else {
        socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
        socket.destroy();
    }
});

httpServer.listen(PORT, HOST, () => {
    console.log('═══════════════════════════════════════════════════════');
    console.log('   Agent Lee OS - Backend API [HARDENED]');
    console.log('═══════════════════════════════════════════════════════');
    console.log(`   Host: ${HOST}`);
    console.log(`   Port: ${PORT}`);
    console.log(`   Health: http://${HOST}:${PORT}/health`);
    console.log(`   File API: http://${HOST}:${PORT}/api/files`);
    console.log(`   MCP Proxy: http://${HOST}:${PORT}/api/mcp`);
    console.log(`   Terminal WS: ws://${HOST}:${PORT}/api/terminal/ws`);
    console.log(`   VM Terminal: ws://${HOST}:${PORT}/api/vmterminal/ws`);
    console.log('═══════════════════════════════════════════════════════');

    // Start auto-polling Telegram inbox so incoming messages are pushed to UI in real-time
    startTelegramPolling();
});
