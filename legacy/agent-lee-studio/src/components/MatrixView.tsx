import { Columns2, Maximize2, Minimize2, Monitor, MousePointer2, Power, RefreshCw, Terminal, Wifi } from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { BACKEND_URL } from '../constants';
import { SovereignIdentity } from '../services/SovereignIdentity';

/**
 * MATRIX REMOTE VIEW (V4)
 * Full live interaction: mouse move, click, double-click, scroll forwarded to Desktop Agent.
 * Dual-screen support with graceful fallback when display 2 is absent.
 */

interface CursorPos { x: number; y: number; visible: boolean }

const MOVE_THROTTLE_MS = 40; // ~25 fps mouse updates

export const MatrixView: React.FC = () => {
    const [isConnected, setIsConnected] = useState(true);
    const [viewMode, setViewMode] = useState<'DESKTOP' | 'TERMINAL'>('DESKTOP');
    const [viewLayout, setViewLayout] = useState<'SINGLE' | 'DUAL'>('DUAL');
    const [cinemaMode, setCinemaMode] = useState(false);
    const [imageSrc1, setImageSrc1] = useState<string | null>(null);
    const [imageSrc2, setImageSrc2] = useState<string | null>(null);
    const [display2Missing, setDisplay2Missing] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [autoRefresh, setAutoRefresh] = useState(true);
    const [interactEnabled, setInteractEnabled] = useState(true);
    const [cursor1, setCursor1] = useState<CursorPos>({ x: 0, y: 0, visible: false });
    const [cursor2, setCursor2] = useState<CursorPos>({ x: 0, y: 0, visible: false });

    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const lastMove1Ref = useRef<number>(0);
    const lastMove2Ref = useRef<number>(0);
    const panel1Ref = useRef<HTMLDivElement>(null);
    const panel2Ref = useRef<HTMLDivElement>(null);

    /* ------------------------------------------------------------------ */
    /* Screenshot fetching                                                  */
    /* ------------------------------------------------------------------ */
    const fetchScreenshotFor = async (displayIndex: 1 | 2): Promise<string | null> => {
        try {
            const headers = await SovereignIdentity.signRequest({ display: String(displayIndex) });
            const res = await fetch(`${BACKEND_URL}/api/device/screenshot?display=${displayIndex}`, { headers });
            if (res.status === 404) return null;   // display doesn't exist — not an error
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const blob = await res.blob();
            return URL.createObjectURL(blob);
        } catch (e) {
            if (displayIndex === 2) return null;   // silently skip missing second display
            throw e; // re-throw for display 1 failures so we show disconnected state
        }
    };

    const fetchScreenshot = async () => {
        if (isLoading) return;
        setIsLoading(true);
        try {
            const url1 = await fetchScreenshotFor(1);
            const url2 = viewLayout === 'DUAL' ? await fetchScreenshotFor(2) : null;

            setImageSrc1(old => { if (old) URL.revokeObjectURL(old); return url1; });
            setImageSrc2(old => { if (old) URL.revokeObjectURL(old); return url2; });
            setDisplay2Missing(viewLayout === 'DUAL' && url2 === null);
            setIsConnected(true);
        } catch (e) {
            console.error('[Matrix] Screenshot failed', e);
            setIsConnected(false);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (autoRefresh && viewMode === 'DESKTOP') {
            fetchScreenshot();
            intervalRef.current = setInterval(fetchScreenshot, 2000);
        } else {
            if (intervalRef.current) clearInterval(intervalRef.current);
        }
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [autoRefresh, viewMode, viewLayout]);

    /* ------------------------------------------------------------------ */
    /* Desktop-agent interaction                                            */
    /* ------------------------------------------------------------------ */
    const sendAct = useCallback(async (
        action: string,
        nx: number, ny: number,
        display: 1 | 2,
        extra?: { deltaY?: number; text?: string; keys?: string[] }
    ) => {
        if (!interactEnabled) return;
        try {
            const coords: number[] = [nx, ny];
            if (extra?.deltaY !== undefined) coords.push(extra.deltaY);

            const headers = await SovereignIdentity.signRequest({ action, coordinates: coords, display });
            await fetch(`${BACKEND_URL}/api/device/act`, {
                method: 'POST',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, coordinates: coords, display, text: extra?.text, keys: extra?.keys })
            });
        } catch { /* silent — interaction errors must not break the view */ }
    }, [interactEnabled]);

    /** Normalize pointer position within a panel div to 0-1000 scale */
    const getNormCoords = (e: React.MouseEvent<HTMLDivElement>): [number, number] => {
        const rect = e.currentTarget.getBoundingClientRect();
        const nx = Math.min(1000, Math.max(0, ((e.clientX - rect.left) / rect.width) * 1000));
        const ny = Math.min(1000, Math.max(0, ((e.clientY - rect.top) / rect.height) * 1000));
        return [nx, ny];
    };

    const makeHandlers = (display: 1 | 2, lastMoveRef: React.MutableRefObject<number>, setCursor: React.Dispatch<React.SetStateAction<CursorPos>>) => ({
        onMouseEnter: () => setCursor(c => ({ ...c, visible: true })),
        onMouseLeave: () => setCursor(c => ({ ...c, visible: false })),

        onMouseMove: (e: React.MouseEvent<HTMLDivElement>) => {
            const [nx, ny] = getNormCoords(e);
            setCursor({ x: e.clientX - e.currentTarget.getBoundingClientRect().left, y: e.clientY - e.currentTarget.getBoundingClientRect().top, visible: true });
            const now = Date.now();
            if (now - lastMoveRef.current < MOVE_THROTTLE_MS) return;
            lastMoveRef.current = now;
            sendAct('move', nx, ny, display);
        },

        onClick: (e: React.MouseEvent<HTMLDivElement>) => {
            const [nx, ny] = getNormCoords(e);
            sendAct('click', nx, ny, display);
        },

        onDoubleClick: (e: React.MouseEvent<HTMLDivElement>) => {
            e.preventDefault();
            const [nx, ny] = getNormCoords(e);
            sendAct('double_click', nx, ny, display);
        },

        onWheel: (e: React.WheelEvent<HTMLDivElement>) => {
            e.preventDefault();
            const [nx, ny] = getNormCoords(e as unknown as React.MouseEvent<HTMLDivElement>);
            sendAct('scroll', nx, ny, display, { deltaY: e.deltaY });
        },

        onContextMenu: (e: React.MouseEvent<HTMLDivElement>) => e.preventDefault(),
        style: { cursor: 'crosshair' } as React.CSSProperties
    });

    const mon1Handlers = makeHandlers(1, lastMove1Ref, setCursor1);
    const mon2Handlers = makeHandlers(2, lastMove2Ref, setCursor2);

    /* ------------------------------------------------------------------ */
    /* Render                                                               */
    /* ------------------------------------------------------------------ */
    return (
        <div className={`h-full w-full flex flex-col bg-black relative group ${cinemaMode ? 'fixed inset-0 z-[200]' : ''}`}>

            {/* Cinema Mode exit button */}
            {cinemaMode && (
                <button onClick={() => setCinemaMode(false)} title="Exit cinema mode" aria-label="Exit cinema mode"
                    className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-black/80 text-white rounded-full border border-white/10 backdrop-blur-md transition-all">
                    <Minimize2 size={20} />
                </button>
            )}

            {/* Control Strip */}
            <div className={`
                h-14 flex items-center justify-between px-3 md:px-6 bg-glass-surface backdrop-blur-xl border-b border-glass-border transition-all duration-300 z-40
                ${cinemaMode ? 'absolute top-0 left-0 right-0 -translate-y-full hover:translate-y-0 opacity-0 hover:opacity-100' : 'relative'}
            `}>
                <div className="flex items-center gap-3 md:gap-4 flex-wrap">
                    {/* Status */}
                    <div className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-accent-cyan shadow-[0_0_10px_#00f0ff] animate-pulse' : 'bg-red-500'}`}></div>
                        <div className="flex flex-col">
                            <span className="text-[10px] font-bold tracking-[0.2em] uppercase text-white hidden md:inline">Matrix_Uplink</span>
                            <span className="text-[8px] font-mono text-accent-cyan/70">{isConnected ? 'SIGNAL_ACTIVE' : 'LOST'}</span>
                        </div>
                    </div>

                    <div className="h-6 w-[1px] bg-white/10"></div>

                    {/* View mode */}
                    <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                        <ModeButton active={viewMode === 'DESKTOP'} onClick={() => setViewMode('DESKTOP')} icon={Monitor} label="Feed" />
                        <ModeButton active={viewMode === 'TERMINAL'} onClick={() => setViewMode('TERMINAL')} icon={Terminal} label="Shell" />
                    </div>

                    {/* Layout toggle */}
                    {viewMode === 'DESKTOP' && (
                        <div className="flex gap-1 bg-black/20 p-1 rounded-lg border border-white/5">
                            <ModeButton active={viewLayout === 'SINGLE'} onClick={() => setViewLayout('SINGLE')} icon={Monitor} label="1×" />
                            <ModeButton active={viewLayout === 'DUAL'} onClick={() => setViewLayout('DUAL')} icon={Columns2} label="2×" />
                        </div>
                    )}

                    {/* Interact toggle */}
                    {viewMode === 'DESKTOP' && (
                        <button
                            title={interactEnabled ? 'Disable mouse control' : 'Enable mouse control'}
                            onClick={() => setInteractEnabled(v => !v)}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[9px] font-bold uppercase border transition-all
                                ${interactEnabled ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan' : 'border-white/10 text-text-muted'}`}
                        >
                            <MousePointer2 size={12} /> {interactEnabled ? 'LIVE' : 'VIEW'}
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 md:gap-3">
                    <div className="px-2 py-1 rounded-full bg-accent-cyan/5 border border-accent-cyan/20 hidden md:flex items-center gap-1">
                        <Wifi size={12} className="text-accent-cyan" />
                        <span className="text-[9px] font-mono text-accent-cyan">50ms</span>
                    </div>
                    <button onClick={() => setAutoRefresh(!autoRefresh)} title={autoRefresh ? 'Pause refresh' : 'Resume refresh'}
                        className={`p-2 rounded-lg border transition-all ${autoRefresh ? 'bg-accent-cyan/10 border-accent-cyan text-accent-cyan' : 'border-white/10 text-text-muted'}`}>
                        <RefreshCw size={14} className={autoRefresh ? 'animate-spin' : ''} />
                    </button>
                    <button onClick={() => setCinemaMode(!cinemaMode)} title="Fullscreen" className="p-2 text-text-dim hover:text-white transition-colors">
                        <Maximize2 size={16} />
                    </button>
                    <button title="Power" aria-label="Power controls" className="p-2 text-red-500 hover:text-red-400 transition-colors">
                        <Power size={16} />
                    </button>
                </div>
            </div>

            {/* Main Display Area */}
            <div className="flex-1 relative overflow-hidden flex items-center justify-center bg-[#020202]">
                {/* Scanline */}
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent-cyan/5 to-transparent h-[10px] w-full animate-[scan_4s_linear_infinite] pointer-events-none z-10"></div>

                {viewMode === 'DESKTOP' && (
                    imageSrc1 ? (
                        <div className={`relative w-full h-full p-4 grid gap-4 ${viewLayout === 'DUAL' ? 'grid-cols-2' : 'grid-cols-1'}`}>
                            {/* Monitor 1 — always interactive */}
                            <div ref={panel1Ref}
                                className="relative bg-black/30 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center select-none"
                                {...mon1Handlers}
                            >
                                <img src={imageSrc1} alt="Monitor 1" className="w-full h-full object-contain shadow-2xl pointer-events-none" draggable={false} />
                                <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 border border-white/10 rounded text-[9px] font-mono text-accent-cyan uppercase z-20 pointer-events-none">MONITOR_1</div>
                                {/* Cursor dot */}
                                {cursor1.visible && interactEnabled && (
                                    <div className="absolute pointer-events-none z-30" style={{ left: cursor1.x - 6, top: cursor1.y - 6 }}>
                                        <div className="w-3 h-3 rounded-full border-2 border-accent-cyan bg-accent-cyan/20 shadow-[0_0_8px_#00f0ff]" />
                                    </div>
                                )}
                            </div>

                            {/* Monitor 2 */}
                            {viewLayout === 'DUAL' && (
                                display2Missing ? (
                                    /* No second display connected */
                                    <div className="relative bg-black/30 rounded-lg overflow-hidden border border-white/5 flex flex-col items-center justify-center gap-3">
                                        <Monitor size={40} className="text-white/10" />
                                        <div className="text-[10px] font-mono text-text-muted uppercase tracking-widest text-center px-4">
                                            No_Display_2_Detected<br />
                                            <span className="text-[8px] text-white/20">Connect a second monitor and refresh</span>
                                        </div>
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 border border-white/10 rounded text-[9px] font-mono text-text-muted uppercase">MONITOR_2</div>
                                    </div>
                                ) : (
                                    <div ref={panel2Ref}
                                        className="relative bg-black/30 rounded-lg overflow-hidden border border-white/10 flex items-center justify-center select-none"
                                        {...mon2Handlers}
                                    >
                                        {imageSrc2 ? (
                                            <img src={imageSrc2} alt="Monitor 2" className="w-full h-full object-contain shadow-2xl pointer-events-none" draggable={false} />
                                        ) : (
                                            <div className="text-xs font-mono text-text-muted uppercase tracking-widest animate-pulse">Awaiting_Display_2...</div>
                                        )}
                                        <div className="absolute top-2 left-2 px-2 py-1 bg-black/60 border border-white/10 rounded text-[9px] font-mono text-accent-cyan uppercase z-20 pointer-events-none">MONITOR_2</div>
                                        {cursor2.visible && interactEnabled && (
                                            <div className="absolute pointer-events-none z-30" style={{ left: cursor2.x - 6, top: cursor2.y - 6 }}>
                                                <div className="w-3 h-3 rounded-full border-2 border-accent-magenta bg-accent-magenta/20 shadow-[0_0_8px_#ff00ff]" />
                                            </div>
                                        )}
                                    </div>
                                )
                            )}

                            <div className="absolute inset-0 bg-[radial-gradient(circle,transparent_60%,black_100%)] pointer-events-none z-0"></div>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 opacity-40 animate-pulse">
                            <Monitor size={64} className="text-accent-cyan" />
                            <div className="text-center">
                                <h3 className="text-sm font-bold tracking-[0.3em] text-accent-cyan mb-2">ESTABLISHING_LINK</h3>
                                <p className="text-[10px] font-mono text-text-dim">Waiting for visual telemetry...</p>
                            </div>
                        </div>
                    )
                )}

                {viewMode === 'TERMINAL' && (
                    <div className="absolute inset-8 bg-black/90 rounded-xl border border-accent-cyan/20 p-6 font-mono text-xs overflow-hidden shadow-[0_0_50px_rgba(0,240,255,0.1)]">
                        <div className="flex items-center justify-between border-b border-accent-cyan/10 pb-4 mb-4">
                            <span className="text-accent-cyan font-bold">ROOT_SHELL // ACCESS_GRANTED</span>
                            <div className="flex gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500/20"></div>
                                <div className="w-3 h-3 rounded-full bg-yellow-500/20"></div>
                                <div className="w-3 h-3 rounded-full bg-green-500/20"></div>
                            </div>
                        </div>
                        <div className="space-y-2 text-text-dim">
                            <p><span className="text-accent-magenta">root@sovereign:~$</span> systemctl status antigravity</p>
                            <p className="text-white">● antigravity.service - Agent Lee Neural Core</p>
                            <p className="pl-4">Loaded: loaded (/etc/systemd/system/antigravity.service; enabled)</p>
                            <p className="pl-4">Active: <span className="text-green-400">active (running)</span> since Tue 2026-02-17</p>
                            <p className="pl-4">Memory: 4.2G</p>
                            <p><span className="text-accent-magenta">root@sovereign:~$</span> <span className="animate-pulse">_</span></p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ModeButton: React.FC<{ active: boolean; onClick: () => void; icon: any; label: string }> = ({ active, onClick, icon: Icon, label }) => (
    <button onClick={onClick}
        className={`px-3 py-1.5 rounded-md text-[9px] font-bold uppercase transition-all flex items-center gap-2
            ${active ? 'bg-accent-cyan/10 text-accent-cyan shadow-[0_0_10px_rgba(0,240,255,0.2)]' : 'text-text-muted hover:text-white hover:bg-white/5'}`}
    >
        <Icon size={12} /> {label}
    </button>
);

