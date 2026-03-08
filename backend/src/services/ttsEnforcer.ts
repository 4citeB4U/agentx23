/**
 * TTS Enforcer — Agent Lee Voice (Mode-Aware Router)
 *
 * Edge modes   (live, fast, default, reply, chat, command):
 *   Primary: edge-tts CLI (en-US-ChristopherNeural) → Gemini fallback → TEXT_ONLY
 *
 * Gemini modes (narration, premium, archive, onboarding, ceremony, longform):
 *   Primary: Gemini TTS (gemini-2.5-flash-preview-tts, voice "Charon") → edge-tts fallback → TEXT_ONLY
 *
 * See: VOICE_IDENTITY_POLICY.md, tts-router-spec.md
 */

import { exec } from "child_process";
import { readFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

// 4-key rotation — avoids per-key rate limits on Gemini TTS
const GEMINI_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
  process.env.GEMINI_API_KEY_4,
].filter(Boolean) as string[];

let _keyIdx = 0;
function nextGeminiKey(): string | undefined {
  if (GEMINI_KEYS.length === 0) return undefined;
  const key = GEMINI_KEYS[_keyIdx % GEMINI_KEYS.length];
  _keyIdx++;
  return key;
}

export interface TTSResult {
  speak: boolean;
  audioBase64?: string;
  transcript: string;
  voiceState: "GEMINI_TTS" | "GEMINI_NARRATION" | "EDGE_TTS" | "TEXT_ONLY";
  notice?: string;
}

// Mode classification — mirrors VOICE_IDENTITY_POLICY.md
const GEMINI_MODES = new Set([
  "narration",
  "premium",
  "archive",
  "onboarding",
  "ceremony",
  "longform",
]);

function resolveVoiceEngine(mode: string): "gemini" | "edge" {
  return GEMINI_MODES.has((mode || "live").toLowerCase()) ? "gemini" : "edge";
}

async function callGeminiTTS(text: string): Promise<string> {
  const apiKey = nextGeminiKey();
  if (!apiKey) throw new Error("No Gemini API keys configured");

  const voice = process.env.GEMINI_TTS_VOICE || "Charon";
  const body = {
    contents: [{ parts: [{ text }] }],
    generationConfig: {
      response_modalities: ["AUDIO"],
      speech_config: {
        voice_config: { prebuilt_voice_config: { voice_name: voice } },
      },
    },
  };

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Gemini TTS HTTP ${resp.status}: ${errText}`);
  }

  const data: any = await resp.json();
  const b64 = data?.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  if (!b64) throw new Error("Gemini TTS returned no audio data");
  return b64; // already base64 PCM/wav
}

async function callEdgeTTS(text: string): Promise<string> {
  const voice = process.env.EDGE_TTS_VOICE || "en-US-GuyNeural";
  const outPath = join(tmpdir(), `lee_tts_${Date.now()}.mp3`);
  // Escape double-quotes so the shell doesn't break
  const safeText = text.replace(/"/g, '\\"');
  await execAsync(
    `edge-tts --text "${safeText}" --voice "${voice}" --write-media "${outPath}"`,
    { timeout: 15000 },
  );
  const buf = await readFile(outPath);
  unlink(outPath).catch(() => {}); // best-effort cleanup
  return buf.toString("base64");
}

/**
 * Sovereign TTS: routes by mode.
 *   Edge modes   → edge-tts primary, Gemini fallback
 *   Gemini modes → Gemini TTS primary, edge-tts fallback
 */
export async function agentLeeRespond(
  text: string,
  handshake?: string,
  mode: string = "live",
): Promise<TTSResult> {
  if (handshake && handshake !== process.env.NEURAL_HANDSHAKE) {
    throw new Error("Unauthorized: Sovereign Handshake Failed.");
  }

  // Strip markdown formatting before speaking
  const spokenText = text
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/#{1,6}\s/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const engine = resolveVoiceEngine(mode);

  // ── Gemini modes: narration / premium / ceremony / etc. ───────────────────
  if (engine === "gemini") {
    try {
      const audioBase64 = await callGeminiTTS(spokenText);
      return {
        speak: true,
        audioBase64,
        transcript: text,
        voiceState: "GEMINI_NARRATION",
      };
    } catch (err: any) {
      console.warn(
        `[tts] Gemini TTS failed for mode=${mode}, trying edge-tts:`,
        err?.message,
      );
    }

    // Emergency fallback: edge-tts even for narration mode
    try {
      const audioBase64 = await callEdgeTTS(spokenText);
      return {
        speak: true,
        audioBase64,
        transcript: text,
        voiceState: "EDGE_TTS",
        notice: `Gemini TTS unavailable for mode=${mode} — using Edge-TTS fallback`,
      };
    } catch (err: any) {
      console.warn(
        "[tts] Edge-TTS also failed, returning TEXT_ONLY:",
        err?.message,
      );
    }

    return {
      speak: false,
      transcript: text,
      voiceState: "TEXT_ONLY",
      notice: "All TTS engines unavailable. Transcript only.",
    };
  }

  // ── Edge modes: live / fast / chat / command (default) ────────────────────
  try {
    const audioBase64 = await callEdgeTTS(spokenText);
    return {
      speak: true,
      audioBase64,
      transcript: text,
      voiceState: "EDGE_TTS",
    };
  } catch (err: any) {
    console.warn(
      "[tts] Edge-TTS failed, trying Gemini TTS fallback:",
      err?.message,
    );
  }

  // Gemini fallback for live mode (edge was down)
  try {
    const audioBase64 = await callGeminiTTS(spokenText);
    return {
      speak: true,
      audioBase64,
      transcript: text,
      voiceState: "GEMINI_TTS",
      notice: "Edge-TTS unavailable — using Gemini TTS fallback",
    };
  } catch (err: any) {
    console.warn("[tts] Gemini TTS fallback also failed:", err?.message);
  }

  return {
    speak: false,
    transcript: text,
    voiceState: "TEXT_ONLY",
    notice: "All TTS engines unavailable. Transcript only.",
  };
}
