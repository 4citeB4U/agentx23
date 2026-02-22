/**
 * Agent Lee — Voice State Machine
 * Layer 33: VoiceStateMachine | LEEWAY-CORE-2026
 *
 * Manages all TTS voice transitions with InsForge event persistence.
 * TTS engines: piper (primary) → kokoro (secondary) → edge_tts (tertiary)
 *
 * States: idle → listening → processing → speaking → complete → degraded
 */

import { createClient } from '@insforge/sdk';
import { EventEmitter } from 'events';
import { execFile, exec } from 'child_process';
import { promisify } from 'util';
const execAsync = promisify(exec);
import path from 'path';
import fs from 'fs';

const execFileAsync = promisify(execFile);const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

// ── State Definitions ─────────────────────────────────────────────────────
export type VoiceState = 'idle' | 'listening' | 'processing' | 'speaking' | 'complete' | 'degraded';
export type TTSEngine  = 'piper' | 'kokoro' | 'edge_tts' | 'none';

interface VoiceEvent {
  state:   VoiceState;
  engine:  TTSEngine;
  text:    string;
  success: boolean;
  ms?:     number;
  error?:  string;
}

// ── TTS Adapters ──────────────────────────────────────────────────────────
async function piperTTS(text: string): Promise<boolean> {
  const voice = process.env.PIPER_VOICE || 'en_US-amy-medium';
  const dst   = `/tmp/agentlee_voice_${Date.now()}.wav`;
  try {
    // Pipe text to piper via shell (piper reads from stdin)
    await execAsync(`echo ${JSON.stringify(text)} | piper --model ${voice} --output_file ${dst}`, { timeout: 10000 });
    // play the wav (Linux: aplay / macOS: afplay / skip on Windows)
    const player = process.platform === 'linux' ? 'aplay' : 'afplay';
    await execFileAsync(player, [dst]).catch(() => {});
    fs.unlink(dst, () => {});
    return true;
  } catch {
    return false;
  }
}

async function kokoroTTS(text: string): Promise<boolean> {
  try {
    // Kokoro TTS via Python subprocess
    const script = `from kokoro import KPipeline; import sounddevice as sd; p = KPipeline(lang_code='a'); audio,_ = next(p('${text.replace(/'/g, '"')}')); sd.play(audio, 24000); sd.wait()`;
    await execFileAsync('python3', ['-c', script], { timeout: 15000 });
    return true;
  } catch {
    return false;
  }
}

async function edgeTTS(text: string): Promise<boolean> {
  const voice = process.env.EDGE_TTS_VOICE || 'en-US-GuyNeural';
  const dst   = `/tmp/agentlee_tts_${Date.now()}.mp3`;
  try {
    await execFileAsync('edge-tts', [
      '--voice', voice,
      '--text', text,
      '--write-media', dst,
    ], { timeout: 12000 });
    const player = process.platform === 'linux' ? 'mpg123' : 'afplay';
    await execFileAsync(player, [dst]).catch(() => {});
    fs.unlink(dst, () => {});
    return true;
  } catch {
    return false;
  }
}

// ── Voice State Machine ───────────────────────────────────────────────────
export class VoiceStateMachine extends EventEmitter {
  private state: VoiceState = 'idle';
  private activeEngine: TTSEngine = 'none';

  getState(): VoiceState { return this.state; }
  getEngine(): TTSEngine { return this.activeEngine; }

  private async transition(next: VoiceState, meta: Omit<VoiceEvent, 'state'> = {} as any): Promise<void> {
    const prev = this.state;
    this.state = next;
    const event = { state: next, ...meta };
    this.emit('state', { from: prev, to: next, ...meta });

    // Persist to InsForge
    try { await insforge.database.from('voice_events').insert([event]).select(); } catch { /* non-blocking */ }
  }

  async speak(text: string, requestId?: string): Promise<{ success: boolean; engine: TTSEngine; ms: number }> {
    const t0 = Date.now();

    await this.transition('processing', { engine: 'none', text, success: true });

    const engines: Array<{ name: TTSEngine; fn: (t: string) => Promise<boolean> }> = [
      { name: 'piper',    fn: piperTTS },
      { name: 'kokoro',   fn: kokoroTTS },
      { name: 'edge_tts', fn: edgeTTS },
    ];

    await this.transition('speaking', { engine: 'none', text, success: true });

    for (const { name, fn } of engines) {
      this.activeEngine = name;
      const ok = await fn(text);
      if (ok) {
        const ms = Date.now() - t0;
        await this.transition('complete', { engine: name, text, success: true, ms });
        setTimeout(() => this.transition('idle', { engine: name, text: '', success: true }), 2000);
        return { success: true, engine: name, ms };
      }
    }

    // All engines failed
    await this.transition('degraded', { engine: 'none', text, success: false, error: 'all_tts_engines_failed' });
    console.error('[VoiceStateMachine] All TTS engines failed. Text:', text.substring(0, 80));
    return { success: false, engine: 'none', ms: Date.now() - t0 };
  }

  async listen(): Promise<void> {
    await this.transition('listening', { engine: 'none', text: '', success: true });
  }

  async reset(): Promise<void> {
    await this.transition('idle', { engine: 'none', text: '', success: true });
  }

  /** Narrate an Agent Lee-style opening + response */
  async narrate(narrative: string): Promise<void> {
    if (!narrative || narrative.length < 3) return;
    // Cap to first 2 sentences for voice
    const spoken = narrative.split(/[.!?]/).slice(0, 2).join('. ').trim();
    await this.speak(spoken);
  }
}

export const voiceSM = new VoiceStateMachine();
