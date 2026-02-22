import { Router } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';

const PHONE_BRIDGE_PORT = Number(process.env.PHONE_BRIDGE_PORT || 8008);
const PHONE_BRIDGE_BASE = `http://127.0.0.1:${PHONE_BRIDGE_PORT}`;

export const phoneRouter = Router();

/** GET /api/phone/status
 *  Returns bridge liveness + ADB device info without hitting ADB directly.
 *  Polls ws-scrcpy's /api/devices endpoint if available.
 */
phoneRouter.get('/status', async (_req, res) => {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const r = await fetch(`${PHONE_BRIDGE_BASE}/api/devices`, { signal: controller.signal });
        clearTimeout(timeout);

        if (!r.ok) {
            return res.json({ bridgeOnline: true, deviceConnected: false, error: `devices API: ${r.status}` });
        }
        type DeviceInfo = { udid?: string; model?: string; name?: string };
        const data = await r.json() as DeviceInfo[];
        const devices: DeviceInfo[] = Array.isArray(data) ? data : [];
        const first = devices[0];
        return res.json({
            bridgeOnline: true,
            deviceConnected: devices.length > 0,
            deviceName: first ? (first.model || first.name || first.udid || 'Unknown') : undefined,
            streamUrl: first ? `${PHONE_BRIDGE_BASE}/?action=stream&udid=${first.udid}` : undefined,
        });
    } catch {
        return res.json({ bridgeOnline: false, deviceConnected: false, error: 'Bridge offline' });
    }
});

/** POST /api/phone/connect
 *  Body: { adbHost: "192.168.x.x:5555" }
 *  Forwards ADB Wi-Fi connect request to ws-scrcpy bridge.
 */
phoneRouter.post('/connect', async (req, res) => {
    const { adbHost } = req.body as { adbHost?: string };
    if (!adbHost) {
        return res.status(400).json({ ok: false, error: 'adbHost required (e.g. 192.168.1.x:5555)' });
    }
    try {
        const r = await fetch(`${PHONE_BRIDGE_BASE}/api/adb/connect`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host: adbHost }),
            signal: AbortSignal.timeout(5000),
        });
        const data = await r.json() as Record<string, unknown>;
        return res.json({ ok: r.ok, ...data });
    } catch (e: unknown) {
        return res.status(503).json({ ok: false, error: e instanceof Error ? e.message : 'Bridge timeout' });
    }
});

/** POST /api/phone/pair
 *  Body: { adbHost, pairingCode }
 *  Used for ADB wireless pairing on Android 11+.
 */
phoneRouter.post('/pair', async (req, res) => {
    const { adbHost, pairingCode } = req.body as { adbHost?: string; pairingCode?: string };
    if (!adbHost || !pairingCode) {
        return res.status(400).json({ ok: false, error: 'adbHost and pairingCode required' });
    }
    try {
        const r = await fetch(`${PHONE_BRIDGE_BASE}/api/adb/pair`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ host: adbHost, code: pairingCode }),
            signal: AbortSignal.timeout(10000),
        });
        const data = await r.json() as Record<string, unknown>;
        return res.json({ ok: r.ok, ...data });
    } catch (e: unknown) {
        return res.status(503).json({ ok: false, error: e instanceof Error ? e.message : 'Bridge timeout' });
    }
});

/** ALL /api/phone/bridge/*
 *  Transparent reverse proxy to ws-scrcpy for WebSocket upgrade + stream traffic.
 */
phoneRouter.use(
    '/bridge',
    createProxyMiddleware({
        target: PHONE_BRIDGE_BASE,
        changeOrigin: true,
        ws: true,
        pathRewrite: { '^/api/phone/bridge': '' },
    })
);
