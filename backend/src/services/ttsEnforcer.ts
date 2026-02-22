/**
 * TTS Enforcer — Agent Lee Voice Lock
 * Every AI response MUST pass through this module.
 * Guarantees spoken delivery or graceful transcript fallback.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import crypto from 'crypto';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../../../');

export interface TTSResult {
    speak: boolean;
    audioPath?: string;      // path to .mp3 file if TTS succeeded
    audioBase64?: string;    // base64 encoded audio for inline delivery
    transcript: string;
    voiceState: VoiceState;
    notice?: string;
}

export type VoiceState = 'PRIMARY' | 'RETRYING' | 'SECONDARY' | 'TEXT_ONLY';

// ── Voice State Machine ────────────────────────────────────────────────────────
let currentVoiceState: VoiceState = 'PRIMARY';

const EDGE_TTS_VOICES = {
    PRIMARY:   'en-US-GuyNeural',    // original Agent Lee voice — baritone, sovereign, warm
    SECONDARY: 'en-US-BrianNeural'  // deeper secondary fallback
};
const VOICE_RATE   = '-15%';   // 0.85x — deliberate cadence per Voice Spec v2.0 (164Hz profile)
const VOICE_PITCH  = '+5Hz';   // nudge GuyNeural ~130Hz base toward 164Hz reference target
const VOICE_VOLUME = '+15%';   // presence

async function synthesizeEdgeTTS(
    text: string,
    voice: string,
    outputPath: string
): Promise<void> {
    const ttsCmd = `"${ROOT}/.venv/Scripts/python.exe" -m edge_tts --voice "${voice}" --rate "${VOICE_RATE}" --pitch "${VOICE_PITCH}" --volume "${VOICE_VOLUME}" --text "${text.replace(/"/g, "'")}" --write-media "${outputPath}"`;    
    await execAsync(ttsCmd, { timeout: 20_000 });
    // Verify file was written and has content
    const stat = await fs.stat(outputPath);
    if (stat.size < 100) throw new Error('TTS output too small — likely silent');
}

export async function agentLeeRespond(text: string): Promise<TTSResult> {
    // Sanitize text for TTS (remove markdown, keep natural phrasing)
    const spokenText = text
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/`/g, '')
        .replace(/#{1,6}\s/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

    const uid = crypto.randomBytes(4).toString('hex');
    const outputPath = path.join(ROOT, 'workspace', `tts_${uid}.mp3`);

    // ── PRIMARY attempt ────────────────────────────────────────────────────────
    if (currentVoiceState === 'PRIMARY' || currentVoiceState === 'RETRYING') {
        try {
            await synthesizeEdgeTTS(spokenText, EDGE_TTS_VOICES.PRIMARY, outputPath);
            const audio = await fs.readFile(outputPath).then(b => b.toString('base64'));
            await fs.unlink(outputPath).catch(() => {});
            currentVoiceState = 'PRIMARY'; // reset on success
            return { speak: true, audioBase64: audio, transcript: text, voiceState: 'PRIMARY' };
        } catch (err: any) {
            console.warn(`[tts] Primary voice failed: ${err.message}`);

            if (currentVoiceState === 'PRIMARY') {
                // Retry once
                currentVoiceState = 'RETRYING';
                console.log('[tts] Retrying primary voice...');
                try {
                    await synthesizeEdgeTTS(spokenText, EDGE_TTS_VOICES.PRIMARY, outputPath);
                    const audio = await fs.readFile(outputPath).then(b => b.toString('base64'));
                    await fs.unlink(outputPath).catch(() => {});
                    currentVoiceState = 'PRIMARY';
                    return { speak: true, audioBase64: audio, transcript: text, voiceState: 'RETRYING' };
                } catch {
                    currentVoiceState = 'SECONDARY';
                }
            } else {
                currentVoiceState = 'SECONDARY';
            }
        }
    }

    // ── SECONDARY voice attempt ────────────────────────────────────────────────
    if (currentVoiceState === 'SECONDARY') {
        try {
            await synthesizeEdgeTTS(spokenText, EDGE_TTS_VOICES.SECONDARY, outputPath);
            const audio = await fs.readFile(outputPath).then(b => b.toString('base64'));
            await fs.unlink(outputPath).catch(() => {});
            return {
                speak: true,
                audioBase64: audio,
                transcript: text,
                voiceState: 'SECONDARY',
                notice: 'Secondary voice profile active.'
            };
        } catch (err: any) {
            console.warn(`[tts] Secondary voice also failed: ${err.message}`);
            currentVoiceState = 'TEXT_ONLY';
        }
    }

    // ── TEXT_ONLY fallback ────────────────────────────────────────────────────
    console.log('[tts] TEXT_ONLY mode — delivering transcript');
    return {
        speak: false,
        transcript: text,
        voiceState: 'TEXT_ONLY',
        notice: 'Voice fallback active. Transcript only.'
    };
}

/** Reset voice state (e.g. after TTS service recovers) */
export function resetVoiceState(): void {
    currentVoiceState = 'PRIMARY';
    console.log('[tts] Voice state reset to PRIMARY');
}

export function getVoiceState(): VoiceState {
    return currentVoiceState;
}
