import { useCallback, useEffect, useRef, useState } from "react";
import { CodeStudio } from "./components/CodeStudio";
import { CreatorAccess } from "./components/CreatorAccess";
import { AppDashboard } from "./components/deployment/AppDashboard";
import { LeeVM } from "./components/LeeVM";
import MemoryLake from "./components/MemoryLake";
import { PhoneView } from "./components/PhoneView";
import { RemoteView } from "./components/RemoteView";
import { SystemHub } from "./components/SystemHub";
import { SystemTelemetry } from "./components/SystemTelemetry";
import { BottomNav, MenuBar, MessageStream } from "./components/UIModules";
import { VoxelCore } from "./components/VoxelCore";
import { useWakeWord } from "./hooks/useWakeWord";
import { CoreConfig, CoreShape, Message, SystemMode, Tab } from "./types";

// ── Command parser: converts a human-readable plan step to a shell command ──
function parsePlanStepToCmd(step: string): string | null {
  const s = step.toLowerCase().trim();
  const DIRECT_PREFIXES = [
    "npm",
    "npx",
    "node",
    "python",
    "python3",
    "pip",
    "pip3",
    "tsc",
    "git",
    "ls",
    "mkdir",
    "echo",
    "cat",
    "cp",
    "mv",
    "pwsh",
    "powershell",
  ];
  for (const prefix of DIRECT_PREFIXES) {
    if (s.startsWith(prefix + " ") || s === prefix) return step.trim();
  }
  if (
    s.includes("install dependencies") ||
    s.includes("npm install") ||
    s.includes("install packages")
  )
    return "npm install";
  if (
    s.includes("npm run build") ||
    s.includes("run build") ||
    s.includes("compile the")
  )
    return "npm run build";
  if (
    s.includes("run tests") ||
    s.includes("npm test") ||
    s.includes("execute tests")
  )
    return "npm test";
  if (s.includes("lint") || s.includes("npm run lint")) return "npm run lint";
  if (s.includes("git init")) return "git init";
  if (s.includes("git add") || s.includes("stage changes")) return "git add -A";
  if (s.includes("git commit")) return `git commit -m "Agent Lee auto-commit"`;
  if (s.includes("git status")) return "git status";
  return null;
}

type ChatSession = {
  id: string;
  name: string;
  ts: string;
  messages?: Message[];
};

const CHAT_SESSIONS_KEY = "agent_lee_sessions";

const getWelcomeMessage = (): Message => {
  const welcomes = [
    "System's live. What are we working on?",
    "Agent Lee online. You know the assignment.",
    "All systems breathing. Talk to me.",
    "I'm here. What do you need?",
    "Yo. Stack's up, voice is locked. Let's build.",
    "Sovereign OS active. Where do we start?",
  ];
  const text = welcomes[Math.floor(Math.random() * welcomes.length)];
  return {
    id: `welcome-${Date.now()}`,
    sender: "agent",
    text,
    timestamp: new Date().toLocaleTimeString(),
    source: "system",
  };
};

const loadChatSessions = (): ChatSession[] => {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const saveChatSessions = (sessions: ChatSession[]) => {
  localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions));
};

const SHAPES: CoreShape[] = [
  "sphere",
  "cube",
  "torus",
  "teddy_bear",
  "giraffe",
  "spaceship",
  "corvette",
  "heart",
  "shield",
  "crown",
  "butterfly",
  "lightning",
  "lotus",
  "icosahedron",
  "helix",
  "humanoid",
  "house",
  "tree",
  "star",
];

const NAV_REQUEST_PATTERN =
  /\b(open|show|take me|go to|switch to|bring up|pull up|launch|head to|move to|jump to)\b/;
const NAV_RESPONSE_PATTERN =
  /\b(opening|showing|taking you to|switching to|bringing up|pulling up|launching|heading to|moving to|jumping to|going to)\b/;

const NAV_TARGETS: Array<{ tab: Tab; pattern: RegExp }> = [
  {
    tab: Tab.CODE,
    pattern: /\b(code studio|coach studio|studio|editor|workspace)\b/,
  },
  {
    tab: Tab.VM,
    pattern:
      /\b(lee vm|virtual machine|sandbox|my machine|my computer|\bvm\b)\b/,
  },
  {
    tab: Tab.LIVE,
    pattern: /\b(remote|live view|desktop feed|screen share)\b/,
  },
  { tab: Tab.PHONE, pattern: /\b(phone|mobile)\b/ },
  {
    tab: Tab.FILES,
    pattern: /\b(data|files|file manager|memory lake|archive|archives)\b/,
  },
  { tab: Tab.APPS, pattern: /\b(app|apps)\b/ },
  {
    tab: Tab.SYSTEM,
    pattern: /\b(system|settings|control panel|\bsys\b)\b/,
  },
  { tab: Tab.MESSAGES, pattern: /\b(messages|message|telegram|inbox)\b/ },
  { tab: Tab.COMMS, pattern: /\b(home|comms|chat|main screen|start screen)\b/ },
];

const findNavigationTarget = (text: string): Tab | null => {
  const lowered = text.toLowerCase();
  for (const target of NAV_TARGETS) {
    if (target.pattern.test(lowered)) return target.tab;
  }
  return null;
};

const resolveRequestedTab = (text: string): Tab | null => {
  const lowered = text.toLowerCase();
  if (!NAV_REQUEST_PATTERN.test(lowered)) return null;
  return findNavigationTarget(lowered);
};

const resolvePromisedTab = (text: string): Tab | null => {
  const lowered = text.toLowerCase();
  if (!NAV_RESPONSE_PATTERN.test(lowered)) return null;
  return findNavigationTarget(lowered);
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.COMMS);
  const [systemMode, setSystemMode] = useState<SystemMode>("VS_CODE");
  const [messages, setMessages] = useState<Message[]>([]);
  const [simRequest, setSimRequest] = useState<
    { id: string; filename: string } | undefined
  >(undefined);

  const [coreConfig, setCoreConfig] = useState<CoreConfig>({
    shape: "sphere",
    density: 15000,
    brightness: 1.2,
    speed: 1.0,
    autoMorphEnabled: true,
    morphSpeed: 2.0,
  });

  const [audioIntensity, setAudioIntensity] = useState(0.0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [agentTurnBusy, setAgentTurnBusy] = useState(false);
  const [isVmOpen, setIsVmOpen] = useState(false);
  const [vmJobStatus, setVmJobStatus] = useState<string | null>(null);
  // isMicActive is now derived from wakeWord hook below — legacy ref kept for SpeechRecognition cleanup
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const speakingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const agentTurnBusyRef = useRef(false);
  const lastMicCommandRef = useRef<{ text: string; ts: number }>({
    text: "",
    ts: 0,
  });
  const suppressTabCommentRef = useRef<Tab | null>(null);
  // Generation counter — incremented on each speakFrom call to cancel stale pipelines
  const speakGenRef = useRef(0);
  // AudioContext — created once on first user gesture to bypass autoplay policy
  const audioCtxRef = useRef<AudioContext | null>(null);
  const handshake =
    ((import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined) ||
    localStorage.getItem("AGENT_LEE_KEY") ||
    "AGENT_LEE_SOVEREIGN_V1" ||
    undefined;
  const [commsEnabled, setCommsEnabled] = useState<boolean>(Boolean(handshake));
  const [commsLockHint, setCommsLockHint] = useState<string>(
    "COMMS locked (handshake invalid).",
  );
  const [pendingPlan, setPendingPlan] = useState<{
    steps: string[];
    taskName: string;
  } | null>(null);
  const [buildPlan, setBuildPlan] = useState<{
    steps: string[];
    taskName: string;
  } | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [unreadTgCount, setUnreadTgCount] = useState(0);
  const [currentSessionId, setCurrentSessionId] = useState<string>(
    () => `chat-${Date.now()}`,
  );

  useEffect(() => {
    agentTurnBusyRef.current = agentTurnBusy;
  }, [agentTurnBusy]);

  const stopCurrentSpeech = useCallback(() => {
    speakGenRef.current += 1;
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }
    if (speakingTimerRef.current) {
      clearTimeout(speakingTimerRef.current);
      speakingTimerRef.current = null;
    }
    setIsSpeaking(false);
  }, []);

  const appendSystemMessage = useCallback((text: string) => {
    setMessages((previous) => [
      ...previous,
      {
        id: `${Date.now()}-system`,
        sender: "system",
        text,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
  }, []);

  const navigateToTab = useCallback((tab: Tab) => {
    suppressTabCommentRef.current = tab;
    setActiveTab(tab);
  }, []);

  // ── Mic: simple 2-state ON/OFF ─────────────────────────────────────────
  // handleCommand is defined later; forward-ref via callback ref to break circular dep
  const handleCommandRef = useRef<(text: string, fromMic?: boolean) => void>(
    () => {},
  );
  const { micState, micColor, toggleMic } = useWakeWord({
    onCommand: (text) => handleCommandRef.current(text, true),
    onSpeechBarge: () => {
      stopCurrentSpeech();
    },
    paused: agentTurnBusy || isSpeaking,
    onError: appendSystemMessage,
  });
  const isMicActive = micState === "ON";

  // ── Autoplay unlock: create AudioContext on first user gesture ──────────
  const unlockAudio = useCallback(() => {
    if (audioCtxRef.current) {
      // Already created — just resume if suspended (iOS suspends on background)
      if (audioCtxRef.current.state === "suspended")
        audioCtxRef.current.resume().catch(() => {});
      return;
    }
    try {
      const ctx = new AudioContext();
      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      audioCtxRef.current = ctx;
    } catch {
      /* browser may not support AudioContext */
    }
  }, []);

  useEffect(() => {
    const events = ["click", "keydown", "touchstart", "pointerdown"] as const;
    events.forEach((e) =>
      document.addEventListener(e, unlockAudio, { passive: true }),
    );
    return () =>
      events.forEach((e) => document.removeEventListener(e, unlockAudio));
  }, [unlockAudio]);

  // ── TTS helpers (hoisted so handleCommand can pre-fire fetches) ──────────
  // Strip any content that would sound like gibberish when spoken aloud.
  const cleanForTTS = (raw: string): string =>
    raw
      // Remove BUILD_PLAN injection markers
      .replace(/BUILD_PLAN::[\s\S]+?::END_PLAN\n?/g, "")
      // Remove layer-stack context blocks
      .replace(/──+\s*LAYER STACK[\s\S]*?──+/g, "")
      .replace(/ACTIVE_LAYERS:[^\n]*/g, "")
      .replace(/KERNEL_ACTIVE:[^\n]*/g, "")
      .replace(/CONTEXT_LAYERS:[^\n]*/g, "")
      .replace(/LAYER_CONTRIBUTIONS:[\s\S]*?(?=\n[A-Z]|\n\n|$)/g, "")
      .replace(/SYSTEM_STATUS_CONTEXT:[^\n]*/g, "")
      // Remove markdown headings/bold/italic/code
      .replace(/#{1,6}\s+/g, "")
      .replace(/\*\*(.*?)\*\*/g, "$1")
      .replace(/\*(.*?)\*/g, "$1")
      .replace(/`{1,3}[^`]*`{1,3}/gs, "")
      // Remove markdown links — keep display text
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      // Remove JSON-like curly/square brackets
      .replace(/\{[^{}]*\}/g, "")
      .replace(/\[[^\[\]]*\]/g, "")
      // Remove emoji (common ranges)
      .replace(/[\u{1F300}-\u{1FFFF}\u{2600}-\u{27FF}\u{2B00}-\u{2BFF}]/gu, "")
      // Remove pipe | characters (plan step separators)
      .replace(/\|/g, ",")
      // Remove :: double colons
      .replace(/::/g, " ")
      // Normalise whitespace
      .replace(/[ \t]+/g, " ")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  const fetchChunk = (chunk: string): Promise<Blob | null> => {
    const clipped = cleanForTTS(chunk).slice(0, 350);
    if (!clipped) return Promise.resolve(null);
    // Route normal speech through premium Gemini TTS; edge remains server-side fallback only.
    return fetch("/api/chat/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(handshake ? { "x-neural-handshake": handshake } : {}),
      },
      body: JSON.stringify({
        text: clipped,
        mode: "premium",
        voiceProfile: "inspirational",
        tone: "bright, energetic, uplifting",
      }),
    })
      .then((res) => (res.ok ? res.blob() : null))
      .catch(() => null);
  };

  const playBlob = (blob: Blob | null): Promise<void> =>
    new Promise<void>((resolve) => {
      if (!blob || blob.size === 0) {
        resolve();
        return;
      }

      // Interrupt any currently playing audio so new message cuts in cleanly
      if (currentAudioRef.current) {
        currentAudioRef.current.pause();
        currentAudioRef.current.src = "";
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
        // Immediate mark as not-speaking for faster mic response
        setIsSpeaking(false);
        resolve();
      };
      audio.onended = finish;
      audio.onerror = finish;

      // Resume AudioContext first (unlocks autoplay after async ops on mobile/iOS/Chrome)
      const actx = audioCtxRef.current;
      if (actx?.state === "suspended") actx.resume().catch(() => {});

      audio.play().catch(() => {
        // HTMLAudioElement blocked → decode + play via Web Audio API (bypasses autoplay gate)
        const wactx = audioCtxRef.current;
        if (!wactx) {
          finish();
          return;
        }
        blob
          .arrayBuffer()
          .then((ab) => wactx.decodeAudioData(ab))
          .then((decoded) => {
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
  // text appears — eliminates the text-visible → audio-starts gap entirely.
  // Uses speakGenRef to cancel stale pipelines — if a new speakFrom fires while one is
  // in-flight, the old pipeline detects the generation mismatch and bails out.
  const speakFrom = async (text: string, preFetch?: Promise<Blob | null>) => {
    if (!text || text.length < 2) return;

    // Cancel any in-flight pipeline and claim this generation
    const gen = ++speakGenRef.current;

    // Interrupt currently playing audio immediately
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
      currentAudioRef.current.src = "";
      currentAudioRef.current = null;
    }

    const sentences = text.match(/[^.!?]+[.!?]+\s*/g) || [text];

    // Short responses or single-sentence replies: single shot.
    if (text.length <= 300 || sentences.length <= 1) {
      const blob = await (preFetch ?? fetchChunk(text));
      if (speakGenRef.current !== gen) return; // superseded
      await playBlob(blob);
      if (speakGenRef.current === gen) setIsSpeaking(false);
      return;
    }

    // Longer: sentence pipeline — fetch exactly one sentence per audio chunk.
    // Ignore any whole-response prefetch here so we never replay overlapping text.
    let nextFetch = fetchChunk(sentences[0]);
    for (let i = 0; i < sentences.length; i++) {
      if (speakGenRef.current !== gen) return; // superseded
      const blob = await nextFetch;
      if (speakGenRef.current !== gen) return; // superseded
      if (i + 1 < sentences.length) nextFetch = fetchChunk(sentences[i + 1]);
      await playBlob(blob);
    }
    if (speakGenRef.current === gen) setIsSpeaking(false);
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
          const target =
            0.45 + Math.sin(Date.now() / 120) * 0.25 + Math.random() * 0.2;
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

  // Load persisted chat history from backend on mount
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const res = await fetch("/api/chat/history", {
          headers: {
            ...(handshake ? { "x-neural-handshake": handshake } : {}),
          },
        });
        if (!res.ok) return;
        const data = await res.json().catch(() => null);
        if (!data?.messages?.length) return;
        const loaded: Message[] = data.messages.map((m: any) => ({
          id: m.id || `hist-${Math.random().toString(16).slice(2)}`,
          sender:
            m.role === "model"
              ? "agent"
              : m.role === "user"
                ? "user"
                : "system",
          text: m.text || m.content || "",
          timestamp: m.timestamp
            ? new Date(m.timestamp).toLocaleTimeString()
            : new Date().toLocaleTimeString(),
          source: m.source,
        }));
        setMessages(loaded);
        if (loaded.length > 0) {
          const existing = loadChatSessions();
          const alreadyArchived = existing.some(
            (session) => session.messages?.[0]?.id === loaded[0]?.id,
          );
          if (!alreadyArchived) {
            saveChatSessions([
              {
                id: currentSessionId,
                name: `Chat ${new Date().toLocaleDateString()}`,
                ts: new Date().toLocaleString(),
                messages: loaded,
              },
              ...existing,
            ]);
          }
        }
      } catch {
        /* history unavailable — silent fallback to welcome message */
      }
    };
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (messages.length > 0) return;
    setMessages([getWelcomeMessage()]);
  }, [messages.length]);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch("/api/services/system-status", {
          headers: {
            ...(handshake ? { "x-neural-handshake": handshake } : {}),
          },
        });
        const data = await res.json().catch(() => null);
        const valid = Boolean(data?.auth?.valid);
        const configured = Boolean(data?.auth?.configured);
        if (cancelled) return;
        setCommsEnabled(valid);
        if (!configured)
          setCommsLockHint(
            "COMMS locked: backend handshake is not configured.",
          );
        else if (!handshake)
          setCommsLockHint(
            "COMMS locked: VITE_NEURAL_HANDSHAKE is missing in the UI runtime.",
          );
        else
          setCommsLockHint(
            "COMMS locked: handshake invalid. Restart with Run-All.ps1 so env is injected.",
          );
      } catch {
        if (cancelled) return;
        setCommsEnabled(false);
        setCommsLockHint(
          "COMMS locked: backend unreachable. Start the stack (Run-All.ps1 restart).",
        );
      }
    };
    poll();
    const id = window.setInterval(poll, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [handshake]);

  // ── Real-time Telegram ↔ UI bridge via Neural Bridge WebSocket ──────────
  useEffect(() => {
    // Only attempt WebSocket on localhost — through a tunnel (phone) it can't reach localhost:6003
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") return;

    const WS_PORT = Number((import.meta as any).env?.VITE_WS_PORT || 6003);
    const connect = () => {
      const url = `ws://localhost:${WS_PORT}`;
      let ws: WebSocket;
      try {
        ws = new WebSocket(url);
      } catch {
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        console.log(
          "[ws-tg] Neural bridge connected — listening for Telegram messages",
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Only process messages from telegram that arrive via the neural bridge
          if (data?.source !== "telegram") return;

          const sender = data.role === "model" ? "agent" : "user";
          const newMsg: Message = {
            id: data.id || `tg-${Date.now()}`,
            sender,
            text: data.text || "",
            timestamp: new Date(
              data.timestamp || Date.now(),
            ).toLocaleTimeString(),
            source: "telegram",
          };
          setMessages((prev) => [...prev, newMsg]);
          // Track unread count only when Messages tab is not active
          setUnreadTgCount((prev) => prev + 1);
        } catch {
          /* ignore malformed frames */
        }
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

  // Wake-word hook provides handleMicToggle (2-state: OFF→ON→OFF)
  const handleMicToggle = useCallback(() => {
    unlockAudio();
    toggleMic();
  }, [toggleMic, unlockAudio]);

  // Keep handleCommandRef in sync so useWakeWord can call it without stale closure
  useEffect(() => {
    handleCommandRef.current = handleCommand;
  });

  const handleCommand = async (command: string, fromMic = false) => {
    const cleanedCommand = command.trim();
    if (!cleanedCommand) return;
    const requestedTab = resolveRequestedTab(cleanedCommand);

    if (fromMic) {
      const now = Date.now();
      if (agentTurnBusyRef.current) return;
      if (
        lastMicCommandRef.current.text === cleanedCommand &&
        now - lastMicCommandRef.current.ts < 2000
      ) {
        return;
      }
      lastMicCommandRef.current = { text: cleanedCommand, ts: now };
    }

    if (!commsEnabled) {
      setMessages((previous) => [
        ...previous,
        {
          id: `${Date.now()}-lock`,
          sender: "system",
          text: commsLockHint,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
      return;
    }
    setAgentTurnBusy(true);
    try {
      // Only interrupt current speech when user sends a NEW command — NOT on tab changes
      stopCurrentSpeech();
      if (requestedTab && requestedTab !== activeTab) {
        navigateToTab(requestedTab);
      }

      setMessages((previous) => [
        ...previous,
        {
          id: Date.now().toString(),
          sender: "user",
          text: cleanedCommand,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // Inject current nav context so Agent Lee knows where the user is in the UI
      // History context is managed by the backend router — do NOT inject it here to prevent snowballing
      const navContext = requestedTab ?? activeTab;
      const navTag = `[NAV:${navContext}] `;
      const contextualCommand = navTag + cleanedCommand;

      let finalText = "";
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(handshake ? { "x-neural-handshake": handshake } : {}),
          },
          body: JSON.stringify({
            text: contextualCommand,
            source: fromMic ? "voice" : "web",
            id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => null);
          if (data && typeof data.text === "string" && data.text.trim())
            finalText = data.text.trim();
          // Parse build plan returned by consciousness
          if (data?.plan && Array.isArray(data.plan) && data.plan.length > 0) {
            const taskName = cleanedCommand.slice(0, 80);
            setPendingPlan({ steps: data.plan, taskName });
          }
        } else if (res.status === 401 || res.status === 403) {
          finalText =
            "COMMS is locked - missing or invalid handshake. Restart with Run-All.ps1.";
        } else if (res.status === 429) {
          finalText = "Rate limited right now fam. Give it a second.";
        } else {
          const errData = await res.json().catch(() => null);
          finalText =
            errData?.error || `Backend returned ${res.status}. Check logs.`;
        }
      } catch {
        finalText =
          "COMMS backend is offline. Start the stack with Run-All.ps1.";
      }

      if (!finalText)
        finalText =
          "Yo, the neural bridge did not send back a clean response. Check the logs fam.";

      const promisedTab = resolvePromisedTab(finalText);
      if (promisedTab && promisedTab !== (requestedTab ?? activeTab)) {
        navigateToTab(promisedTab);
      }

      // Pre-fire TTS fetch NOW — in parallel with the React state update.
      // By the time the browser renders the message, audio is already downloading.
      const preFetch = fetchChunk(finalText.slice(0, 300));
      setMessages((previous) => [
        ...previous,
        {
          id: (Date.now() + 1).toString(),
          sender: "agent",
          text: finalText,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);

      // DEBLOCK: We no longer await speakFrom here.
      // This releases agentTurnBusy IMMEDIATELY after the backend response arrives,
      // allowing the mic to re-activate WHILE Agent Lee is still speaking.
      speakFrom(finalText, preFetch);
    } finally {
      setAgentTurnBusy(false);
    }
  };

  // Tab-change commentary: Agent Lee reacts when the user navigates
  // — NEVER interrupts ongoing speech; waits until Agent Lee finishes talking first
  const prevTabRef = useRef<Tab | null>(null);
  const pendingTabCommentRef = useRef<string | null>(null);

  // Drain pending tab comment once speech finishes
  useEffect(() => {
    if (isSpeaking) return;
    const comment = pendingTabCommentRef.current;
    if (!comment || !commsEnabled) {
      pendingTabCommentRef.current = null;
      return;
    }
    pendingTabCommentRef.current = null;
    const id = `nav-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id,
        sender: "agent",
        text: comment,
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);
    const pre = fetchChunk(comment);
    speakFrom(comment, pre);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSpeaking]);

  useEffect(() => {
    if (prevTabRef.current === null) {
      prevTabRef.current = activeTab;
      return;
    }
    if (prevTabRef.current === activeTab) return;
    prevTabRef.current = activeTab;
    if (suppressTabCommentRef.current === activeTab) {
      suppressTabCommentRef.current = null;
      return;
    }
    if (!commsEnabled) return;
    const tabComments: Partial<Record<Tab, string[]>> = {
      [Tab.CODE]: [
        "That's my mind space. Code Studio open.",
        "Stepping into the workshop.",
      ],
      [Tab.FILES]: [
        "Memory Lake. You're in my archives.",
        "My memory banks. What are you looking for?",
      ],
      [Tab.SYSTEM]: [
        "You pulled up my control panel.",
        "That's my nervous system right there.",
      ],
      [Tab.APPS]: [
        "My creations. Every one of these is part of me.",
        "App space. What do you need to launch?",
      ],
      [Tab.VM]: [
        "My machine. The sandbox is live and ready.",
        "Stepping into my own system. Nothing touches your files until I say so.",
      ],
      [Tab.LIVE]: ["Remote view active.", "Eyes outward."],
      [Tab.TELEMETRY]: [
        "My health report. I'm watching myself right now.",
        "Telemetry live.",
      ],
      [Tab.MESSAGES]: [
        "Unified inbox open. Telegram's in there too.",
        "All channels, one place.",
      ],
    };
    const opts = tabComments[activeTab];
    if (!opts) return;
    const comment = opts[Math.floor(Math.random() * opts.length)];
    if (isSpeaking) {
      // Queue it — will play after current speech ends (via the drain effect above)
      pendingTabCommentRef.current = comment;
    } else {
      <div className="absolute inset-0 holo-grid opacity-20 pointer-events-none z-0"></div>;
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `nav-${Date.now()}`,
            sender: "agent",
            text: comment,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        const pre = fetchChunk(comment);
        speakFrom(comment, pre);
      }, 350);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  const archiveCurrentChat = useCallback(() => {
    const meaningful = messages.filter(
      (message) => message.text.trim() && message.source !== "system",
    );
    if (meaningful.length === 0) return;

    const existing = loadChatSessions();
    const updated = [
      {
        id: currentSessionId,
        name:
          meaningful
            .find((message) => message.sender === "user")
            ?.text.slice(0, 32) || `Chat ${new Date().toLocaleDateString()}`,
        ts: new Date().toLocaleString(),
        messages,
      },
      ...existing.filter((session) => session.id !== currentSessionId),
    ];
    saveChatSessions(updated);
  }, [currentSessionId, messages]);

  const handleNewChat = useCallback(async () => {
    archiveCurrentChat();

    try {
      await fetch("/api/chat/clear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(handshake ? { "x-neural-handshake": handshake } : {}),
        },
      });
    } catch {
      /* local reset still proceeds */
    }

    const nextSessionId = `chat-${Date.now()}`;
    setCurrentSessionId(nextSessionId);
    setPendingPlan(null);
    setBuildPlan(null);
    setMessages([getWelcomeMessage()]);
    setActiveTab(Tab.COMMS);
  }, [archiveCurrentChat, handshake]);

  const handleDeleteChat = useCallback(
    async (sessionId: string) => {
      if (sessionId !== currentSessionId) return;
      try {
        await fetch("/api/chat/clear", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(handshake ? { "x-neural-handshake": handshake } : {}),
          },
        });
      } catch {
        /* local reset still proceeds */
      }
      setCurrentSessionId(`chat-${Date.now()}`);
      setMessages([getWelcomeMessage()]);
    },
    [currentSessionId, handshake],
  );

  const isComms = activeTab === Tab.COMMS;

  return (
    <div className="fixed inset-0 bg-black text-gray-200 font-sans flex flex-col">
      {activeTab === Tab.CODE && <MenuBar />}
      <div className="absolute inset-0 holo-grid opacity-20 pointer-events-none z-0"></div>
      <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-blue-900/20 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-20%] w-[50%] h-[50%] bg-purple-900/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div
        id="agent-core-container"
        onClick={() => {
          if (!isComms) setActiveTab(Tab.COMMS);
        }}
        className={
          isComms
            ? "relative z-30 h-[350px] w-full max-w-2xl mx-auto flex items-center justify-center shrink-0 mb-4 transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] mt-4"
            : "fixed bottom-6 left-6 z-50 w-24 h-24 rounded-full overflow-hidden border border-cyan-300/30 bg-slate-900/65 backdrop-blur-xl shadow-[0_0_36px_rgba(0,200,255,0.45)] transition-all duration-700 ease-[cubic-bezier(0.25,1,0.5,1)] hover:scale-110 cursor-pointer flex items-center justify-center"
        }
      >
        <VoxelCore
          active={true}
          config={coreConfig}
          audioIntensity={audioIntensity}
          isSpeaking={isSpeaking}
        />
        <div
          className={`absolute top-10 left-4 text-[9px] tracking-[0.2em] text-blue-400/60 font-mono transition-opacity duration-500 pointer-events-none ${isComms ? "opacity-100" : "opacity-0"}`}
        >
          FORM: {coreConfig.shape.toUpperCase()}
        </div>
        <div
          className={`absolute bottom-10 right-4 text-[9px] tracking-[0.2em] text-blue-400/60 font-mono transition-opacity duration-500 pointer-events-none ${isComms ? "opacity-100" : "opacity-0"}`}
        >
          AUTO: {coreConfig.autoMorphEnabled ? "ON" : "OFF"}
        </div>
      </div>

      <main className="flex-1 overflow-hidden relative z-10 flex flex-col pt-0 pb-[120px]">
        {activeTab === Tab.FILES && (
          <div className="w-full h-full animate-[fade-in_0.5s_ease-out]">
            <MemoryLake />
          </div>
        )}
        {activeTab === Tab.LIVE && (
          <div className="absolute inset-0 bottom-[120px] animate-[fade-in_0.5s_ease-out]">
            <RemoteView />
          </div>
        )}
        {activeTab === Tab.CODE && (
          <div className="w-full h-full animate-[fade-in_0.5s_ease-out]">
            <CodeStudio
              simulationRequest={simRequest}
              buildPlan={buildPlan}
              onBuildComplete={() => setBuildPlan(null)}
            />
          </div>
        )}
        {activeTab === Tab.SYSTEM && (
          <SystemHub
            currentMode={systemMode}
            setMode={setSystemMode}
            coreConfig={coreConfig}
            setCoreConfig={setCoreConfig}
          />
        )}
        {activeTab === Tab.PHONE && (
          <div className="w-full h-full animate-[fade-in_0.5s_ease-out]">
            <PhoneView />
          </div>
        )}
        {activeTab === Tab.TELEMETRY && (
          <div className="w-full h-full animate-[fade-in_0.5s_ease-out] relative z-40 flex items-center justify-center">
            <SystemTelemetry />
          </div>
        )}
        {activeTab === Tab.APPS && (
          <div className="w-full h-full animate-[fade-in_0.5s_ease-out] overflow-hidden">
            <AppDashboard />
          </div>
        )}
        {/* VM renders as a floating popup overlay — never replaces main content */}
        {activeTab === Tab.COMMS && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar px-4 pb-40 flex flex-col items-center">
            <div className="w-full max-w-2xl space-y-4">
              {/* Phone companion download strip */}
              <div className="flex items-center gap-2 px-1 pt-2 pb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">
                  COMMS
                </span>
                <div className="flex-1 h-px bg-blue-500/20" />
                <a
                  href="/workspace/agentlee_vm/agent-lee-companion.html"
                  download="agent-lee-companion.html"
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 border border-cyan-500/30 rounded-full px-2.5 py-1 transition-colors"
                  title="Download the Android companion PWA to your phone"
                >
                  📱 Get Phone Companion
                </a>
              </div>
              <MessageStream
                messages={messages}
                isThinking={agentTurnBusy && !isSpeaking}
              />
            </div>
          </div>
        )}
        {activeTab === Tab.MESSAGES && (
          <div className="w-full h-full overflow-y-auto custom-scrollbar px-4 pb-40 flex flex-col items-center animate-[fade-in_0.5s_ease-out]">
            <div className="w-full max-w-2xl space-y-4">
              <div className="flex items-center gap-3 px-1 pt-2 pb-1">
                <span className="text-[10px] font-bold tracking-widest uppercase text-blue-400">
                  Unified Inbox
                </span>
                <div className="flex-1 h-px bg-blue-500/20" />
                <span className="text-[9px] text-gray-500 font-mono">
                  {messages.filter((m) => m.source === "telegram").length} TG
                  msgs
                </span>
              </div>
              <MessageStream
                messages={messages.filter(
                  (m) => m.source === "telegram" || m.sender === "system",
                )}
              />
            </div>
          </div>
        )}
      </main>

      {/* ── PERMANENT FOOTER: CommandInput always visible ── */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(t) => {
          if (t === Tab.VM) setIsVmOpen(true);
          else setActiveTab(t);
        }}
        unreadCounts={{ [Tab.MESSAGES]: unreadTgCount }}
        onCommand={handleCommand}
        onMicToggle={handleMicToggle}
        isMicEnabled={isMicActive}
        micColor={micColor}
        disabled={!commsEnabled}
        disabledHint={commsLockHint}
        onNewChat={handleNewChat}
        onDeleteChat={handleDeleteChat}
      />

      {/* ── FLOATING VM OVERLAY — popup, never replaces main view ── */}
      {isVmOpen && (
        <div
          className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsVmOpen(false);
          }}
        >
          <div className="w-[96vw] h-[92vh] max-w-[1280px] max-h-[820px] relative rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(0,163,255,0.25)]">
            <button
              className="absolute top-3 right-3 z-[160] text-white/60 hover:text-white bg-black/50 border border-white/10 rounded-full w-7 h-7 flex items-center justify-center text-sm leading-none"
              onClick={() => setIsVmOpen(false)}
              title="Close VM"
            >
              ✕
            </button>
            {vmJobStatus && (
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-[160] px-4 py-1.5 bg-blue-600/80 text-white text-xs rounded-full font-mono">
                {vmJobStatus}
              </div>
            )}
            <LeeVM />
          </div>
        </div>
      )}

      {/* Build Plan Approval Overlay */}
      {pendingPlan && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center pb-32 px-4 pointer-events-none">
          <div className="pointer-events-auto w-full max-w-lg bg-[#0d1117] border border-blue-500/40 rounded-2xl shadow-[0_0_40px_rgba(0,163,255,0.2)] p-5 animate-[fade-in_0.3s_ease-out]">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-blue-400 text-xs font-bold tracking-widest uppercase">
                Agent Lee — Build Plan
              </span>
              <div className="flex-1 h-px bg-blue-500/20" />
              <button
                onClick={() => setPendingPlan(null)}
                className="text-gray-500 hover:text-white text-xs"
              >
                ✕
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mb-3 line-clamp-2 font-mono">
              {pendingPlan.taskName}
            </p>
            <ol className="space-y-1.5 mb-4">
              {pendingPlan.steps.map((step, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-[12px] text-gray-200"
                >
                  <span className="text-blue-400 font-bold shrink-0 font-mono">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const plan = pendingPlan!;
                  setPendingPlan(null);
                  setIsVmOpen(true);
                  setVmJobStatus("Running build plan in VM…");
                  appendSystemMessage(
                    `▶ Executing build plan: "${plan.taskName}"`,
                  );
                  for (const step of plan.steps) {
                    const cmd = parsePlanStepToCmd(step);
                    if (!cmd) {
                      appendSystemMessage(
                        `⚙ Step skipped (no shell command detected): ${step}`,
                      );
                      continue;
                    }
                    try {
                      const r = await fetch("/api/vm/sandbox/exec", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-neural-handshake":
                            handshake ?? "AGENT_LEE_SOVEREIGN_V1",
                        },
                        body: JSON.stringify({ cmd, cwd: "/home/agent_lee" }),
                      });
                      if (!r.ok) {
                        appendSystemMessage(
                          `⚠ VM exec error for: ${cmd} (${r.status})`,
                        );
                        continue;
                      }
                      const d = await r.json();
                      if (d.jobId)
                        appendSystemMessage(
                          `▶ VM running: ${cmd} → job ${String(d.jobId).slice(0, 8)}…`,
                        );
                    } catch {
                      appendSystemMessage(
                        `⚠ VM unreachable — could not run: ${cmd}`,
                      );
                    }
                  }
                  setVmJobStatus(null);
                  appendSystemMessage(
                    "✅ All plan steps dispatched. Check the VM terminal for live output.",
                  );
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2.5 rounded-xl transition-colors tracking-wide"
              >
                ✅ Approve & Build
              </button>{" "}
              <button
                onClick={async () => {
                  const plan = pendingPlan!;
                  setPendingPlan(null);
                  setIsVmOpen(true);
                  appendSystemMessage(
                    `🖥️ Dispatching to VM: "${plan.taskName}"`,
                  );
                  for (const step of plan.steps) {
                    const cmd = parsePlanStepToCmd(step);
                    if (!cmd) continue;
                    try {
                      const r = await fetch("/api/vm/sandbox/exec", {
                        method: "POST",
                        headers: {
                          "Content-Type": "application/json",
                          "x-neural-handshake":
                            handshake ?? "AGENT_LEE_SOVEREIGN_V1",
                        },
                        body: JSON.stringify({ cmd, cwd: "/home/agent_lee" }),
                      });
                      if (r.ok) {
                        const d = await r.json();
                        if (d.jobId)
                          appendSystemMessage(
                            `▶ VM: ${cmd} → job ${String(d.jobId).slice(0, 8)}…`,
                          );
                      }
                    } catch {
                      /* continue on error */
                    }
                  }
                }}
                className="flex-1 bg-purple-700 hover:bg-purple-600 text-white text-xs font-bold py-2.5 rounded-xl transition-colors tracking-wide"
              >
                🖥️ Watch on VM
              </button>{" "}
              <button
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
