// LEEWAY v12 HEADER
// File: .Agent_Lee_OS/hooks/useWakeWord.ts
// Purpose: Simple two-state mic hook (OFF / ON).
//   OFF → mic idle, not listening
//   ON  → mic active, continuous recognition; final transcripts fire onCommand
//
// Usage:
//   const { micState, micColor, toggleMic } = useWakeWord({ onCommand, onSpeechBarge });

import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "OFF" | "ON";

interface UseWakeWordOptions {
  /** Called when a final transcript is captured while mic is ON */
  onCommand: (text: string) => void;
  /** Called on interim speech — allows App to pause TTS (barge-in) */
  onSpeechBarge?: () => void;
  /** Pause listening temporarily while Agent Lee is speaking or processing */
  paused?: boolean;
  /** Surface actionable mic failures back to the UI */
  onError?: (message: string) => void;
  /** Language for recognition (default: en-US) */
  lang?: string;
}

interface UseWakeWordReturn {
  micState: MicState;
  /** CSS colour token for the mic button: gray (off) | red (on/listening) */
  micColor: "gray" | "red";
  /** Toggle mic: OFF→ON, ON→OFF */
  toggleMic: () => void;
  /** No-op kept for API compat — background wake-word listening removed */
  startWakeWordListen: () => void;
}

export function useWakeWord({
  onCommand,
  onSpeechBarge,
  paused = false,
  onError,
  lang = "en-US",
}: UseWakeWordOptions): UseWakeWordReturn {
  const [micState, setMicState] = useState<MicState>("OFF");
  const recRef = useRef<any>(null);
  const stateRef = useRef<MicState>("OFF");
  const pausedRef = useRef(paused);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isStartingRef = useRef(false);
  const pendingTranscriptRef = useRef("");
  const lastFinalRef = useRef<{ text: string; ts: number }>({
    text: "",
    ts: 0,
  });

  const onCommandRef = useRef(onCommand);
  const onSpeechBargeRef = useRef(onSpeechBarge);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onCommandRef.current = onCommand;
    onSpeechBargeRef.current = onSpeechBarge;
    onErrorRef.current = onError;
  });

  const getSR = (): any =>
    (window as any).SpeechRecognition ||
    (window as any).webkitSpeechRecognition;

  const setState = useCallback((s: MicState) => {
    stateRef.current = s;
    setMicState(s);
  }, []);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  // ── Stop recognition ────────────────────────────────────────────────────
  const stopRec = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }
    isStartingRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.abort?.();
    } catch {
      /* ignore */
    }
    try {
      rec?.stop?.();
    } catch {
      /* ignore */
    }
  }, []);

  const flushPendingTranscript = useCallback(() => {
    if (submitTimerRef.current) {
      clearTimeout(submitTimerRef.current);
      submitTimerRef.current = null;
    }

    const transcript = pendingTranscriptRef.current.replace(/\s+/g, " ").trim();
    pendingTranscriptRef.current = "";
    if (!transcript) return;

    const now = Date.now();
    if (
      lastFinalRef.current.text === transcript &&
      now - lastFinalRef.current.ts < 2000
    ) {
      return;
    }

    lastFinalRef.current = { text: transcript, ts: now };
    stopRec();
    if (onCommandRef.current) onCommandRef.current(transcript);
  }, [stopRec]);

  const scheduleTranscriptFlush = useCallback(() => {
    if (submitTimerRef.current) clearTimeout(submitTimerRef.current);
    submitTimerRef.current = setTimeout(() => {
      flushPendingTranscript();
    }, 450); // Reduced from 850ms to 450ms for faster strike-to-think
  }, [flushPendingTranscript]);

  const scheduleRestart = useCallback((delayMs = 450) => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = setTimeout(() => {
      restartTimerRef.current = null;
      if (stateRef.current !== "ON" || pausedRef.current) return;
      startRec();
    }, delayMs);
  }, []);

  // ── Start continuous recognition ────────────────────────────────────────
  const startRec = useCallback(() => {
    const SR = getSR();
    if (!SR || stateRef.current !== "ON" || pausedRef.current) return;
    if (recRef.current || isStartingRef.current) return;
    stopRec();
    isStartingRef.current = true;

    const rec = new SR();
    rec.lang = lang;
    rec.continuous = true;
    rec.interimResults = true;

    rec.onresult = (e: any) => {
      const results = Array.from(e.results as SpeechRecognitionResultList);
      for (let i = e.resultIndex; i < results.length; i++) {
        const item = results[i] as SpeechRecognitionResult;
        const transcript = item[0].transcript.trim();

        if (!item.isFinal) {
          // Interim speech → barge-in (pause any playing TTS)
          if (onSpeechBargeRef.current) onSpeechBargeRef.current();
          continue;
        }

        // Final transcript chunks are buffered until the speaker pauses,
        // which prevents Chrome from dispatching one-word fragments.
        if (transcript) {
          pendingTranscriptRef.current = pendingTranscriptRef.current
            ? `${pendingTranscriptRef.current} ${transcript}`
            : transcript;
          scheduleTranscriptFlush();
        }
      }
    };

    rec.onerror = (event: any) => {
      const code = String(event?.error || "unknown");
      recRef.current = null;
      isStartingRef.current = false;

      if (code === "aborted" || code === "no-speech") {
        if (stateRef.current === "ON" && !pausedRef.current)
          scheduleRestart(700);
        return;
      }

      if (code === "audio-capture") {
        setState("OFF");
        stopRec();
        if (onErrorRef.current) {
          onErrorRef.current(
            "Microphone input is unavailable. Check your browser mic device and permissions.",
          );
        }
        return;
      }

      if (code === "not-allowed" || code === "service-not-allowed") {
        setState("OFF");
        stopRec();
        if (onErrorRef.current) {
          onErrorRef.current(
            "Microphone permission is blocked. Allow mic access for this app and try again.",
          );
        }
        return;
      }

      if (stateRef.current === "ON" && !pausedRef.current) scheduleRestart(900);
    };

    rec.onend = () => {
      recRef.current = null;
      isStartingRef.current = false;
      if (pendingTranscriptRef.current.trim()) {
        flushPendingTranscript();
        return;
      }
      // Auto-restart while mic is ON (continuous mode drops on silence)
      if (stateRef.current === "ON" && !pausedRef.current) scheduleRestart();
    };

    try {
      rec.start();
      recRef.current = rec;
      isStartingRef.current = false;
    } catch {
      recRef.current = null;
      isStartingRef.current = false;
      if (stateRef.current === "ON" && !pausedRef.current) scheduleRestart(700);
    }
  }, [
    lang,
    scheduleRestart,
    setState,
    stopRec,
  ]);

  // ── Toggle: OFF→ON, ON→OFF ──────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (stateRef.current === "OFF") {
      if (!getSR()) {
        if (onErrorRef.current) {
          onErrorRef.current(
            "This browser does not expose live speech recognition for the mic button.",
          );
        }
        return;
      }
      setState("ON");
      if (!pausedRef.current) startRec();
    } else {
      setState("OFF");
      stopRec();
    }
  }, [setState, startRec, stopRec]);

  // No-op — kept for API compatibility so App.tsx doesn't break
  const startWakeWordListen = useCallback(() => {}, []);

  useEffect(() => {
    if (stateRef.current !== "ON") return;
    if (paused) {
      if (pendingTranscriptRef.current.trim()) flushPendingTranscript();
      stopRec();
      return;
    }
    startRec();
  }, [flushPendingTranscript, paused, startRec, stopRec]);

  // Cleanup on unmount
  useEffect(() => () => stopRec(), [stopRec]);

  const micColor: "gray" | "red" = micState === "OFF" ? "gray" : "red";

  return { micState, micColor, startWakeWordListen, toggleMic };
}
