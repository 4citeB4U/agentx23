/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.NARRATION
LICENSE: MIT

PURPOSE: TTS/speech narration engine for Agent Lee.
         Consumes NarrationHook events from the controller and
         converts them to spoken utterances via Web Speech API.
         Respects NarrationMode: silent (off), guided (key moments),
         full (every action), conversational (dialog-style).
*/

import { NarrationHook, NarrationListener, NarrationMode } from "./types";

// ══════════════════════════════════════════════════════════════════════════
//  TTS ENGINE — Web Speech API
// ══════════════════════════════════════════════════════════════════════════

export interface TTSConfig {
  /** Voice name (must match an available SpeechSynthesisVoice) */
  voiceName: string;
  /** Speaking rate (0.1 – 10, default 1) */
  rate: number;
  /** Pitch (0 – 2, default 1) */
  pitch: number;
  /** Volume (0 – 1, default 0.9) */
  volume: number;
  /** Language (BCP-47, e.g., "en-US") */
  lang: string;
}

const DEFAULT_TTS_CONFIG: TTSConfig = {
  voiceName: "",
  rate: 1.05,
  pitch: 1.0,
  volume: 0.9,
  lang: "en-US",
};

/** Whether the current environment supports speech synthesis */
export function isTTSSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Get all available voices */
export function getAvailableVoices(): SpeechSynthesisVoice[] {
  if (!isTTSSupported()) return [];
  return window.speechSynthesis.getVoices();
}

/** Find a voice by name or language */
function findVoice(config: TTSConfig): SpeechSynthesisVoice | null {
  const voices = getAvailableVoices();
  if (config.voiceName) {
    const byName = voices.find((v) =>
      v.name.toLowerCase().includes(config.voiceName.toLowerCase()),
    );
    if (byName) return byName;
  }
  // Prefer Google voices, then en-US voices, then any voice
  const google = voices.find((v) => v.name.includes("Google") && v.lang.startsWith(config.lang.slice(0, 2)));
  if (google) return google;
  const langMatch = voices.find((v) => v.lang.startsWith(config.lang.slice(0, 2)));
  if (langMatch) return langMatch;
  return voices[0] || null;
}

let currentAudio: HTMLAudioElement | null = null;
let audioCtx: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch {}
  }
  return audioCtx;
}

/** Speak an utterance via Backend or Web Speech API fallback */
export async function speak(
  text: string,
  config: Partial<TTSConfig> = {},
  onEnd?: () => void,
): Promise<void> {
  if (!text.trim()) {
    if (onEnd) onEnd();
    return;
  }

  stopSpeech(); // Cancel any ongoing speech

  const handshake = localStorage.getItem("AGENT_LEE_KEY") || "AGENT_LEE_SOVEREIGN_V1";

  try {
    const r = await fetch("/api/chat/tts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-neural-handshake": handshake,
      },
      body: JSON.stringify({
        text: text.slice(0, 800),
        mode: "premium"
      }),
    });

    if (!r.ok) throw new Error("TTS backend failed");

    const blob = await r.blob();
    return new Promise<void>((resolve) => {
      if (blob.size === 0) {
        if (onEnd) onEnd();
        resolve();
        return;
      }

      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      currentAudio = audio;

      const finish = () => {
        URL.revokeObjectURL(url);
        currentAudio = null;
        if (onEnd) onEnd();
        resolve();
      };
      
      audio.onended = finish;
      audio.onerror = finish;

      const actx = getAudioContext();
      if (actx && actx.state === "suspended") actx.resume().catch(() => {});

      audio.play().catch(() => {
        const wactx = getAudioContext();
        if (!wactx) return finish();
        blob.arrayBuffer().then(ab => wactx.decodeAudioData(ab)).then(decoded => {
           const src = wactx.createBufferSource();
           src.buffer = decoded;
           src.connect(wactx.destination);
           src.onended = finish;
           src.start(0);
        }).catch(finish);
      });
    });
  } catch {
    // Fallback to local TTS
    return new Promise<void>((resolve) => {
      if (!isTTSSupported()) {
        if (onEnd) onEnd();
        resolve();
        return;
      }
      const merged = { ...DEFAULT_TTS_CONFIG, ...config };
      const utterance = new SpeechSynthesisUtterance(text);
      const voice = findVoice(merged);
      if (voice) utterance.voice = voice;
      utterance.rate = merged.rate;
      utterance.pitch = merged.pitch;
      utterance.volume = merged.volume;
      utterance.lang = merged.lang;

      utterance.onend = () => {
        if (onEnd) onEnd();
        resolve();
      };
      utterance.onerror = () => {
        if (onEnd) onEnd();
        resolve();
      };

      window.speechSynthesis.speak(utterance);
    });
  }
}

export function stopSpeech(): void {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
  if (isTTSSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function isSpeaking(): boolean {
  if (currentAudio && !currentAudio.paused) return true;
  if (!isTTSSupported()) return false;
  return window.speechSynthesis.speaking;
}

// ══════════════════════════════════════════════════════════════════════════
//  NARRATION MODE FILTER
// ══════════════════════════════════════════════════════════════════════════

/** Which narration points are spoken in each mode */
const MODE_FILTER: Record<NarrationMode, Set<NarrationHook["point"]>> = {
  silent: new Set(),
  guided: new Set([
    "goal_received",
    "plan_ready",
    "step_failed",
    "replan_triggered",
    "task_completed",
    "approval_needed",
    "device_action",
    "digital_life_started",
    "digital_life_completed",
  ]),
  full: new Set([
    "goal_received",
    "plan_ready",
    "step_started",
    "step_done",
    "step_failed",
    "replan_triggered",
    "task_completed",
    "research_found",
    "approval_needed",
    "device_action",
    "digital_life_started",
    "digital_life_completed",
    "device_verified",
  ]),
  conversational: new Set([
    "goal_received",
    "plan_ready",
    "step_started",
    "step_done",
    "step_failed",
    "replan_triggered",
    "task_completed",
    "research_found",
    "approval_needed",
    "device_action",
    "digital_life_started",
    "digital_life_completed",
    "device_verified",
  ]),
};

/** Conversational mode adds filler/context to utterances */
function conversationalize(hook: NarrationHook): string {
  const fillers = ["Alright, ", "Okay, ", "Got it. ", "One moment. ", "Let me ", ""];
  const filler = fillers[Math.floor(Math.random() * fillers.length)];

  switch (hook.point) {
    case "goal_received":
      return `${filler}I heard you. "${hook.utterance.slice(0, 80)}". Let me plan this out.`;
    case "plan_ready":
      return `${filler}I've created a plan. ${hook.utterance}`;
    case "step_started":
      return `${filler}Working on: ${hook.utterance}`;
    case "step_done":
      return `Done. ${hook.utterance}`;
    case "step_failed":
      return `Hmm, that didn't work. ${hook.utterance}`;
    case "replan_triggered":
      return `No worries, I'm adjusting the plan. ${hook.utterance}`;
    case "task_completed":
      return `All finished. ${hook.utterance}`;
    case "device_action":
      return `${filler}${hook.utterance}`;
    case "digital_life_started":
      return `${filler}Starting your ${hook.data?.flowType || "request"}. ${hook.utterance}`;
    case "digital_life_completed":
      return `Your ${hook.data?.flowType || "request"} is ready. ${hook.utterance}`;
    default:
      return hook.utterance;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  NARRATION ENGINE CLASS
// ══════════════════════════════════════════════════════════════════════════

export class NarrationEngine {
  private mode: NarrationMode = "guided";
  private config: TTSConfig = { ...DEFAULT_TTS_CONFIG };
  private queue: NarrationHook[] = [];
  private processing = false;
  private enabled = true;

  constructor(mode?: NarrationMode, config?: Partial<TTSConfig>) {
    if (mode) this.mode = mode;
    if (config) this.config = { ...DEFAULT_TTS_CONFIG, ...config };
  }

  /** Set narration mode */
  setMode(mode: NarrationMode): void {
    this.mode = mode;
    if (mode === "silent") {
      stopSpeech();
      this.queue = [];
    }
  }

  /** Get current mode */
  getMode(): NarrationMode {
    return this.mode;
  }

  /** Update TTS configuration */
  setConfig(config: Partial<TTSConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /** Enable / disable narration */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      stopSpeech();
      this.queue = [];
    }
  }

  /** The NarrationListener callback — wire this to controller.onNarration() */
  getListener(): NarrationListener {
    return (hook: NarrationHook) => this.enqueue(hook);
  }

  /** Enqueue a narration hook for speaking */
  private enqueue(hook: NarrationHook): void {
    if (!this.enabled || this.mode === "silent") return;

    const allowed = MODE_FILTER[this.mode];
    if (!allowed.has(hook.point)) return;

    this.queue.push(hook);
    if (!this.processing) this.processQueue();
  }

  /** Process queued narration hooks sequentially */
  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const hook = this.queue.shift()!;
      const text = this.mode === "conversational"
        ? conversationalize(hook)
        : hook.utterance;

      await speak(text, this.config);

      // Brief pause between utterances
      await new Promise((r) => setTimeout(r, 200));
    }

    this.processing = false;
  }

  /** Immediately stop narration */
  stop(): void {
    stopSpeech();
    this.queue = [];
    this.processing = false;
  }

  /** Check engine status */
  getStatus(): { supported: boolean; speaking: boolean; mode: NarrationMode; queueLength: number } {
    return {
      supported: isTTSSupported(),
      speaking: isSpeaking(),
      mode: this.mode,
      queueLength: this.queue.length,
    };
  }
}

// ── Singleton instance ────────────────────────────────────────────────────
let _engine: NarrationEngine | null = null;

export function getNarrationEngine(): NarrationEngine {
  if (!_engine) _engine = new NarrationEngine();
  return _engine;
}
