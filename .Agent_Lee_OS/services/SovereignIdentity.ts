/*
LEEWAY HEADER — DO NOT REMOVE

REGION: CORE
TAG: CORE.SDK.SOVEREIGNIDENTITY.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = SovereignIdentity module
WHY = Part of CORE region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\services\SovereignIdentity.ts
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/


/**
 * SOVEREIGN IDENTITY LIBRARY (Frontend Port)
 * Handles device enrollment and HMAC-SHA256 request signing.
 */

export class SovereignIdentity {
    private static STORAGE_KEY = 'agent_lee_identity';

    static async getIdentity() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        if (!data) return null;

        const identity = JSON.parse(data);
        if (identity?.deviceId === 'MOBILE__ACCESS') {
            const normalized = { ...identity, deviceId: 'MOBILE_ACCESS' };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(normalized));
            return normalized;
        }

        return identity;
    }

    static async enroll(deviceId: string, secret: string) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ deviceId, secret }));
    }

    /**
     * CRYSTOGRAPHIC SIGNATURE GENERATOR
     * Core of the Stage 2 security protocol.
     */
    static async signRequest(body: any): Promise<{
        'x-device-id': string;
        'x-neural-signature': string;
        'x-neural-timestamp': string;
        'x-neural-nonce': string;
        'ngrok-skip-browser-warning': string;
    }> {
        const identity = await this.getIdentity();
        if (!identity) throw new Error('IDENTITY_NOT_ENROLLED');

        const timestamp = Date.now().toString();
        const nonce = (Math.random().toString(36) + Date.now().toString(36)).substring(2);
        const bodyStr = JSON.stringify(body);

        // Use Web Crypto API instead of Node crypto for browser compatibility
        const message = bodyStr + timestamp + nonce;
        const signature = await this.hmacSha256(message, identity.secret);

        return {
            'x-device-id': identity.deviceId,
            'x-neural-signature': signature,
            'x-neural-timestamp': timestamp,
            'x-neural-nonce': nonce,
            'ngrok-skip-browser-warning': 'true'  // Skip Ngrok interstitial page
        };
    }

    private static async hmacSha256(message: string, secret: string): Promise<string> {
        const encoder = new TextEncoder();
        const keyData = encoder.encode(secret);
        const msgData = encoder.encode(message);

        const key = await window.crypto.subtle.importKey(
            'raw',
            keyData,
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign']
        );

        const signatureBuffer = await window.crypto.subtle.sign('HMAC', key, msgData);
        return Array.from(new Uint8Array(signatureBuffer))
            .map(b => b.toString(16).padStart(2, '0'))
            .join('');
    }
}
