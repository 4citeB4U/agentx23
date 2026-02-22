import { useState, useCallback, useEffect, useRef } from 'react';

/**
 * CREATOR ACCESS — Hidden Sovereign Entry
 * LEEWAY-CORE-2026
 *
 * Appears as a small green light in the bottom-right corner of every screen.
 * Click it → enter PIN (2912) → enter Creator Key → full system access granted.
 *
 * This component is embedded in every app built by Agent Lee.
 * It is intentionally ambiguous — it looks like a status indicator, not a login button.
 */

const GUARDIAN_URL = (import.meta as any).env?.VITE_GUARDIAN_URL || 'http://localhost:9000';
const BACKEND_URL  = (import.meta as any).env?.VITE_BACKEND_URL  || 'http://localhost:8001';

type Stage = 'idle' | 'pin' | 'key' | 'authenticated' | 'error';

interface Props {
  onAuthenticated?: (sessionToken: string) => void;
}

export function CreatorAccess({ onAuthenticated }: Props) {
  const [stage, setStage] = useState<Stage>('idle');
  const [pin, setPin] = useState('');
  const [creatorKey, setCreatorKey] = useState('');
  const [error, setError] = useState('');
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('CREATOR_SESSION') || '');
  const [isLoading, setIsLoading] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const pinRef = useRef<HTMLInputElement>(null);

  // Check existing session on mount
  useEffect(() => {
    const token = localStorage.getItem('CREATOR_SESSION');
    if (token) {
      verifyExistingSession(token);
    }
  }, []);

  // Focus PIN input when panel opens
  useEffect(() => {
    if (stage === 'pin') setTimeout(() => pinRef.current?.focus(), 50);
  }, [stage]);

  // Close panel on outside click
  useEffect(() => {
    if (stage === 'idle' || stage === 'authenticated') return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        handleClose();
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [stage]);

  async function verifyExistingSession(token: string) {
    try {
      const res = await fetch(`${BACKEND_URL}/api/creator/verify-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken: token })
      });
      const data = await res.json();
      if (data.valid) {
        setSessionToken(token);
        setStage('authenticated');
        onAuthenticated?.(token);
      } else {
        localStorage.removeItem('CREATOR_SESSION');
      }
    } catch {}
  }

  function handleGreenLightClick() {
    if (stage === 'authenticated') {
      // Already authenticated — show status
      setStage('idle');
      return;
    }
    if (stage === 'idle') {
      setStage('pin');
      setPin('');
      setCreatorKey('');
      setError('');
    }
  }

  async function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!pin || pin.length < 2) { setError('Enter PIN'); return; }
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/creator/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      });
      const data = await res.json();

      if (data.verified) {
        setStage('key');
        setCreatorKey('');
      } else {
        setError('Invalid PIN.');
        setPin('');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleKeySubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!creatorKey) { setError('Enter creator key'); return; }
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`${BACKEND_URL}/api/creator/authenticate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: creatorKey })
      });
      const data = await res.json();

      if (data.authenticated) {
        localStorage.setItem('CREATOR_SESSION', data.sessionToken);
        setSessionToken(data.sessionToken);
        setStage('authenticated');
        setCreatorKey('');
        onAuthenticated?.(data.sessionToken);
      } else {
        setError('Invalid creator key.');
        setCreatorKey('');
      }
    } catch {
      setError('Connection error.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSignOut() {
    if (sessionToken) {
      await fetch(`${BACKEND_URL}/api/creator/revoke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken })
      }).catch(() => {});
    }
    localStorage.removeItem('CREATOR_SESSION');
    setSessionToken('');
    setStage('idle');
    setPin('');
    setCreatorKey('');
    setError('');
  }

  function handleClose() {
    setStage('idle');
    setPin('');
    setCreatorKey('');
    setError('');
  }

  const isActive = stage !== 'idle';

  return (
    <>
      {/* ── THE GREEN LIGHT ────────────────────────────────────────── */}
      {/* Looks like a status indicator. Not obviously a button. */}
      <div
        onClick={handleGreenLightClick}
        title=""
        aria-label=""
        style={{
          position: 'fixed',
          bottom: '12px',
          right: '14px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: stage === 'authenticated'
            ? 'radial-gradient(circle, #00ff9d 0%, #00cc7a 100%)'
            : 'radial-gradient(circle, #22c55e 0%, #16a34a 100%)',
          boxShadow: stage === 'authenticated'
            ? '0 0 8px 3px rgba(0,255,157,0.6)'
            : '0 0 4px 1px rgba(34,197,94,0.4)',
          cursor: 'pointer',
          zIndex: 99999,
          transition: 'all 0.3s ease',
          animation: stage === 'authenticated' ? 'creatorPulse 2s infinite' : 'none',
        }}
      />

      {/* ── ACCESS PANEL ───────────────────────────────────────────── */}
      {isActive && stage !== 'authenticated' && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '20px',
            width: '280px',
            background: 'rgba(10, 12, 16, 0.97)',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            borderRadius: '12px',
            padding: '20px',
            zIndex: 99998,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 4px 32px rgba(0,0,0,0.6), 0 0 20px rgba(34,197,94,0.05)',
            fontFamily: 'monospace',
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ color: 'rgba(34,197,94,0.8)', fontSize: '11px', letterSpacing: '0.15em' }}>
              {stage === 'pin' ? 'ACCESS BY PIN' : 'CREATOR KEY'}
            </div>
            <button
              onClick={handleClose}
              style={{
                background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', fontSize: '14px', padding: '0', lineHeight: '1'
              }}
            >×</button>
          </div>

          {/* PIN Stage */}
          {stage === 'pin' && (
            <form onSubmit={handlePinSubmit}>
              <input
                ref={pinRef}
                type="password"
                value={pin}
                onChange={e => setPin(e.target.value)}
                maxLength={8}
                placeholder="••••"
                disabled={isLoading}
                style={inputStyle}
              />
              <button type="submit" disabled={isLoading} style={buttonStyle}>
                {isLoading ? '...' : 'VERIFY'}
              </button>
            </form>
          )}

          {/* Key Stage */}
          {stage === 'key' && (
            <form onSubmit={handleKeySubmit}>
              <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '8px' }}>
                Enter creator key
              </div>
              <input
                type="password"
                value={creatorKey}
                onChange={e => setCreatorKey(e.target.value)}
                placeholder="Creator key"
                disabled={isLoading}
                autoFocus
                style={inputStyle}
              />
              <button type="submit" disabled={isLoading} style={buttonStyle}>
                {isLoading ? '...' : 'AUTHENTICATE'}
              </button>
            </form>
          )}

          {/* Error */}
          {error && (
            <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '8px', textAlign: 'center' }}>
              {error}
            </div>
          )}
        </div>
      )}

      {/* ── AUTHENTICATED PANEL ─────────────────────────────────────── */}
      {stage === 'authenticated' && isActive && (
        <div
          ref={panelRef}
          style={{
            position: 'fixed',
            bottom: '30px',
            right: '20px',
            width: '220px',
            background: 'rgba(10, 12, 16, 0.97)',
            border: '1px solid rgba(0,255,157,0.3)',
            borderRadius: '12px',
            padding: '16px',
            zIndex: 99998,
            fontFamily: 'monospace',
          }}
        >
          <div style={{ color: 'rgba(0,255,157,0.9)', fontSize: '11px', letterSpacing: '0.1em', marginBottom: '12px' }}>
            ✓ SOVEREIGN ACCESS
          </div>
          <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: '10px', marginBottom: '12px' }}>
            All systems unlocked
          </div>
          <button onClick={handleSignOut} style={{ ...buttonStyle, background: 'rgba(239,68,68,0.15)', borderColor: 'rgba(239,68,68,0.3)', color: '#ef4444' }}>
            SIGN OUT
          </button>
        </div>
      )}

      {/* Pulse animation keyframes */}
      <style>{`
        @keyframes creatorPulse {
          0%, 100% { box-shadow: 0 0 8px 3px rgba(0,255,157,0.5); }
          50%       { box-shadow: 0 0 16px 6px rgba(0,255,157,0.8); }
        }
      `}</style>
    </>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(255,255,255,0.05)',
  border: '1px solid rgba(34,197,94,0.2)',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '13px',
  padding: '8px 10px',
  outline: 'none',
  fontFamily: 'monospace',
  letterSpacing: '0.1em',
  boxSizing: 'border-box',
  marginBottom: '10px',
  display: 'block',
};

const buttonStyle: React.CSSProperties = {
  width: '100%',
  background: 'rgba(34,197,94,0.1)',
  border: '1px solid rgba(34,197,94,0.3)',
  borderRadius: '6px',
  color: 'rgba(34,197,94,0.9)',
  fontSize: '11px',
  letterSpacing: '0.1em',
  padding: '8px',
  cursor: 'pointer',
  fontFamily: 'monospace',
};

export default CreatorAccess;
