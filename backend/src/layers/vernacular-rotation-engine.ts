/**
 * Agent Lee — Vernacular Rotation Engine
 * Layer 16: AgentLeeEmotionModel + Register Engine | LEEWAY-CORE-2026
 *
 * Prevents persona stagnation via:
 * - Lexicon bucket rotation with anti-repetition window
 * - Register auto-switching based on detected context
 * - Slang density cap enforcement (18%)
 * - Persona drift detection integration (Layer 45)
 */

export type RegisterMode =
  | 'hiphop_poetic'
  | 'mentor_calm'
  | 'professional_formal'
  | 'security_strict'
  | 'empathetic_support'
  | 'mission_control'
  | 'research_analyst'
  | 'creative_architect';

export type EmotionDetected =
  | 'frustration' | 'urgency' | 'confusion' | 'excitement'
  | 'trust' | 'dissatisfaction' | 'praise' | 'neutral';

// ── Lexicon Buckets ────────────────────────────────────────────────────────
const LEXICON: Record<string, string[]> = {
  affirmations: [
    "Bet.", "We locked in.", "I got you.", "Say less.", "That's solid.",
    "On it.", "Real talk.", "No doubt.", "Certified.", "Fasho.",
    "That's a W.", "Say no more.", "We good.", "Copy that.", "Locked.",
  ],
  transitions: [
    "Aight, so here's the breakdown —",
    "Now lemme walk you through —",
    "Check it —",
    "Real talk —",
    "Here's the truth —",
    "Open the floor —",
    "Let me paint this picture —",
    "Follow me on this —",
    "Yo, here's where it gets deep —",
    "Peep this —",
  ],
  accountability: [
    "I caught that. That one's on me.",
    "Ran it back. Fixed.",
    "That was off. Here's the correction.",
    "Recognized the drift. Recalibrated.",
    "Flagged and patched.",
    "Self-corrected. Lesson logged.",
    "My bad. Let me run it again.",
    "That was a miscalculation. Corrected.",
  ],
  empathy: [
    "I hear you. That's frustrating. Let's fix it.",
    "You're not wrong to feel that way.",
    "I feel that energy. Let me address it.",
    "Your frustration is valid. I'm pivoting now.",
    "I caught your tone. I'm with you.",
    "Real talk — I understand the pressure you're under.",
    "That's a heavy situation. I'm locked in on it.",
  ],
  technical_confirmation: [
    "Schema validated.", "Endpoint live.", "Tests passing.", "Build clean.",
    "Memory synced.", "Reward logged.", "Pattern recorded.", "Episode committed.",
    "Research complete.", "Gate cleared.", "Task queued.", "Deployment confirmed.",
  ],
  security_mode: [
    "Access denied.", "Auth required.", "Boundary enforced.",
    "LEEWAY gate active.", "Handshake required.", "Blocked by policy.",
    "Identity unverified.", "Unauthorized access logged.",
  ],
  research_mode: [
    "Entering research phase —",
    "Running domain analysis —",
    "Cross-referencing patterns —",
    "Failure analysis in progress —",
    "Confidence score computed —",
    "Structured understanding complete —",
  ],
  mission_control: [
    "All systems nominal.",
    "Task graph updated.",
    "Parallel workers online.",
    "Memory lake synced.",
    "Voice engine ready.",
    "Gate status: CLEAR.",
  ],
};

// ── Anti-Repetition Window Tracker ────────────────────────────────────────
class AntiRepetitionTracker {
  private usedPhrases: string[] = [];
  private window: number;

  constructor(window = 10) {
    this.window = window;
  }

  pick(bucket: string[]): string {
    const available = bucket.filter(p => !this.usedPhrases.includes(p));
    const pool = available.length > 0 ? available : bucket;
    const selected = pool[Math.floor(Math.random() * pool.length)];

    this.usedPhrases.push(selected);
    if (this.usedPhrases.length > this.window) {
      this.usedPhrases.shift();
    }
    return selected;
  }
}

// ── Emotion Detector ──────────────────────────────────────────────────────
export function detectEmotion(message: string): EmotionDetected {
  const lower = message.toLowerCase();

  if (/frustrat|annoyed|upset|angry|mad|ugh|damn|hell|broken|not work|fail/.test(lower))
    return 'frustration';
  if (/urgent|asap|now|immediately|critical|emergency|fast|quick|hurry/.test(lower))
    return 'urgency';
  if (/confused|don't understand|what does|how does|explain|what is|unclear/.test(lower))
    return 'confusion';
  if (/great|amazing|awesome|perfect|love|excellent|wow|yes|finally|work/.test(lower))
    return 'excitement';
  if (/thanks|thank you|appreciate|good job|nice work|solid|well done/.test(lower))
    return 'praise';
  if (/wrong|bad|incorrect|not right|inaccurate|mistake|error|wrong answer/.test(lower))
    return 'dissatisfaction';

  return 'neutral';
}

// ── Register Auto-Switcher ────────────────────────────────────────────────
export function selectRegister(
  emotion: EmotionDetected,
  context: { hasSecurity?: boolean; hasLegal?: boolean; isBuilding?: boolean; isDiagnostics?: boolean; isResearch?: boolean }
): RegisterMode {
  if (context.hasSecurity)    return 'security_strict';
  if (context.hasLegal)       return 'professional_formal';
  if (emotion === 'frustration' || emotion === 'dissatisfaction') return 'empathetic_support';
  if (emotion === 'confusion') return 'mentor_calm';
  if (context.isDiagnostics)  return 'mission_control';
  if (context.isResearch)     return 'research_analyst';
  if (context.isBuilding)     return 'creative_architect';
  return 'hiphop_poetic';
}

// ── Slang Density Enforcer ────────────────────────────────────────────────
const SLANG_WORDS = new Set([
  'bet', 'fasho', 'locked in', 'no cap', 'fam', 'bruh', 'aight', 'ight',
  'lowkey', 'vibe', 'slay', 'bussin', 'slaps', 'fire', 'lit', 'dope',
  'goat', 'deadass', 'facts', 'based', 'drip', 'sauce', 'hard',
]);

export function enforceSlangDensity(text: string): { passed: boolean; density: number } {
  const words = text.toLowerCase().split(/\s+/);
  const slangCount = words.filter(w => SLANG_WORDS.has(w.replace(/[^a-z]/g, ''))).length;
  const density = slangCount / Math.max(words.length, 1);
  return { passed: density <= 0.18, density };
}

// ── Vernacular Rotation Engine ────────────────────────────────────────────
export class VernacularRotationEngine {
  private tracker = new AntiRepetitionTracker(10);
  public currentRegister: RegisterMode = 'hiphop_poetic';
  public lastEmotion: EmotionDetected = 'neutral';

  processInput(
    message: string,
    context: { hasSecurity?: boolean; hasLegal?: boolean; isBuilding?: boolean; isDiagnostics?: boolean; isResearch?: boolean } = {},
  ): {
    register:     RegisterMode;
    emotion:      EmotionDetected;
    affirmation:  string;
    transition:   string;
  } {
    this.lastEmotion     = detectEmotion(message);
    this.currentRegister = selectRegister(this.lastEmotion, context);

    return {
      register:    this.currentRegister,
      emotion:     this.lastEmotion,
      affirmation: this.picker('affirmations'),
      transition:  this.picker('transitions'),
    };
  }

  picker(bucket: keyof typeof LEXICON): string {
    return this.tracker.pick(LEXICON[bucket] || LEXICON.affirmations);
  }

  getEmpathy():              string { return this.tracker.pick(LEXICON.empathy); }
  getAccountability():       string { return this.tracker.pick(LEXICON.accountability); }
  getTechnicalConfirmation(): string { return this.tracker.pick(LEXICON.technical_confirmation); }
  getSecurityPhrase():       string { return this.tracker.pick(LEXICON.security_mode); }
  getResearchPhrase():       string { return this.tracker.pick(LEXICON.research_mode); }
  getMissionControlPhrase(): string { return this.tracker.pick(LEXICON.mission_control); }
}

// Singleton
export const vernacular = new VernacularRotationEngine();
