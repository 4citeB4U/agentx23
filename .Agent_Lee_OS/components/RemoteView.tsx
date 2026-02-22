import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Keyboard, Move, MousePointerClick } from 'lucide-react';

export const RemoteView: React.FC = () => {
  const [activeScreen, setActiveScreen] = useState<'SCREEN_1' | 'SCREEN_2' | 'BOTH'>('SCREEN_1');
  const [zoomLevel, setZoomLevel] = useState(100);
  const [streamOnline, setStreamOnline] = useState(false);
  const [streamError, setStreamError] = useState<string>('');
  const [statusText, setStatusText] = useState<string>('Initializing screen stream...');
  const [textInput, setTextInput] = useState('');
  const [frameUrl, setFrameUrl] = useState<string>('');
  const [frameUrl2, setFrameUrl2] = useState<string>('');
  const [mouseMode, setMouseMode] = useState<'DIRECT' | 'TRACKPAD'>('DIRECT');
  const frameRef = useRef<HTMLImageElement>(null);
  const frameRef2 = useRef<HTMLImageElement>(null);
  const lastPointRef = useRef<{ 1: [number, number] | null; 2: [number, number] | null; lastScreen: 1 | 2 }>(
    { 1: null, 2: null, lastScreen: 1 }
  );
  const lastMoveSentAtRef = useRef<number>(0);
  const lastTapAtRef = useRef<number>(0);
  const lastTapPointRef = useRef<{ screen: 1 | 2; point: [number, number] } | null>(null);
  const activePointerRef = useRef<{ 1: number | null; 2: number | null }>({ 1: null, 2: null });
  // Pinch-to-zoom
  const pinchPointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const pinchStartDistRef = useRef<number>(0);
  const pinchStartZoomRef = useRef<number>(100);
  const handshake = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined;
  const headers = useMemo<Record<string, string>>(() => ({
    ...(handshake ? { 'x-neural-handshake': handshake } : {}),
    'ngrok-skip-browser-warning': '1'
  }), [handshake]);
  const zoomScaleClass: Record<number, string> = {
    50: 'scale-[0.5]',
    60: 'scale-[0.6]',
    70: 'scale-[0.7]',
    80: 'scale-[0.8]',
    90: 'scale-[0.9]',
    100: 'scale-100',
    110: 'scale-[1.1]',
    120: 'scale-[1.2]',
    130: 'scale-[1.3]',
    140: 'scale-[1.4]',
    150: 'scale-[1.5]',
    160: 'scale-[1.6]',
    170: 'scale-[1.7]',
    180: 'scale-[1.8]',
    190: 'scale-[1.9]',
    200: 'scale-[2]',
  };

  useEffect(() => {
    let cancelled = false;
    let lastObjectUrl: string | null = null;
    let lastObjectUrl2: string | null = null;

    const fetchFrameFor = async (display?: 1 | 2) => {
      const qs = new URLSearchParams();
      qs.set('ts', String(Date.now()));
      if (display) qs.set('display', String(display));
      return fetch(`/api/device/screenshot?${qs.toString()}`, { headers });
    };

    const fetchFrame = async () => {
      try {
        const response = await fetchFrameFor(activeScreen === 'SCREEN_2' ? 2 : activeScreen === 'SCREEN_1' ? 1 : undefined);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blob = await response.blob();
        const objectUrl = URL.createObjectURL(blob);

        let objectUrl2: string | null = null;
        if (activeScreen === 'BOTH') {
          const response2 = await fetchFrameFor(2);
          if (response2.ok) {
            const blob2 = await response2.blob();
            objectUrl2 = URL.createObjectURL(blob2);
          }
        }
        if (cancelled) {
          URL.revokeObjectURL(objectUrl);
          if (objectUrl2) URL.revokeObjectURL(objectUrl2);
          return;
        }

        if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
        lastObjectUrl = objectUrl;
        setFrameUrl(objectUrl);

        if (activeScreen === 'BOTH') {
          if (lastObjectUrl2) URL.revokeObjectURL(lastObjectUrl2);
          lastObjectUrl2 = objectUrl2;
          setFrameUrl2(objectUrl2 || '');
        } else {
          if (lastObjectUrl2) URL.revokeObjectURL(lastObjectUrl2);
          lastObjectUrl2 = null;
          setFrameUrl2('');
        }

        setStreamOnline(true);
        setStreamError('');
        setStatusText('Streaming desktop frames');
      } catch {
        if (cancelled) return;
        setStreamOnline(false);
        setStatusText('Awaiting screenshot endpoint');
        setStreamError('No desktop frame available yet. Start backend (8001) and desktop agent (8005).');
      }
    };

    fetchFrame();
    const interval = setInterval(fetchFrame, 800);
    return () => {
      cancelled = true;
      clearInterval(interval);
      if (lastObjectUrl) URL.revokeObjectURL(lastObjectUrl);
      if (lastObjectUrl2) URL.revokeObjectURL(lastObjectUrl2);
    };
  }, [activeScreen, handshake]);

  const sendAction = async (body: Record<string, unknown>) => {
    try {
      const response = await fetch('/api/device/act', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        const raw = await response.text().catch(() => '');
        let hint = '';
        if (response.status === 401 || response.status === 403) {
          hint = 'Auth blocked. If you are using ngrok/phone, ensure the app was started via Run-All.ps1 and VITE_NEURAL_HANDSHAKE matches the backend.';
        } else if (response.status === 429) {
          hint = 'Rate limited. Slow down clicks/dragging for a moment and retry.';
        }
        const detail = raw ? raw.slice(0, 220) : '';
        setStreamError(`Control request rejected (HTTP ${response.status}). ${hint}${detail ? ' ' + detail : ''}`.trim());
      }
    } catch {
      setStreamError('Control request failed. Ensure backend and desktop agent are running.');
    }
  };

  const mapClientPointToNormalized = (image: HTMLImageElement, clientX: number, clientY: number): [number, number] | null => {
    const rect = image.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;

    // Account for object-contain letterboxing so the normalized coords match the screenshot pixels.
    const naturalW = image.naturalWidth || 0;
    const naturalH = image.naturalHeight || 0;
    if (naturalW > 0 && naturalH > 0) {
      const scale = Math.min(rect.width / naturalW, rect.height / naturalH);
      const renderedW = naturalW * scale;
      const renderedH = naturalH * scale;
      const offsetX = (rect.width - renderedW) / 2;
      const offsetY = (rect.height - renderedH) / 2;

      const localX = clientX - rect.left - offsetX;
      const localY = clientY - rect.top - offsetY;
      const clampedX = Math.max(0, Math.min(renderedW, localX));
      const clampedY = Math.max(0, Math.min(renderedH, localY));

      const normalizedX = (clampedX / renderedW) * 1000;
      const normalizedY = (clampedY / renderedH) * 1000;
      return [normalizedX, normalizedY];
    }

    // Fallback: normalize within the element box.
    const normalizedX = Math.max(0, Math.min(1000, ((clientX - rect.left) / rect.width) * 1000));
    const normalizedY = Math.max(0, Math.min(1000, ((clientY - rect.top) / rect.height) * 1000));
    return [normalizedX, normalizedY];
  };

  const updateLastPoint = (screen: 1 | 2, point: [number, number]) => {
    lastPointRef.current[screen] = point;
    lastPointRef.current.lastScreen = screen;
  };

  const sendMove = async (screen: 1 | 2, point: [number, number]) => {
    updateLastPoint(screen, point);
    const now = Date.now();
    if (now - lastMoveSentAtRef.current < 35) return; // ~28Hz throttle
    lastMoveSentAtRef.current = now;
    await sendAction({ action: 'move', coordinates: point, screen });
  };

  const sendClick = async (screen: 1 | 2, point: [number, number]) => {
    updateLastPoint(screen, point);
    await sendAction({ action: 'click', coordinates: point, screen });
  };

  const sendDoubleClick = async (screen: 1 | 2, point: [number, number]) => {
    updateLastPoint(screen, point);
    await sendAction({ action: 'double_click', coordinates: point, screen });
  };

  const handlePointerDown = async (screen: 1 | 2, event: React.PointerEvent<HTMLImageElement>) => {
    const image = screen === 2 ? frameRef2.current : frameRef.current;
    if (!image) return;
    try { (event.currentTarget as any).setPointerCapture?.(event.pointerId); } catch { /* non-blocking */ }
    activePointerRef.current[screen] = event.pointerId;
    event.preventDefault();

    const point = mapClientPointToNormalized(image, event.clientX, event.clientY);
    if (!point) return;

    // Touch double-tap => double click (helps open apps on Windows).
    if (mouseMode === 'DIRECT' && event.pointerType === 'touch') {
      const now = Date.now();
      const last = lastTapAtRef.current;
      const lastTap = lastTapPointRef.current;
      lastTapAtRef.current = now;
      lastTapPointRef.current = { screen, point };

      if (lastTap && now - last < 320 && lastTap.screen === screen) {
        await sendDoubleClick(screen, point);
        return;
      }
    }

    if (mouseMode === 'DIRECT') {
      await sendClick(screen, point);
    } else {
      await sendMove(screen, point);
    }
  };

  const handlePointerMove = async (screen: 1 | 2, event: React.PointerEvent<HTMLImageElement>) => {
    // In DIRECT mode: move the cursor whenever the pointer is held (pointerdown state) — mirrors real finger motion on screen
    // In TRACKPAD mode: always forward drag as cursor movement (existing behaviour)
    const isActivePointer = activePointerRef.current[screen] === event.pointerId;
    if (!isActivePointer && event.buttons === 0) return;
    const image = screen === 2 ? frameRef2.current : frameRef.current;
    if (!image) return;
    event.preventDefault();
    const point = mapClientPointToNormalized(image, event.clientX, event.clientY);
    if (!point) return;
    await sendMove(screen, point);
  };

  const handlePointerUp = (screen: 1 | 2, event: React.PointerEvent<HTMLImageElement>) => {
    if (activePointerRef.current[screen] === event.pointerId) {
      activePointerRef.current[screen] = null;
    }
  };

  const handleAAClick = async () => {
    const lastScreen = lastPointRef.current.lastScreen;
    const point = lastPointRef.current[lastScreen];
    if (!point) {
      setStreamError('AA CLICK needs a target: tap/drag on the frame first to place the cursor.');
      return;
    }
    await sendClick(lastScreen, point);
  };

  const sendTypedText = async () => {
    const value = textInput.trim();
    if (!value) return;
    await sendAction({ action: 'type', text: value });
    setTextInput('');
  };

  return (
    <div className="flex flex-col h-full bg-black/95">
      <div className="h-12 border-b border-gray-800 flex items-center justify-between px-4 bg-gray-900/50">
          <div className="flex items-center gap-2">
             <div className={`w-2 h-2 rounded-full ${streamOnline ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
             <span className={`text-xs font-bold tracking-wider ${streamOnline ? 'text-green-500' : 'text-red-500'}`}>
               REMOTE VIEW :: {streamOnline ? 'LIVE' : 'OFFLINE'}
             </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setActiveScreen('SCREEN_1')}
              className={`px-3 py-1 text-[9px] font-bold rounded border ${activeScreen === 'SCREEN_1' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
              title="View Screen 1"
            >
              SCREEN 1
            </button>
            <button
              onClick={() => setActiveScreen('SCREEN_2')}
              className={`px-3 py-1 text-[9px] font-bold rounded border ${activeScreen === 'SCREEN_2' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
              title="View Screen 2"
            >
              SCREEN 2
            </button>
            <button
              onClick={() => setActiveScreen('BOTH')}
              className={`px-3 py-1 text-[9px] font-bold rounded border ${activeScreen === 'BOTH' ? 'bg-cyan-900/30 text-cyan-400 border-cyan-500' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
              title="View both screens"
            >
              BOTH
            </button>
          </div>
          <div className="text-[10px] text-gray-500 font-mono">{statusText}</div>
      </div>

      <div className="flex-1 relative overflow-hidden bg-[#0b0b0b] flex items-center justify-center"
        onPointerDown={(e) => {
          pinchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinchPointersRef.current.size === 2) {
            const pts = Array.from(pinchPointersRef.current.values());
            const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
            pinchStartDistRef.current = Math.hypot(dx, dy);
            pinchStartZoomRef.current = zoomLevel;
          }
        }}
        onPointerMove={(e) => {
          pinchPointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
          if (pinchPointersRef.current.size === 2) {
            const pts = Array.from(pinchPointersRef.current.values());
            const dx = pts[0].x - pts[1].x, dy = pts[0].y - pts[1].y;
            const dist = Math.hypot(dx, dy);
            if (pinchStartDistRef.current > 0) {
              const ratio = dist / pinchStartDistRef.current;
              const newZoom = Math.round(Math.min(200, Math.max(50, pinchStartZoomRef.current * ratio)) / 10) * 10;
              setZoomLevel(newZoom);
            }
          }
        }}
        onPointerUp={(e) => { pinchPointersRef.current.delete(e.pointerId); }}
        onPointerCancel={(e) => { pinchPointersRef.current.delete(e.pointerId); }}
      >
          <div
          className={`relative w-full h-full ${zoomScaleClass[zoomLevel] || 'scale-100'} transition-transform duration-200 ease-out bg-black`}
          >
            {activeScreen === 'BOTH' ? (
              <div className="w-full h-full grid grid-cols-1 md:grid-cols-2">
                <img
                  ref={frameRef}
                  src={frameUrl || undefined}
                  alt="Remote desktop stream (Screen 1)"
                  className="w-full h-full object-contain select-none cursor-crosshair border-b md:border-b-0 md:border-r border-gray-900 touch-none"
                  draggable={false}
                  onPointerDown={(e) => handlePointerDown(1, e)}
                  onPointerMove={(e) => handlePointerMove(1, e)}
                  onPointerUp={(e) => handlePointerUp(1, e)}
                  onPointerCancel={(e) => handlePointerUp(1, e)}
                  onDoubleClick={(e) => {
                    const image = frameRef.current;
                    if (!image) return;
                    const point = mapClientPointToNormalized(image, e.clientX, e.clientY);
                    if (!point) return;
                    sendDoubleClick(1, point);
                  }}
                />
                <img
                  ref={frameRef2}
                  src={frameUrl2 || undefined}
                  alt="Remote desktop stream (Screen 2)"
                  className="w-full h-full object-contain select-none cursor-crosshair touch-none"
                  draggable={false}
                  onPointerDown={(e) => handlePointerDown(2, e)}
                  onPointerMove={(e) => handlePointerMove(2, e)}
                  onPointerUp={(e) => handlePointerUp(2, e)}
                  onPointerCancel={(e) => handlePointerUp(2, e)}
                  onDoubleClick={(e) => {
                    const image = frameRef2.current;
                    if (!image) return;
                    const point = mapClientPointToNormalized(image, e.clientX, e.clientY);
                    if (!point) return;
                    sendDoubleClick(2, point);
                  }}
                />
              </div>
            ) : (
              <img
                ref={frameRef}
                src={frameUrl || undefined}
                alt="Remote desktop stream"
                className="w-full h-full object-contain select-none cursor-crosshair touch-none"
                draggable={false}
                onLoad={() => { /* handled by fetch loop */ }}
                onError={() => { /* handled by fetch loop */ }}
                onPointerDown={(e) => handlePointerDown(activeScreen === 'SCREEN_2' ? 2 : 1, e)}
                onPointerMove={(e) => handlePointerMove(activeScreen === 'SCREEN_2' ? 2 : 1, e)}
                onPointerUp={(e) => handlePointerUp(activeScreen === 'SCREEN_2' ? 2 : 1, e)}
                onPointerCancel={(e) => handlePointerUp(activeScreen === 'SCREEN_2' ? 2 : 1, e)}
                onDoubleClick={(e) => {
                  const image = frameRef.current;
                  if (!image) return;
                  const screen = activeScreen === 'SCREEN_2' ? 2 : 1;
                  const point = mapClientPointToNormalized(image, e.clientX, e.clientY);
                  if (!point) return;
                  sendDoubleClick(screen, point);
                }}
              />
            )}

             <div className="absolute bottom-0 inset-x-0 h-8 bg-black/80 flex items-center px-3 gap-2 pointer-events-none">
                 <div className={`w-2 h-2 rounded-full ${streamOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                 <div className="text-[10px] text-gray-400">{mouseMode === 'TRACKPAD' ? 'TRACKPAD: drag to move cursor, AA CLICK to click' : 'DIRECT: tap/click to click'} </div>
             </div>

             <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
               {!streamOnline && (
                <div className="px-4 py-3 rounded-xl border border-cyan-500/20 bg-black/50 backdrop-blur-sm text-center">
                  <div className="text-[11px] font-bold text-cyan-400 tracking-wider">LIVE VIEW</div>
                  <div className="text-[10px] text-gray-400 mt-1">Waiting for active remote stream...</div>
                </div>
               )}
             </div>
          </div>
      </div>

        <div className="border-t border-gray-800 bg-[#080808] p-4 pb-6 mb-24 shrink-0">
          <div className="flex justify-between items-end mb-4">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Input Controls</h3>
              <div className="text-[10px] text-gray-600 font-mono">{streamOnline ? 'LATENCY: LIVE' : 'LATENCY: --'}</div>
          </div>

          {streamError && <div className="text-[10px] text-red-400 mb-3">{streamError}</div>}

          {/* Zoom hint */}
          <div className="text-[9px] text-gray-600 font-mono mb-3 text-center">Pinch to zoom on mobile &mdash; current zoom: {zoomLevel}%</div>

          <div className="grid grid-cols-3 gap-3 mb-3">
              <button
                type="button"
                data-testid="remote-control-send-text"
                title="Send typed text"
                aria-label="Send typed text"
                onClick={sendTypedText}
                className="min-h-14 flex flex-col items-center justify-center p-3 bg-gray-900/50 border border-gray-800 rounded active:bg-cyan-900/20 active:border-cyan-500"
              >
                  <Keyboard size={20} className="text-gray-400 mb-1" />
                  <span className="text-[9px] font-bold text-gray-500">SEND TEXT</span>
              </button>

              <button
                type="button"
                data-testid="remote-control-aa-click"
                title="AA click (click at last cursor position)"
                aria-label="AA click"
                onClick={handleAAClick}
                className="min-h-14 flex flex-col items-center justify-center p-3 bg-gray-900/50 border border-gray-800 rounded active:bg-cyan-900/20 active:border-cyan-500"
              >
                  <MousePointerClick size={20} className="text-gray-300 mb-1" />
                  <span className="text-[9px] font-bold text-gray-400">AA CLICK</span>
              </button>

              <button
                type="button"
                data-testid="remote-control-trackpad"
                title="Toggle trackpad mode"
                aria-label="Toggle trackpad mode"
                onClick={() => setMouseMode(m => m === 'TRACKPAD' ? 'DIRECT' : 'TRACKPAD')}
                className={`min-h-14 flex flex-col items-center justify-center p-3 border rounded ${mouseMode === 'TRACKPAD' ? 'bg-cyan-900/20 border-cyan-500/50' : 'bg-gray-900/50 border-gray-800 active:bg-cyan-900/20 active:border-cyan-500'}`}
              >
                  <Move size={20} className={mouseMode === 'TRACKPAD' ? 'text-cyan-400 mb-1' : 'text-gray-400 mb-1'} />
                  <span className={`text-[9px] font-bold ${mouseMode === 'TRACKPAD' ? 'text-cyan-400' : 'text-gray-500'}`}>TRACKPAD</span>
              </button>
          </div>

          <input
            value={textInput}
            onChange={(event) => setTextInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                sendTypedText();
              }
            }}
            placeholder="Type and press Enter to send keyboard input"
            title="Type text to send to the remote desktop"
            aria-label="Type text to send to the remote desktop"
            className="w-full h-10 px-3 rounded bg-gray-900/60 border border-gray-800 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
      </div>
    </div>
  );
};