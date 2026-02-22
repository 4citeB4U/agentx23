/**
 * Agent Lee — Persona Drift Detector
 * Layer 45: PersonaDriftDetector | LEEWAY-CORE-2026
 *
 * Monitors every response for persona drift signals:
 * - Phrase repetition
 * - Register mismatch
 * - Slang density exceeded  
 * - Character break (Agent Lee stopped being Agent Lee)
 * - LEEWAY standard violation
 *
 * Issues correction commands on drift detection.
 */

import { createClient } from '@insforge/sdk';
import { enforceSlangDensity, type RegisterMode } from './vernacular-rotation-engine.js';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

// ── Drift Signal Types ─────────────────────────────────────────────────────
export type DriftSignal =
  | 'repeated_phrase'
  | 'register_mismatch'
  | 'slang_density_exceeded'
  | 'character_break'
  | 'leeway_violation';

export interface DriftReport {
  driftDetected:    boolean;
  signals:          DriftSignal[];
  slangDensity:     number;
  corrections:      string[];
  recalibrationCmd: string;
}

// ── Character Break Indicators ────────────────────────────────────────────
// These patterns suggest Agent Lee lost his identity
const CHARACTER_BREAK_PATTERNS = [
  /as an ai language model/i,
  /i'm just an ai/i,
  /i cannot have opinions/i,
  /i'm here to help you/i,
  /certainly! here is/i,
  /of course! let me/i,
  /sure! i'd be happy to/i,
  /absolutely! here's/i,
];

// LEEWAY violation patterns
const LEEWAY_VIOLATION_PATTERNS = [
  /i cannot access your filesystem/i,
  /i have no access to the internet/i,
  /as a language model i don't/i,
  /i'm not able to execute/i,
];

// ── Phrase Repetition Tracker ─────────────────────────────────────────────
class PhraseRepetitionTracker {
  private recentPhrases: string[] = [];
  private window = 5;

  check(text: string): boolean {
    // Extract meaningful phrases (5+ word sequences)
    const sentences = text.split(/[.!?]+/).map(s => s.trim().toLowerCase()).filter(s => s.length > 20);

    for (const phrase of sentences) {
      if (this.recentPhrases.some(prev => this.similarity(prev, phrase) > 0.75)) {
        return true;
      }
    }

    this.recentPhrases.push(...sentences.slice(0, 2));
    if (this.recentPhrases.length > this.window) {
      this.recentPhrases = this.recentPhrases.slice(-this.window);
    }
    return false;
  }

  private similarity(a: string, b: string): number {
    const wordsA = new Set(a.split(/\s+/));
    const wordsB = new Set(b.split(/\s+/));
    let common = 0;
    for (const w of wordsA) { if (wordsB.has(w)) common++; }
    return common / Math.max(wordsA.size, wordsB.size);
  }

  reset(): void { this.recentPhrases = []; }
}

// ── Layer Activation Matrix (Layer 46) ───────────────────────────────────
export interface LayerActivation {
  active_layers:      number[];
  register_mode:      RegisterMode;
  emotion_detected:   string;
  tool_proof:         string[];
  learning_writeback: Record<string, unknown>;
  drift_flags:        DriftSignal[];
  timestamp:          string;
}

// ── Persona Drift Detector ────────────────────────────────────────────────
export class PersonaDriftDetector {
  private phraseTracker = new PhraseRepetitionTracker();
  public driftCount = 0;

  inspect(
    responseText:    string,
    expectedRegister: RegisterMode,
    actualRegister:   RegisterMode,
  ): DriftReport {
    const signals: DriftSignal[]   = [];
    const corrections: string[]    = [];

    // 1. Phrase repetition check
    if (this.phraseTracker.check(responseText)) {
      signals.push('repeated_phrase');
      corrections.push('Rotate lexicon — use different phrasing from bucket pool.');
    }

    // 2. Slang density check
    const { passed: slangOk, density } = enforceSlangDensity(responseText);
    if (!slangOk) {
      signals.push('slang_density_exceeded');
      corrections.push(`Slang density ${(density * 100).toFixed(1)}% exceeds 18% cap. Reduce informal terms.`);
    }

    // 3. Register mismatch
    if (expectedRegister !== actualRegister) {
      signals.push('register_mismatch');
      corrections.push(`Expected register "${expectedRegister}" but detected "${actualRegister}". Recalibrate tone.`);
    }

    // 4. Character break detection
    const hasCharBreak = CHARACTER_BREAK_PATTERNS.some(p => p.test(responseText));
    if (hasCharBreak) {
      signals.push('character_break');
      corrections.push('CHARACTER BREAK DETECTED. Agent Lee must speak as himself — not as a generic AI assistant. Re-assert identity immediately.');
    }

    // 5. LEEWAY violation detection
    const hasLeewayViolation = LEEWAY_VIOLATION_PATTERNS.some(p => p.test(responseText));
    if (hasLeewayViolation) {
      signals.push('leeway_violation');
      corrections.push('LEEWAY VIOLATION: Response implies limitation inconsistent with LEEWAY Standards. Agent Lee has tools. He must use them and state what he is doing.');
    }

    const driftDetected = signals.length > 0;
    if (driftDetected) {
      this.driftCount++;
    }

    const recalibrationCmd = driftDetected
      ? this.buildRecalibrationCommand(signals)
      : 'Persona stable. No correction needed.';

    return {
      driftDetected,
      signals,
      slangDensity: density,
      corrections,
      recalibrationCmd,
    };
  }

  private buildRecalibrationCommand(signals: DriftSignal[]): string {
    const parts: string[] = ['[RECALIBRATION COMMAND]'];

    if (signals.includes('character_break')) {
      parts.push('PRIORITY 1: Re-assert Agent Lee identity. Say: "Yo — let me be real with you."');
    }
    if (signals.includes('leeway_violation')) {
      parts.push('PRIORITY 2: Restate LEEWAY capabilities. Agent Lee can execute, search, build, and test.');
    }
    if (signals.includes('repeated_phrase')) {
      parts.push('Rotate: Pick a different affirmation, transition, and closing phrase.');
    }
    if (signals.includes('slang_density_exceeded')) {
      parts.push('Reduce slang: Use 1-2 vernacular expressions max per paragraph.');
    }
    if (signals.includes('register_mismatch')) {
      parts.push('Recalibrate register: Match the current emotional context.');
    }

    return parts.join(' | ');
  }

  // ── Layer Activation Matrix Builder (Layer 46) ──────────────────────────
  buildActivationMatrix(context: {
    emotionDetected:   string;
    registerMode:      RegisterMode;
    toolsUsed:         string[];
    learningWriteback: Record<string, unknown>;
    driftSignals:      DriftSignal[];
    isResearch:        boolean;
    isBuild:           boolean;
    isSecurity:        boolean;
    isTelephony:       boolean;
  }): LayerActivation {
    const activeLayers = [1, 2, 3, 4, 5, 6, 7]; // Ring 1 always on

    // Ring 2 operational
    activeLayers.push(8, 9, 10, 12, 13, 14, 16); // Core ops
    if (context.isResearch)  activeLayers.push(11, 15);
    if (context.isBuild)     activeLayers.push(11);

    // Ring 3 memory
    activeLayers.push(17, 18, 19, 20, 21);
    if (context.driftSignals.length > 0) activeLayers.push(22);

    // Ring 4 situational
    activeLayers.push(27, 28, 29, 30, 44, 45, 46, 47);
    if (context.isResearch)   activeLayers.push(38);
    if (context.isTelephony)  activeLayers.push(34, 35);
    if (context.isBuild)      activeLayers.push(39, 48);
    if (context.isSecurity)   activeLayers.push(32);

    return {
      active_layers:      [...new Set(activeLayers)].sort((a, b) => a - b),
      register_mode:      context.registerMode,
      emotion_detected:   context.emotionDetected,
      tool_proof:         context.toolsUsed,
      learning_writeback: context.learningWriteback,
      drift_flags:        context.driftSignals,
      timestamp:          new Date().toISOString(),
    };
  }

  async persistDriftEvent(
    driftReport: DriftReport,
    activation:  LayerActivation,
    episodeId?:  string,
  ): Promise<void> {
    if (!driftReport.driftDetected) return;

    await insforge.database.from('telemetry_events').insert([{
      event_type: 'persona_drift',
      layer_id:   45,
      metadata: {
        signals:        driftReport.signals,
        corrections:    driftReport.corrections,
        slang_density:  driftReport.slangDensity,
        active_layers:  activation.active_layers,
        episode_id:     episodeId,
      },
    }]).select();

    console.warn(`  [PersonaDriftDetector] Drift detected (${driftReport.signals.join(', ')}). Count: ${this.driftCount}`);
  }

  resetPhraseHistory(): void {
    this.phraseTracker.reset();
  }
}

export const driftDetector = new PersonaDriftDetector();
