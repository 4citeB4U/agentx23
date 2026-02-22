/**
 * AGENT LEE — GUARDIAN SERVICE
 * HTTP Policy Engine | Port 9000 | LEEWAY-CORE-2026
 *
 * Standalone service that intercepts and authorizes all actions.
 * Run independently so it survives Agent Lee crashes.
 *
 * Start: npx tsx guardian/guardian-service.ts
 * Or: install as Windows Service via NSSM
 */

import { createServer } from 'http';
import { authorize, listPolicies, getPolicy } from './guardian.js';
import { analyzeCode } from './codeInspector.js';
import { verifyPin, verifyCreatorKey, generateCreatorSession, isValidCreatorSession, revokeCreatorSession, isVaultReady, initializeVault } from './creatorKeyManager.js';
import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = parseInt(process.env.GUARDIAN_PORT || '9000');
const GUARDIAN_SECRET = process.env.GUARDIAN_SECRET || 'GUARDIAN_SOVEREIGN_2026';

// Initialize vault on first run if env vars provided
if (!isVaultReady()) {
  const pin = process.env.CREATOR_PIN;
  const key = process.env.CREATOR_KEY;
  if (pin && key) {
    initializeVault(pin, key);
    console.log('[Guardian] Vault initialized from environment variables.');
    // Clear from env after use
    delete process.env.CREATOR_PIN;
    delete process.env.CREATOR_KEY;
  } else {
    console.warn('[Guardian] Vault not ready. Set CREATOR_PIN and CREATOR_KEY env vars to initialize.');
  }
}

function parseBody(req: import('http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

function respond(res: import('http').ServerResponse, status: number, data: unknown) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'X-Guardian': 'LEEWAY-CORE-2026',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function checkGuardianAuth(req: import('http').IncomingMessage): boolean {
  const authHeader = req.headers['x-guardian-secret'] as string | undefined;
  return authHeader === GUARDIAN_SECRET;
}

const server = createServer(async (req, res) => {
  const url = req.url || '/';
  const method = req.method || 'GET';

  // CORS for local UI
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8000');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Guardian-Secret, X-Creator-Session');

  if (method === 'OPTIONS') return respond(res, 200, { ok: true });

  try {
    // ─────────────────────────────────────────────────────────────────
    // GET /health  — no auth required
    // ─────────────────────────────────────────────────────────────────
    if (method === 'GET' && url === '/health') {
      return respond(res, 200, {
        status: 'GUARDIAN_ONLINE',
        port: PORT,
        timestamp: new Date().toISOString(),
        vaultReady: isVaultReady(),
        version: 'GUARDIAN-1.0'
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // GET /policies  — list all policies (requires guardian auth)
    // ─────────────────────────────────────────────────────────────────
    if (method === 'GET' && url === '/policies') {
      if (!checkGuardianAuth(req)) return respond(res, 403, { error: 'GUARDIAN_AUTH_REQUIRED' });
      return respond(res, 200, { policies: listPolicies() });
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /authorize  — core authorization endpoint
    // ─────────────────────────────────────────────────────────────────
    if (method === 'POST' && url === '/authorize') {
      if (!checkGuardianAuth(req)) return respond(res, 403, { error: 'GUARDIAN_AUTH_REQUIRED' });

      const body = await parseBody(req);
      const { action, payload = {}, creatorSignature } = body as {
        action: string;
        payload?: Record<string, unknown>;
        creatorSignature?: string;
      };

      if (!action) return respond(res, 400, { error: 'Missing action' });

      const result = authorize(action, payload as Record<string, unknown>, { creatorSignature });

      return respond(res, result.allowed ? 200 : 403, {
        action,
        ...result,
        timestamp: new Date().toISOString()
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /inspect  — code risk analysis
    // ─────────────────────────────────────────────────────────────────
    if (method === 'POST' && url === '/inspect') {
      if (!checkGuardianAuth(req)) return respond(res, 403, { error: 'GUARDIAN_AUTH_REQUIRED' });

      const body = await parseBody(req);
      const { code } = body as { code: string };

      if (!code) return respond(res, 400, { error: 'Missing code' });

      const analysis = analyzeCode(code);
      return respond(res, 200, analysis);
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /creator/verify-pin  — step 1: verify PIN
    // ─────────────────────────────────────────────────────────────────
    if (method === 'POST' && url === '/creator/verify-pin') {
      const body = await parseBody(req);
      const { pin } = body as { pin: string };

      if (!pin) return respond(res, 400, { error: 'Missing PIN' });

      const valid = verifyPin(pin);
      return respond(res, valid ? 200 : 401, {
        verified: valid,
        message: valid ? 'PIN accepted. Enter creator key.' : 'Invalid PIN.'
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /creator/authenticate  — step 2: verify creator key → session
    // ─────────────────────────────────────────────────────────────────
    if (method === 'POST' && url === '/creator/authenticate') {
      const body = await parseBody(req);
      const { key } = body as { key: string };

      if (!key) return respond(res, 400, { error: 'Missing creator key' });

      const valid = verifyCreatorKey(key);

      if (!valid) {
        return respond(res, 401, { authenticated: false, message: 'Invalid creator key.' });
      }

      const sessionToken = generateCreatorSession();
      return respond(res, 200, {
        authenticated: true,
        sessionToken,
        expiresIn: '4h',
        access: 'FULL_SOVEREIGN_ACCESS',
        message: 'Creator authenticated. All systems unlocked.'
      });
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /creator/verify-session  — validate active session
    // ─────────────────────────────────────────────────────────────────
    if (method === 'POST' && url === '/creator/verify-session') {
      const body = await parseBody(req);
      const { sessionToken } = body as { sessionToken: string };

      const valid = isValidCreatorSession(sessionToken || '');
      return respond(res, valid ? 200 : 401, { valid, access: valid ? 'FULL_SOVEREIGN_ACCESS' : 'NONE' });
    }

    // ─────────────────────────────────────────────────────────────────
    // POST /creator/revoke  — revoke session
    // ─────────────────────────────────────────────────────────────────
    if (method === 'POST' && url === '/creator/revoke') {
      const body = await parseBody(req);
      const { sessionToken } = body as { sessionToken: string };
      if (sessionToken) revokeCreatorSession(sessionToken);
      return respond(res, 200, { revoked: true });
    }

    // 404 for unknown routes
    return respond(res, 404, { error: 'NOT_FOUND' });

  } catch (err: unknown) {
    console.error('[Guardian] Error:', err);
    return respond(res, 500, { error: 'GUARDIAN_INTERNAL_ERROR' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n╔══════════════════════════════════════╗`);
  console.log(`║  GUARDIAN SERVICE ONLINE             ║`);
  console.log(`║  Port: ${PORT}  | LEEWAY-CORE-2026   ║`);
  console.log(`║  Vault: ${isVaultReady() ? '✅ READY' : '⚠️  NOT INITIALIZED'}           ║`);
  console.log(`╚══════════════════════════════════════╝\n`);
});

server.on('error', (err) => {
  console.error('[Guardian] Server error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => { server.close(); process.exit(0); });
process.on('SIGINT',  () => { server.close(); process.exit(0); });
