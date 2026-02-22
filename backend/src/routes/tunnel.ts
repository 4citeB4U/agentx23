import { Router } from 'express';
import { execFile } from 'child_process';
import { TunnelService, TunnelProvider } from '../services/TunnelService.js';

export const tunnelRouter = Router();

/** GET /api/tunnel/status */
tunnelRouter.get('/status', (_req, res) => {
    res.json(TunnelService.getStatus());
});

/** POST /api/tunnel/start
 *  Body: { provider: 'cloudflare' | 'ngrok', customDomain?: string }
 */
tunnelRouter.post('/start', async (req, res) => {
    const { provider, customDomain } = req.body as {
        provider: TunnelProvider;
        customDomain?: string;
    };

    if (provider !== 'cloudflare' && provider !== 'ngrok') {
        return res.status(400).json({ error: 'provider must be "cloudflare" or "ngrok"' });
    }

    try {
        await TunnelService.start(provider, customDomain || undefined);

        // Poll up to 12s for URL to appear
        let waited = 0;
        while (!TunnelService.getStatus().url && waited < 12000) {
            await new Promise(r => setTimeout(r, 500));
            waited += 500;
        }

        res.json(TunnelService.getStatus());
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

/** POST /api/tunnel/stop */
tunnelRouter.post('/stop', async (_req, res) => {
    await TunnelService.stop();
    res.json({ ok: true });
});

/** POST /api/tunnel/telegram — send the current URL to Telegram */
tunnelRouter.post('/telegram', (_req, res) => {
    const pyPath = 'C:/Tools/Portable-VSCode-MCP-Kit/.venv/Scripts/python.exe';
    const script = 'C:/Tools/Portable-VSCode-MCP-Kit/scripts/send_telegram_link.py';

    execFile(pyPath, [script], { timeout: 15000 }, (err, stdout, stderr) => {
        if (err) {
            console.error('[tunnel/telegram] error:', err.message);
            return res.status(500).json({ error: err.message, stderr });
        }
        res.json({
            ok: true,
            output: stdout,
            url: TunnelService.getStatus().url || TunnelService.getSavedUrl()
        });
    });
});
