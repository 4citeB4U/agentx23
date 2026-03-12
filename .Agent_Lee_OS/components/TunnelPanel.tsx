/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.TUNNELPANEL.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = TunnelPanel module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\TunnelPanel.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

import React, { useCallback, useEffect, useRef, useState } from 'react';

type Provider = 'cloudflare' | 'ngrok';

interface TunnelStatus {
    running: boolean;
    provider: Provider | null;
    url: string | null;
    customDomain: string | null;
    log: string[];
    startedAt: string | null;
    pid: number | null;
}

const HANDSHAKE = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined;

const headers = () => ({
    'Content-Type': 'application/json',
    ...(HANDSHAKE ? { 'x-neural-handshake': HANDSHAKE } : {}),
});

export const TunnelPanel: React.FC = () => {
    const [status, setStatus] = useState<TunnelStatus>({
        running: false, provider: null, url: null,
        customDomain: null, log: [], startedAt: null, pid: null,
    });
    const [provider, setProvider] = useState<Provider>('cloudflare');
    const [customDomain, setCustomDomain] = useState('');
    const [loading, setLoading] = useState(false);
    const [copying, setCopying] = useState(false);
    const [telegramSent, setTelegramSent] = useState(false);
    const [telegramLoading, setTelegramLoading] = useState(false);
    const logRef = useRef<HTMLDivElement>(null);

    const fetchStatus = useCallback(async () => {
        try {
            const r = await fetch('/api/tunnel/status', { headers: headers() });
            if (r.ok) setStatus(await r.json());
        } catch { /* backend not up yet */ }
    }, []);

    useEffect(() => {
        fetchStatus();
        const id = setInterval(fetchStatus, 2000);
        return () => clearInterval(id);
    }, [fetchStatus]);

    // Auto-scroll log
    useEffect(() => {
        if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
    }, [status.log]);

    const handleStart = async () => {
        setLoading(true);
        setTelegramSent(false);
        try {
            const r = await fetch('/api/tunnel/start', {
                method: 'POST',
                headers: headers(),
                body: JSON.stringify({ provider, customDomain: customDomain.trim() || undefined }),
            });
            const data = await r.json();
            setStatus(data);
        } finally {
            setLoading(false);
        }
    };

    const handleStop = async () => {
        setLoading(true);
        try {
            await fetch('/api/tunnel/stop', { method: 'POST', headers: headers() });
            await fetchStatus();
        } finally {
            setLoading(false);
        }
    };

    const handleCopy = async () => {
        if (!status.url) return;
        await navigator.clipboard.writeText(status.url);
        setCopying(true);
        setTimeout(() => setCopying(false), 2000);
    };

    const handleTelegram = async () => {
        setTelegramLoading(true);
        try {
            await fetch('/api/tunnel/telegram', { method: 'POST', headers: headers() });
            setTelegramSent(true);
            setTimeout(() => setTelegramSent(false), 4000);
        } finally {
            setTelegramLoading(false);
        }
    };

    const domainPlaceholder = provider === 'ngrok'
        ? 'e.g. agentleeos.leewayinnovations.io'
        : 'Leave blank for a random Cloudflare URL';

    const statusColor = status.running
        ? status.url ? 'text-green-400' : 'text-yellow-400'
        : 'text-gray-500';

    const statusLabel = status.running
        ? status.url ? 'LIVE' : 'CONNECTING…'
        : 'OFFLINE';

    return (
        <div className="w-full h-full flex flex-col bg-black/60 backdrop-blur-xl overflow-y-auto p-4 gap-4">

            {/* Header */}
            <div className="flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <span className="text-blue-400 font-mono text-[11px] tracking-widest uppercase">
                        ⚡ Tunnel_Control
                    </span>
                    <span className={`text-[10px] font-mono font-bold tracking-widest ${statusColor} flex items-center gap-1`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.running && status.url ? 'bg-green-400 shadow-[0_0_6px_#4ade80]' : status.running ? 'bg-yellow-400 animate-pulse' : 'bg-gray-600'}`}></span>
                        {statusLabel}
                    </span>
                </div>
                {status.startedAt && (
                    <span className="text-[9px] text-gray-600 font-mono">
                        since {new Date(status.startedAt).toLocaleTimeString()}
                    </span>
                )}
            </div>

            {/* Provider Select */}
            <div className="shrink-0">
                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-2">Provider</p>
                <div className="grid grid-cols-2 gap-2">
                    {(['cloudflare', 'ngrok'] as Provider[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setProvider(p)}
                            disabled={status.running}
                            className={`py-2.5 px-3 rounded-xl border text-[11px] font-mono font-bold uppercase tracking-widest transition-all
                                ${provider === p
                                    ? 'bg-blue-500/20 border-blue-500 text-blue-300'
                                    : 'bg-white/5 border-white/10 text-gray-500 hover:border-white/30'}
                                disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            {p === 'cloudflare' ? '☁️ Cloudflare' : '🔌 ngrok'}
                        </button>
                    ))}
                </div>
                {provider === 'ngrok' && (
                    <p className="text-[9px] text-yellow-600 font-mono mt-1.5">
                        ⚠ ngrok free plans have monthly bandwidth limits. Cloudflare is unlimited.
                    </p>
                )}
            </div>

            {/* Custom Domain */}
            <div className="shrink-0">
                <p className="text-[9px] text-gray-500 font-mono uppercase tracking-widest mb-1.5">
                    Custom Domain <span className="text-gray-600 normal-case">(optional)</span>
                </p>
                <input
                    type="text"
                    value={customDomain}
                    onChange={e => setCustomDomain(e.target.value)}
                    disabled={status.running}
                    placeholder={domainPlaceholder}
                    className="w-full bg-black/50 border border-white/10 rounded-xl px-3 py-2.5 text-[11px] font-mono text-gray-300
                        placeholder:text-gray-700 focus:outline-none focus:border-blue-500/60 focus:bg-blue-900/10
                        disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                />
                {provider === 'ngrok' && customDomain && (
                    <p className="text-[9px] text-gray-500 font-mono mt-1">
                        Requires a claimed static domain from dashboard.ngrok.com/domains
                    </p>
                )}
            </div>

            {/* Start / Stop */}
            <div className="shrink-0">
                {!status.running ? (
                    <button
                        onClick={handleStart}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-blue-600/80 hover:bg-blue-500/90 border border-blue-500/50
                            text-white font-mono font-bold text-[12px] uppercase tracking-widest transition-all
                            disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <><span className="animate-spin">⟳</span> Starting…</>
                        ) : (
                            <> ▶ Launch Tunnel</>
                        )}
                    </button>
                ) : (
                    <button
                        onClick={handleStop}
                        disabled={loading}
                        className="w-full py-3 rounded-xl bg-red-900/50 hover:bg-red-800/60 border border-red-700/50
                            text-red-300 font-mono font-bold text-[12px] uppercase tracking-widest transition-all
                            disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {loading ? <><span className="animate-spin">⟳</span> Stopping…</> : '■ Stop Tunnel'}
                    </button>
                )}
            </div>

            {/* Live URL */}
            {status.url && (
                <div className="shrink-0 bg-green-900/10 border border-green-500/20 rounded-xl p-3 space-y-2">
                    <p className="text-[9px] text-green-500 font-mono uppercase tracking-widest">Live URL</p>
                    <a
                        href={status.url}
                        target="_blank"
                        rel="noreferrer"
                        className="block text-green-300 font-mono text-[11px] break-all hover:underline"
                    >
                        {status.url}
                    </a>
                    <div className="flex gap-2">
                        <button
                            onClick={handleCopy}
                            className="flex-1 py-1.5 rounded-lg bg-green-800/30 hover:bg-green-700/40 border border-green-600/30
                                text-green-300 font-mono text-[10px] uppercase tracking-widest transition-all"
                        >
                            {copying ? '✓ Copied!' : '⎘ Copy'}
                        </button>
                        <button
                            onClick={handleTelegram}
                            disabled={telegramLoading}
                            className="flex-1 py-1.5 rounded-lg bg-blue-800/30 hover:bg-blue-700/40 border border-blue-600/30
                                text-blue-300 font-mono text-[10px] uppercase tracking-widest transition-all
                                disabled:opacity-50"
                        >
                            {telegramLoading ? '⟳ Sending…' : telegramSent ? '✓ Sent!' : '✈ Telegram'}
                        </button>
                    </div>
                </div>
            )}

            {/* No URL yet but running */}
            {status.running && !status.url && (
                <div className="shrink-0 bg-yellow-900/10 border border-yellow-600/20 rounded-xl p-3">
                    <p className="text-[10px] text-yellow-400 font-mono animate-pulse">
                        ⟳ Waiting for tunnel URL… (usually within 5 seconds)
                    </p>
                </div>
            )}

            {/* Log */}
            <div className="flex-1 min-h-0 flex flex-col">
                <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest mb-1.5 shrink-0">
                    Output Log
                </p>
                <div
                    ref={logRef}
                    className="flex-1 bg-black/50 border border-white/5 rounded-xl p-3 overflow-y-auto font-mono text-[10px] leading-relaxed text-gray-500 space-y-0.5 tunnel-log-area"
                >
                    {status.log.length === 0
                        ? <span className="text-gray-700">No output yet. Launch a tunnel to begin.</span>
                        : status.log.map((line, i) => (
                            <div key={i} className={
                                line.includes('TUNNEL ACTIVE') ? 'text-green-400 font-bold' :
                                    line.includes('EXIT') || line.includes('STOPPED') ? 'text-red-400' :
                                        line.includes('error') || line.includes('ERR') ? 'text-red-400' :
                                            'text-gray-600'
                            }>{line}</div>
                        ))
                    }
                </div>
            </div>

            {/* Tips */}
            <div className="shrink-0 border border-white/5 rounded-xl p-3 space-y-1">
                <p className="text-[9px] text-gray-600 font-mono uppercase tracking-widest">Status &amp; Tips</p>
                <p className="text-[9px] text-cyan-700 font-mono">✅ Named tunnel <span className="text-cyan-500">agent-lee</span> is registered on your Cloudflare account</p>
                <p className="text-[9px] text-gray-700 font-mono">☁ Current mode: quick tunnel — free, no bandwidth cap, URL changes each restart</p>
                <p className="text-[9px] text-gray-700 font-mono">✅ Permanent tunnel active: <span className="text-green-400">agentleeos.leewayinnovations.io</span></p>
                <p className="text-[9px] text-gray-700 font-mono">🔌 ngrok fallback: 1 GB/month, static domain at dashboard.ngrok.com — switch provider above</p>
            </div>
        </div>
    );
};

export default TunnelPanel;
