import { useCallback, useEffect, useRef, useState } from 'react';
import { CodeStudio } from './components/CodeStudio';
import { CreatorAccess } from './components/CreatorAccess';
import { AppDashboard } from './components/deployment/AppDashboard';
import MemoryLake from './components/MemoryLake';
import { PhoneView } from './components/PhoneView';
import { RemoteView } from './components/RemoteView';
import { SystemHub } from './components/SystemHub';
import { SystemTelemetry } from './components/SystemTelemetry';
import { BottomNav, CommandInput, MenuBar, MessageStream } from './components/UIModules';
import { VoxelCore } from './components/VoxelCore';
import { CoreConfig, CoreShape, Message, SystemMode, Tab } from './types';

const SHAPES: CoreShape[] = ['sphere', 'house', 'tree', 'dna', 'heart', 'star'];

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.COMMS);
  const [systemMode, setSystemMode] = useState<SystemMode>('VS_CODE');
  const [messages, setMessages] = useState<Message[]>([]);
  const [simRequest, setSimRequest] = useState<{ id: string; filename: string } | undefined>(undefined);

  const [coreConfig, setCoreConfig] = useState<CoreConfig>({
    shape: 'sphere',
    density: 15000,
    brightness: 1.2,
    speed: 1.0,
    autoMorphEnabled: true,
    morphSpeed: 6.0
  });

  const [audioIntensity, setAudioIntensity] = useState(0.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMicActive, setIsMicActive] = useState(false);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // AudioContext — created once on first user gesture to bypass autoplay policy
  const audioCtxRef = useRef<AudioContext | null>(null);
  const handshake = ((import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined) || localStorage.getItem('AGENT_LEE_KEY') || undefined;
  const [commsEnabled, setCommsEnabled] = useState<boolean>(Boolean(handshake));
  const [commsLockHint, setCommsLockHint] = useState<string>('COMMS locked (handshake invalid).');
  const [pendingPlan, setPendingPlan] = useState<{ steps: string[]; taskName: string } | null>(null);
  const [buildPlan, setBuildPlan] = useState<{ steps: string[]; taskName: string } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [unreadTgCount, setUnreadTgCount] = useState(0);

  // ── Autoplay unlock: create AudioContext on first user gesture ──────────
  const unlockAudio = useCallback(() => {
    if (audioCtxRef.current) {
      // Already created — just resume if suspended (iOS suspends on background)
      if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume().catch(() => {});
      return;
    }
    try {
      const ctx = new AudioContext();
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      audioCtxRef.current = ctx;
    } catch { /* browser may not support AudioContext */ }
  }, []);

  useEffect(() => {
    const events = ['click', 'keydown', 'touchstart', 'pointerdown'] as const;
    events.forEach(e => document.addEventListener(e, unlockAudio, { passive: true }));
    return () => events.forEach(e => document.removeEventListener(e, unlockAudio));
  }, [unlockAudio]);

  // ── TTS helpers (hoisted so handleCommand can pre-fire fetches) ──────────
  const fetchChunk = (chunk: string): Promise<Blob | null> => {
    const clipped = chunk.trim().slice(0, 350);
    if (!clipped) return Promise.resolve(null);
    return fetch('/api/chat/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(handshake ? { 'x-neural-handshake': handshake } : {}) },
      body: JSON.stringify({ text: clipped })
    })
      .then(res => (res.ok ? res.blob() : null))
      .catch(() => null);
  };

  const playBlob = (blob: Blob | null): Promise<void> =>
    new Promise<void>((resolve) => {
      if (!blob || blob.size === 0) { resolve(); return; }

      // Interrupt any currently playing audio so new message cuts in cleanly
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = '';
        currentAudioRef.current = null;
      }
      if (speakingTimerRef.current) clearTimeout(speakingTimerRef.current);

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      setIsSpeaking(true);

      const finish = () => {
        URL.revokeObjectURL(url);
        currentAudioRef.current = null;
        // Small debounce before marking not-speaking (prevents flicker between sentences)
        speakingTimerRef.current = setTimeout(() => setIsSpeaking(false), 400);
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;

      // Resume AudioContext first (unlocks autoplay after async ops on mobile/iOS/Chrome)
      const actx = audioCtxRef.current;
      if (actx?.state === 'suspended') actx.resume().catch(() => {});

      audio.play().catch(() => {
        // HTMLAudioElement blocked → decode + play via Web Audio API (bypasses autoplay gate)
        const wactx = audioCtxRef.current;
        if (!wactx) { finish(); return; }
        blob.arrayBuffer()
          .then(ab => wactx.decodeAudioData(ab))
          .then(decoded => {
            const src = wactx.createBufferSource();
            src.buffer = decoded;
            src.connect(wactx.destination);
            src.onended = finish;
            src.start(0);
            setIsSpeaking(true);
          })
          .catch(finish);
      });
    });

  // speakFrom: optionally accepts a pre-fired fetch so audio starts the instant
  // text appears — eliminates the text-visible → audio-starts gap entirely
  const speakFrom = async (text: string, preFetch?: Promise<Blob | null>) => {
    if (!text || text.length < 2) return;
    // Short responses: single shot — no sentence-splitting overhead
    if (text.length <= 300) {
      await playBlob(await (preFetch ?? fetchChunk(text)));
      setIsSpeaking(false);
      return;
    }
    // Longer: sentence pipeline — pre-fetch i+1 while i plays
    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];
    let nextFetch = preFetch ?? fetchChunk(sentences[0]);
    for (let i = 0; i < sentences.length; i++) {
      const blob = await nextFetch;
      if (i + 1 < sentences.length) nextFetch = fetchChunk(sentences[i + 1]);
      await playBlob(blob);
    }
    setIsSpeaking(false);
  };

  const speak = (text: string) => speakFrom(text);

  useEffect(() => {
    // Drive audioIntensity from actual speaking state:
    // when speaking → oscillate 0.4-0.9 to animate the avatar
    // when silent   → slowly decay to near-zero idle shimmer
    const interval = setInterval(() => {
      setAudioIntensity((prev) => {
        if (isSpeaking) {
          // Energetic oscillation while talking
          const target = 0.45 + Math.sin(Date.now() / 120) * 0.25 + Math.random() * 0.2;
          return prev + (target - prev) * 0.35;
        } else {
          // Idle shimmer: very low, gently drifting
          const idle = 0.03 + Math.random() * 0.04;
          return prev + (idle - prev) * 0.08;
        }
      });
    }, 60);
    return () => clearInterval(interval);
  }, [isSpeaking]);

  useEffect(() => {
    if (!coreConfig.autoMorphEnabled) return;
    const intervalId = setInterval(() => {
      setCoreConfig((previous) => {
        const currentIndex = SHAPES.indexOf(previous.shape);
        const nextIndex = (currentIndex + 1) % SHAPES.length;
        return { ...previous, shape: SHAPES[nextIndex] };
      });
    }, coreConfig.morphSpeed * 1000);
    return () => clearInterval(intervalId);
  }, [coreConfig.autoMorphEnabled, coreConfig.morphSpeed]);

  useEffect(() => {
    if (messages.length > 0) return;
    const welcomes = [
      "System's live. What are we working on?",
      "Agent Lee online. You know the assignment.",
      "All systems breathing. Talk to me.",
      "I'm here. What do you need?",
      "Yo. Stack's up, voice is locked. Let's build.",
      "Sovereign OS active. Where do we start?",
    ];
    const w = welcomes[Math.floor(Math.random() * welcomes.length)];
    setMessages([{ id: 'welcome-1', sender: 'agent', text: w, timestamp: new Date().toLocaleTimeString() }]);
    setTimeout(() => speak(w), 800);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch('/api/services/system-status', { headers: { ...(handshake ? { 'x-neural-handshake': handshake } : {}) } });
        const data = await res.json().catch(() => null);
        const valid = Boolean(data?.auth?.valid);
        const configured = Boolean(data?.auth?.configured);
        if (cancelled) return;
        setCommsEnabled(valid);
        if (!configured) setCommsLockHint('COMMS locked: backend handshake is not configured.');
        else if (!handshake) setCommsLockHint('COMMS locked: VITE_NEURAL_HANDSHAKE is missing in the UI runtime.');
        else setCommsLockHint('COMMS locked: handshake invalid. Restart with Run-All.ps1 so env is injected.');
      } catch {
        if (cancelled) return;
        setCommsEnabled(false);
        setCommsLockHint('COMMS locked: backend unreachable. Start the stack (Run-All.ps1 restart).');
      }
    };
    poll();
    const id = window.setInterval(poll, 8000);
    return () => { cancelled = true; window.clearInterval(id); };
  }, [handshake]);

  // ── Real-time Telegram ↔ UI bridge via Neural Bridge WebSocket ──────────
  useEffect(() => {
    const WS_PORT = Number((import.meta as any).env?.VITE_WS_PORT || 8003);
    const connect = () => {
      const url = `ws://localhost:${WS_PORT}`;
      let ws: WebSocket;
      try { ws = new WebSocket(url); } catch { return; }
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[ws-tg] Neural bridge connected — listening for Telegram messages');
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Only process messages from telegram that arrive via the neural bridge
          if (data?.source !== 'telegram') return;

          const sender = data.role === 'model' ? 'agent' : 'user';
          const newMsg: Message = {
            id: data.id || `tg-${Date.now()}`,
            sender,
            text: data.text || '',
            timestamp: new Date(data.timestamp || Date.now()).toLocaleTimeString(),
            source: 'telegram',
          };
          setMessages(prev => [...prev, newMsg]);
          // Track unread count only when Messages tab is not active
          setUnreadTgCount(prev => prev + 1);
        } catch { /* ignore malformed frames */ }
      };

      ws.onclose = () => {
        wsRef.current = null;
        // Auto-reconnect after 5 s
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => {
      wsRef.current?.close();
      wsRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset unread badge when user opens Messages tab
  useEffect(() => {
    if (activeTab === Tab.MESSAGES) setUnreadTgCount(0);
  }, [activeTab]);

  const handleMicToggle = () => {
    if (isMicActive) { recognitionRef.current?.stop(); setIsMicActive(false); return; }
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setMessages((prev) => [...prev, { id: `${Date.now()}-mic-err`, sender: 'system', text: 'Yo — your browser does not support Speech Recognition. Use Chrome or Edge.', timestamp: new Date().toLocaleTimeString() }]);
      return;
    }
    const rec = new SR();
    rec.lang = 'en-US'; rec.continuous = false; rec.interimResults = false;
    rec.onresult = (e: any) => { const t = e.results[0][0].transcript.trim(); if (t) handleCommand(t, true); };
    rec.onerror = (e: any) => { console.warn('[mic]', e.error); setIsMicActive(false); };
    rec.onend = () => setIsMicActive(false);
    rec.start();
    recognitionRef.current = rec;
    setIsMicActive(true);
  };

  const handleCommand = async (command: string, fromMic = false) => {
    if (!commsEnabled) {
      setMessages((previous) => [...previous, { id: `${Date.now()}-lock`, sender: 'system', text: commsLockHint, timestamp: new Date().toLocaleTimeString() }]);
      return;
    }
    // Only interrupt current speech when user sends a NEW command — NOT on tab changes
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = '';
      currentAudioRef.current = null;
      setIsSpeaking(false);
    }

    setMessages((previous) => [...previous, { id: Date.now().toString(), sender: 'user', text: command, timestamp: new Date().toLocaleTimeString() }]);

    // Build rolling conversation history (last 6 msgs = 3 user+agent pairs)
    // so Agent Lee remembers what was said across tabs and sessions
    const recentHistory = messages
      .filter(m => m.sender === 'user' || m.sender === 'agent')
      .slice(-6)
      .map(m => `${m.sender === 'user' ? 'User' : 'Agent Lee'}: ${m.text}`)
      .join('\n');

    // Inject current nav context so Agent Lee knows where the user is in the UI
    const navTag = `[NAV:${activeTab}] `;
    const contextualCommand = recentHistory
      ? `${recentHistory}\nUser: ${navTag}${command}`
      : navTag + command;

    let finalText = '';
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(handshake ? { 'x-neural-handshake': handshake } : {}) },
        body: JSON.stringify({ text: contextualCommand, source: fromMic ? 'voice' : 'web', id: `${Date.now()}-${Math.random().toString(16).slice(2)}` })
      });
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data && typeof data.text === 'string' && data.text.trim()) finalText = data.text.trim();
        // Parse build plan returned by consciousness
        if (data?.plan && Array.isArray(data.plan) && data.plan.length > 0) {
          const taskName = command.slice(0, 80);
          setPendingPlan({ steps: data.plan, taskName });
        }
      } else if (res.status === 401 || res.status === 403) {
        finalText = 'COMMS is locked - missing or invalid handshake. Restart with Run-All.ps1.';
      } else if (res.status === 429) {
        finalText = "Rate limited right now fam. Give it a second.";
      } else {
        const errData = await res.json().catch(() => null);
        finalText = errData?.error || `Backend returned ${res.status}. Check logs.`;
      }
    } catch {
      finalText = "COMMS backend is offline. Start the stack with Run-All.ps1.";
    }

    if (!finalText) finalText = "Yo, the neural bridge did not send back a clean response. Check the logs fam.";

    // Pre-fire TTS fetch NOW — in parallel with the React state update.
    // By the time the browser renders the message, audio is already downloading.
    const preFetch = fetchChunk(finalText.slice(0, 300));
    setMessages((previous) => [...previous, { id: (Date.now() + 1).toString(), sender: 'agent', text: finalText, timestamp: new Date().toLocaleTimeString() }]);
    speakFrom(finalText, preFetch);
  };

  // Tab-change commentary: Agent Lee reacts when the user navigates
  // — NEVER interrupts ongoing speech; waits until Agent Lee finishes talking first
  const prevTabRef = useRef<Tab | null>(null);
  const pendingTabCommentRef = useRef<string | null>(null);

  // Drain pending tab comment once speech finishes
  useEffect(() => {
    if (isSpeaking) return;
    const comment = pendingTabCommentRef.current;
    if (!comment || !commsEnabled) { pendingTabCommentRef.current = null; return; }
    pendingTabCommentRef.current = null;
    const id = `nav-${Date.now()}`;
    setMessages(prev => [...prev, { id, sender: 'agent', text: comment, timestamp: new Date().toLocaleTimeString() }]);
    const pre = fetchChunk(comment);
    speakFrom(comment, pre);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  useEffect(() => {
    if (prevTabRef.current === null) { prevTabRef.current = activeTab; return; }
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    if (!commsEnabled) return;
    const tabComments: Partial<Record<Tab, string[]>> = {
      [Tab.CODE]:   ["That's my mind space. Code Studio open.", "Stepping into the workshop."],
      [Tab.FILES]:  ["Memory Lake. You're in my archives.", "My memory banks. What are you looking for?"],
      [Tab.SYSTEM]: ["You pulled up my control panel.", "That's my nervous system right there."],
      [Tab.APPS]:   ["My creations. Every one of these is part of me.", "App space. What do you need to launch?"],
      [Tab.LIVE]:   ["Remote view active.", "Eyes outward."],
      [Tab.TELEMETRY]: ["My health report. I'm watching myself right now.", "Telemetry live."],
      [Tab.MESSAGES]: ["Unified inbox open. Telegram's in there too.", "All channels, one place."],
    };
    const opts = tabComments[activeTab];
    if (!opts) return;
    const comment = opts[Math.floor(Math.random() * opts.length)];
    if (isSpeaking) {
      // Queue it — will play after current speech ends (via the drain effect above)
      pendingTabCommentRef.current = comment;
    } else {
      setTimeout(() => {
        setMessages(prev => [...prev, { id: `nav-${Date.now()}`, sender: 'agent', text: comment, timestamp: new Date().toLocaleTimeString() }]);
        const pre = fetchChunk(comment);
        speakFrom(comment, pre);
      }, 350);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const isComms = activeTab === Tab.COMMS;

  return (
    <div className="fixed inset-0 bg-black text-gray-200 font-sans flex flex-col">
      {activeTab === Tab.CODE && <MenuBar />}
      <div className="absolute inset-0 holo-grid opacity-20 pointer-events-none z-0"></div>
      <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div
        id="agent-core-container"
        onClick={() => { if (!isComms) setActiveTab(Tab.COMMS); }}
        className={isComms
          ? 'relative z-30 h-[350px] w-full max-w-2xl mx-auto flex items-center justify-center shrink-0 mb-4 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] mt-4'
          : 'fixed bottom-6 left-6 z-50 w-20 h-20 rounded-full overflow-hidden border border-white/10 bg-black/40 backdrop-blur-xl shadow-[0_0_30px_rgba(0,163,255,0.3)] transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-110 cursor-pointer flex items-center justify-center'}
      >
        <VoxelCore active={true} config={coreConfig} audioIntensity={audioIntensity} isSpeaking={isSpeaking} interactive={isComms} />
        <div className={`absolute top-10 left-4 text-[9px] tracking-[0.2em] text-blue-400/60 font-mono transition-opacity duration-500 pointer-events-none ${isComms ? 'opacity-100' : 'opacity-0'}`}>
          FORM: {coreConfig.shape.toUpperCase()}
        </div>
        <div className={`absolute bottom-10 right-4 text-[9px] tracking-[0.2em] text-blue-400/60 font-mono transition-opacity duration-500 pointer-events-none ${isComms ? 'opacity-100' : 'opacity-0'}`}>
          AUTO: {coreConfig.autoMorphEnabled ? 'ON' : 'OFF'}
        </div>
      </div>

      <main className="flex-1 overflow-hidden relative z-10 flex flex-col pt-0">
        {activeTab === Tab.FILES && (<div className="w-full h-full animate-[fade-in_0.5s_ease-out]"><MemoryLake /></div>)}
        {activeTab === Tab.LIVE && (<div className="w-full h-full animate-[fade-in_0.5s_ease-out]"><RemoteView /></div>)}
        {activeTab === Tab.CODE && (<div className="w-full h-full animate-[fade-in_0.5s_ease-out]"><CodeStudio simulationRequest={simRequest} buildPlan={buildPlan} onBuildComplete={() => setBuildPlan(null)} /></div>)}
        {activeTab === Tab.SYSTEM && (<SystemHub currentMode={systemMode} setMode={setSystemMode} coreConfig={coreConfig} setCoreConfig={setCoreConfig} />)}
        {activeTab === Tab.PHONE && (<div className="w-full h-full animate-[fade-in_0.5s_ease-out]"><PhoneView /></div>)}
        {activeTab === Tab.TELEMETRY && (<div className="w-full h-full animate-[fade-in_0.5s_ease-out] relative z-40 flex items-center justify-center"><SystemTelemetry /></div>)}
        {activeTab === Tab.APPS && (<div className="w-full h-full animate-[fade-in_0.5s_ease-out] overflow-hidden"><AppDashboard /></div>)}
        {activeTab === Tab.COMMS && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar px-4 pb-40 flex flex-col items-center">
            <div className="w-full max-w-2xl space-y-4">
              <MessageStream messages={messages} />
            </div>
          </div>
        )}
        {activeTab === Tab.MESSAGES && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar px-4 pb-40 flex flex-col items-center animate-[fade-in_0.5s_ease-out]">
            <div className="w-full max-w-2xl space-y-4">
              <div className="flex items-center gap-3 px-1 pt-2 pb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">Unified Inbox</span>
                <div className="flex-1 h-px bg-blue-500/20" />
                <span className="text-[9px] text-gray-500 font-mono">{messages.filter(m => m.source === 'telegram').length} TG msgs</span>
              </div>
              <MessageStream messages={messages.filter(m => m.source === 'telegram' || m.sender === 'system')} />
            </div>
          </div>
        )}
      </main>

      {/* ── PERMANENT FOOTER: CommandInput always visible ── */}
      <CommandInput
        onCommand={handleCommand}
        onMicToggle={handleMicToggle}
        isMicEnabled={isMicActive}
        disabled={!commsEnabled}
        disabledHint={commsLockHint}
      />
      <BottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        unreadCounts={{ [Tab.MESSAGES]: unreadTgCount }}
      />

      {/* Build Plan Approval Overlay */}
      {pendingPlan && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center pb-32 px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-lg bg-[#0d1117] border border-blue-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,163,255,0.2)] p-5 animate-[fade-in_0.3s_ease-out]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">Agent Lee — Build Plan</span>
              <div className="flex-1 h-px bg-blue-500/20" />
              <button onClick={() => setPendingPlan(null)} className="text-gray-500 hover:text-white text-xs">✕</button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3 line-clamp-2 font-mono">{pendingPlan.taskName}</p>
            <ol className="space-y-1.5 mb-4">
              {pendingPlan.steps.map((step, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-gray-200">
                  <span className="text-blue-400 font-bold shrink-0 font-mono">{String(i + 1).padStart(2, '0')}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setBuildPlan(pendingPlan);
                  setPendingPlan(null);
                  setActiveTab(Tab.CODE);
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors tracking-wide"
              >
                ✅ Approve & Build
              </button>              <button
                onClick={() => {
                  setBuildPlan(pendingPlan);
                  setPendingPlan(null);
                  setActiveTab(Tab.LIVE);
                  // Switch from LIVE to CODE after 4 s so build progress is visible
                  setTimeout(() => setActiveTab(Tab.CODE), 4000);
                }}
                className="flex-1 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold py-2.5 rounded-xl transition-colors tracking-wide"
              >
                🖥️ Watch on VM
              </button>              <button
                onClick={() => setPendingPlan(null)}
                className="px-4 bg-white/5 hover:bg-white/10 text-gray-400 text-xs rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fade-in { from { opacity: 0; transform: scale(0.98); } to { opacity: 1; transform: scale(1); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* ── CREATOR ACCESS — Hidden green light, bottom-right corner ── */}
      <CreatorAccess
        onAuthenticated={(token) => {
          // Store token so rest of app can detect sovereign access
          (window as any).__CREATOR_SESSION__ = token;
        }}
      />
    </div>
  );
}

export default App;
