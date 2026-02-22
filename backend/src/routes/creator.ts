import { Router } from 'express';
import { creatorVault, creatorSessions } from '../services/creatorVaultService.js';

export const creatorRouter = Router();

creatorRouter.post('/verify-pin', (req, res) => {
  const { pin } = req.body;
  if (!pin) return res.status(400).json({ error: 'Missing PIN' });

  const valid = creatorVault.verifyPin(String(pin));

  if (!valid) {
    return res.status(401).json({ verified: false, message: 'Invalid PIN.' });
  }

  res.json({ verified: true, message: 'PIN accepted. Enter creator key.' });
});

/**
 * POST /api/creator/authenticate
 * Step 2 — Verify creator key and issue a sovereign session token.
 * This token bypasses all security checks for the session lifetime.
 */
creatorRouter.post('/authenticate', (req, res) => {
  const { key } = req.body;
  if (!key) return res.status(400).json({ error: 'Missing creator key' });

  const valid = creatorVault.verifyKey(String(key));

  if (!valid) {
    return res.status(401).json({ authenticated: false, message: 'Invalid creator key.' });
  }

  const sessionToken = creatorSessions.create();

  res.json({
    authenticated: true,
    sessionToken,
    expiresIn: '4h',
    access: 'FULL_SOVEREIGN_ACCESS',
    message: 'Creator authenticated. All systems unlocked. Welcome back.'
  });
});

/**
 * POST /api/creator/verify-session
 * Validate an active creator session token.
 */
creatorRouter.post('/verify-session', (req, res) => {
  const { sessionToken } = req.body;
  const valid = creatorSessions.verify(String(sessionToken || ''));
  res.status(valid ? 200 : 401).json({
    valid,
    access: valid ? 'FULL_SOVEREIGN_ACCESS' : 'NONE'
  });
});

/**
 * POST /api/creator/revoke
 * Revoke an active creator session.
 */
creatorRouter.post('/revoke', (req, res) => {
  const { sessionToken } = req.body;
  if (sessionToken) creatorSessions.revoke(String(sessionToken));
  res.json({ revoked: true });
});

/**
 * GET /api/creator/status
 * Returns vault readiness without exposing any secrets.
 */
creatorRouter.get('/status', (_req, res) => {
  res.json({ vaultReady: creatorVault.isReady(), version: 'VAULT-1.0' });
});
