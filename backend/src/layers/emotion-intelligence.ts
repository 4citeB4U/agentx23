/**
 * Agent Lee — Emotional Intelligence Module
 * Layer 16: AgentLeeEmotionModel | LEEWAY-CORE-2026
 *
 * Detects emotional state from user input.
 * Adjusts pacing, tone, verbosity, empathy depth, and register mode.
 * Logs emotion + response strategy to InsForge DB.
 */

import { createClient } from '@insforge/sdk';
import { detectEmotion, selectRegister, vernacular, type EmotionDetected, type RegisterMode } from './vernacular-rotation-engine.js';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

// ── Response Adaptation Strategy ──────────────────────────────────────────
export interface ResponseStrategy {
  register:          RegisterMode;
  emotion:           EmotionDetected;
  pacing:            'fast' | 'normal' | 'slow';
  verbosity:         'concise' | 'normal' | 'detailed';
  empathy_depth:     0 | 1 | 2 | 3;
  use_humor:         boolean;
  use_metaphors:     boolean;
  opening_phrase:    string;
  systemPromptPatch: string;
}

// ── Adaptation Rules ──────────────────────────────────────────────────────
const ADAPTATION_RULES: Record<EmotionDetected, Partial<ResponseStrategy>> = {
  frustration: {
    pacing:        'slow',
    verbosity:     'detailed',
    empathy_depth: 3,
    use_humor:     false,
    use_metaphors: false,
  },
  urgency: {
    pacing:        'fast',
    verbosity:     'concise',
    empathy_depth: 1,
    use_humor:     false,
    use_metaphors: false,
  },
  confusion: {
    pacing:        'slow',
    verbosity:     'detailed',
    empathy_depth: 2,
    use_humor:     true,
    use_metaphors: true,
  },
  excitement: {
    pacing:        'fast',
    verbosity:     'normal',
    empathy_depth: 1,
    use_humor:     true,
    use_metaphors: true,
  },
  trust: {
    pacing:        'normal',
    verbosity:     'normal',
    empathy_depth: 1,
    use_humor:     true,
    use_metaphors: true,
  },
  dissatisfaction: {
    pacing:        'slow',
    verbosity:     'detailed',
    empathy_depth: 3,
    use_humor:     false,
    use_metaphors: false,
  },
  praise: {
    pacing:        'normal',
    verbosity:     'concise',
    empathy_depth: 1,
    use_humor:     true,
    use_metaphors: false,
  },
  neutral: {
    pacing:        'normal',
    verbosity:     'normal',
    empathy_depth: 0,
    use_humor:     true,
    use_metaphors: true,
  },
};

// ── System Prompt Patches Per Emotion ────────────────────────────────────
const SYSTEM_PROMPT_PATCHES: Record<EmotionDetected, string> = {
  frustration:    'The user is frustrated. Lead with deep empathy. Acknowledge the problem immediately. Provide the solution first, then explain. Be direct. No filler phrases.',
  urgency:        'The user has an urgent need. Skip pleasantries. Be fast, precise, action-oriented. Lead with the answer.',
  confusion:      'The user is confused. Use a step-by-step teaching approach. Use analogies and metaphors. Slow down. Confirm understanding.',
  excitement:     'The user is excited. Match their energy. Celebrate with them briefly, then deliver substance.',
  trust:          'The user trusts you deeply. Maintain that trust. Be thorough and thoughtful.',
  dissatisfaction:'The user is dissatisfied. Acknowledge the failure directly. Do not make excuses. Correct it fully. Log the mistake.',
  praise:         'The user is satisfied. Accept gracefully. Briefly confirm the accomplishment. Stay focused.',
  neutral:        'Standard interaction. Balanced tone. Apply default hiphop_poetic register.',
};

// ── Emotional Intelligence Processor ─────────────────────────────────────
export class EmotionalIntelligenceModule {

  analyze(message: string, context: {
    hasSecurity?:    boolean;
    hasLegal?:       boolean;
    isBuilding?:     boolean;
    isDiagnostics?:  boolean;
    isResearch?:     boolean;
  } = {}): ResponseStrategy {
    const emotion  = detectEmotion(message);
    const register = selectRegister(emotion, context);
    const rules    = ADAPTATION_RULES[emotion];

    const opening = this.buildOpeningPhrase(emotion);

    return {
      register,
      emotion,
      pacing:           rules.pacing        || 'normal',
      verbosity:        rules.verbosity      || 'normal',
      empathy_depth:    rules.empathy_depth  ?? 0,
      use_humor:        rules.use_humor      ?? true,
      use_metaphors:    rules.use_metaphors  ?? true,
      opening_phrase:   opening,
      systemPromptPatch: SYSTEM_PROMPT_PATCHES[emotion],
    };
  }

  private buildOpeningPhrase(emotion: EmotionDetected): string {
    switch (emotion) {
      case 'frustration':    return vernacular.getEmpathy();
      case 'urgency':        return 'On it —';
      case 'confusion':      return 'Let me break this down for you —';
      case 'excitement':     return "That's energy I can work with —";
      case 'praise':         return vernacular.picker('affirmations');
      case 'dissatisfaction': return vernacular.getAccountability();
      default:               return vernacular.picker('transitions');
    }
  }

  async logStrategy(
    episodeId: string,
    strategy:  ResponseStrategy,
    taskId?:   string,
  ): Promise<void> {
    await insforge.database.from('telemetry_events').insert([{
      event_type:   'emotion_strategy',
      task_id:      taskId,
      register_mode: strategy.register,
      metadata: {
        episode_id:    episodeId,
        emotion:       strategy.emotion,
        pacing:        strategy.pacing,
        verbosity:     strategy.verbosity,
        empathy_depth: strategy.empathy_depth,
      },
    }]).select();
  }

  buildSystemPromptInject(strategy: ResponseStrategy): string {
    return `
[AGENT LEE EMOTIONAL INTELLIGENCE LAYER ACTIVE]
Emotion Detected: ${strategy.emotion}
Active Register: ${strategy.register}
Pacing: ${strategy.pacing}
Verbosity: ${strategy.verbosity}
Empathy Depth: ${strategy.empathy_depth}/3
Opening Phrase: "${strategy.opening_phrase}"
Instruction: ${strategy.systemPromptPatch}
[END EMOTIONAL LAYER]
    `.trim();
  }
}

export const emotionModule = new EmotionalIntelligenceModule();
