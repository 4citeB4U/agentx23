/**
 * HMAC Auth Middleware — Agent Lee Filesystem Protection
 *
 * Accepts EITHER:
 *  1. Legacy: x-neural-handshake header (backwards compatible)
 *  2. HMAC: x-leeway-signature + x-leeway-ts headers (signed requests)
 *
 * To generate a signed request:
 *   const ts = Date.now().toString();
 *   const body = JSON.stringify(payload);
 *   const payload = ts + body;
 *   const sig = crypto.createHmac('sha256', LEEWAY_DEVICE_SECRET).update(payload).digest('hex');
 *   headers: { 'x-leeway-ts': ts, 'x-leeway-signature': sig }
 */

import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';

const SECRET          = process.env.LEEWAY_DEVICE_SECRET || '';
const HANDSHAKE_KEY   = (process.env.NEURAL_HANDSHAKE || process.env.NEURAL_HANDSHAKE_KEY || '').trim();
const TIMESTAMP_DRIFT = 5 * 60 * 1000; // 5-minute window

export function verifyHmacOrHandshake(req: Request, res: Response, next: NextFunction) {
    const signature  = req.headers['x-leeway-signature'] as string | undefined;
    const timestamp  = req.headers['x-leeway-ts'] as string | undefined;
    const handshake  = (req.headers['x-neural-handshake'] as string | undefined)?.trim();

    // ── Path 1: HMAC signed request ───────────────────────────────────────────
    if (signature && timestamp) {
        if (!SECRET) {
            console.warn('[hmac] LEEWAY_DEVICE_SECRET not set — falling back to handshake check');
        } else {
            // Replay attack prevention: reject requests older than drift window
            const tsNum = Number(timestamp);
            if (isNaN(tsNum) || Math.abs(Date.now() - tsNum) > TIMESTAMP_DRIFT) {
                return res.status(401).json({
                    error: 'TIMESTAMP_EXPIRED',
                    detail: 'Request timestamp outside allowed window. Clock drift or replay attempt.'
                });
            }

            const body     = JSON.stringify(req.body || {});
            const payload  = timestamp + body;
            const expected = crypto
                .createHmac('sha256', SECRET)
                .update(payload)
                .digest('hex');

            // Constant-time compare to prevent timing attacks
            const sigBuf = Buffer.from(signature, 'hex');
            const expBuf = Buffer.from(expected, 'hex');
            if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
                return res.status(403).json({
                    error: 'INVALID_SIGNATURE',
                    detail: 'HMAC signature mismatch. Regenerate from LEEWAY_DEVICE_SECRET.'
                });
            }
            return next();
        }
    }

    // ── Path 2: Legacy handshake (backwards compatible) ──────────────────────
    if (HANDSHAKE_KEY && handshake === HANDSHAKE_KEY) {
        return next();
    }

    // ── Rejected ──────────────────────────────────────────────────────────────
    return res.status(401).json({
        error: 'AUTH_REQUIRED',
        detail: 'Provide x-neural-handshake header or HMAC signed headers (x-leeway-signature + x-leeway-ts).',
        modes: ['handshake', 'hmac-sha256']
    });
}

/** GET /api/system/hmac-challenge — helper for clients to test their HMAC setup */
export function hmacChallengeHandler(req: Request, res: Response) {
    const ts = Date.now().toString();
    res.json({
        timestamp: ts,
        usage: 'Sign: HMAC-SHA256(LEEWAY_DEVICE_SECRET, timestamp + JSON.stringify(body))',
        header_ts: 'x-leeway-ts',
        header_sig: 'x-leeway-signature'
    });
}
