/**
 * Agent Lee — Learning Engine
 * Layers 17, 20, 21, 22, 23, 24 | LEEWAY-CORE-2026
 * Backed by InsForge DB: episodes, mistake_registry, success_patterns, cross_domain_patterns
 */

import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

// ── Reward Score Calculator (Layer 21) ────────────────────────────────────
export function calculateReward(factors: {
  userSatisfied:        boolean;
  errorCount:           number;
  correctionCount:      number;
  reworkCount:          number;
  latencyMs:            number;
  securityCompliant:    boolean;
  researchCompleted:    boolean;
}): number {
  let score = 1.0;

  if (!factors.userSatisfied)     score -= 0.25;
  if (!factors.securityCompliant) score -= 0.30;
  if (!factors.researchCompleted) score -= 0.10;
  score -= Math.min(factors.errorCount * 0.10, 0.30);
  score -= Math.min(factors.correctionCount * 0.05, 0.15);
  score -= Math.min(factors.reworkCount * 0.05, 0.10);

  // Latency penalty: > 5s incurs penalty
  if (factors.latencyMs > 5000) {
    score -= Math.min((factors.latencyMs - 5000) / 50000, 0.10);
  }

  return Math.max(0, Math.min(1, parseFloat(score.toFixed(4))));
}

// ── Episode Logger (Layer 20) ─────────────────────────────────────────────
export async function logEpisode(episode: {
  domain:           string;
  intent:           string;
  actions_taken:    unknown[];
  tools_used:       string[];
  success:          boolean;
  mistakes:         unknown[];
  reward_score:     number;
  register_mode:    string;
  emotion_detected: string;
  layers_active:    number[];
  task_id?:         string;
  voice_event_id?:  string;
}): Promise<string> {
  const { data, error } = await insforge.database
    .from('episodes')
    .insert([episode])
    .select();

  if (error) {
    console.error('  [EpisodeLogger] Failed to log episode:', error);
    return '';
  }

  const id = (data as any[])?.[0]?.id || '';

  // Low reward → flag for retraining (CurriculumScaler Layer 23)
  if (episode.reward_score < 0.6) {
    console.warn(`  [CurriculumScaler] Low reward (${episode.reward_score}) flagged for retraining. Domain: ${episode.domain}`);
    await logTelemetry('low_reward_flag', {
      domain: episode.domain,
      reward_score: episode.reward_score,
      episode_id: id,
    });
  }

  return id;
}

// ── Mistake Registry (Layer 22) ───────────────────────────────────────────
export async function recordMistake(mistake: {
  pattern_id:   string;
  description:  string;
  domain:       string;
  root_cause:   string;
  fix_strategy: string;
  episode_id?:  string;
}): Promise<void> {
  // Check if pattern already exists
  const { data: existing } = await insforge.database
    .from('mistake_registry')
    .select('id, frequency, episode_ids')
    .eq('pattern_id', mistake.pattern_id);

  if ((existing as any[])?.length > 0) {
    const row = (existing as any[])[0];
    const newIds = mistake.episode_id
      ? [...(row.episode_ids || []), mistake.episode_id]
      : (row.episode_ids || []);

    await insforge.database
      .from('mistake_registry')
      .update({
        frequency:   row.frequency + 1,
        last_seen:   new Date().toISOString(),
        episode_ids: newIds,
      })
      .eq('pattern_id', mistake.pattern_id);

    console.warn(`  [MistakeRegistry] Pattern "${mistake.pattern_id}" seen ${row.frequency + 1} times — PREVENT REPEAT.`);
  } else {
    await insforge.database.from('mistake_registry').insert([{
      pattern_id:   mistake.pattern_id,
      description:  mistake.description,
      domain:       mistake.domain,
      root_cause:   mistake.root_cause,
      fix_strategy: mistake.fix_strategy,
      frequency:    1,
      episode_ids:  mistake.episode_id ? [mistake.episode_id] : [],
    }]);
  }
}

// ── Check if mistake pattern known ────────────────────────────────────────
export async function isKnownMistake(patternId: string): Promise<{
  known: boolean;
  fix_strategy: string;
  frequency: number;
}> {
  const { data } = await insforge.database
    .from('mistake_registry')
    .select('fix_strategy, frequency')
    .eq('pattern_id', patternId)
    .eq('resolved', false);

  const row = (data as any[])?.[0];
  return {
    known:        !!row,
    fix_strategy: row?.fix_strategy || '',
    frequency:    row?.frequency || 0,
  };
}

// ── Success Pattern Library (Layer 25) ───────────────────────────────────
export async function recordSuccessPattern(pattern: {
  pattern_id:        string;
  domain:            string;
  solution_template: string;
  conditions:        unknown[];
  confidence:        number;
  episode_id?:       string;
}): Promise<void> {
  const { data: existing } = await insforge.database
    .from('success_patterns')
    .select('id, use_count, confidence, episode_ids')
    .eq('pattern_id', pattern.pattern_id);

  if ((existing as any[])?.length > 0) {
    const row = (existing as any[])[0];
    const newConf = (row.confidence * row.use_count + pattern.confidence) / (row.use_count + 1);
    await insforge.database
      .from('success_patterns')
      .update({
        use_count:  row.use_count + 1,
        confidence: parseFloat(newConf.toFixed(4)),
        last_used:  new Date().toISOString(),
        episode_ids: pattern.episode_id
          ? [...(row.episode_ids || []), pattern.episode_id]
          : (row.episode_ids || []),
      })
      .eq('pattern_id', pattern.pattern_id);
  } else {
    await insforge.database.from('success_patterns').insert([{
      pattern_id:        pattern.pattern_id,
      domain:            pattern.domain,
      solution_template: pattern.solution_template,
      conditions:        pattern.conditions,
      confidence:        pattern.confidence,
      use_count:         1,
      episode_ids:       pattern.episode_id ? [pattern.episode_id] : [],
    }]);
  }
}

// ── Cross-Domain Mapper (Layer 26) ────────────────────────────────────────
export async function findCrossDomainMatch(
  domain: string,
  abstractProblem: string,
): Promise<{ found: boolean; general_solution: string; domains: string[] } | null> {
  const { data } = await insforge.database
    .from('cross_domain_patterns')
    .select('abstract_problem, general_solution, domains, success_rate')
    .ilike('abstract_problem', `%${abstractProblem}%`)
    .order('success_rate', { ascending: false });

  const matches = (data as any[]) || [];
  if (matches.length === 0) return null;

  const best = matches[0];
  return {
    found:            true,
    general_solution: best.general_solution,
    domains:          best.domains,
  };
}

// ── Reflection (Layer 17) ─────────────────────────────────────────────────
export async function reflect(context: {
  episode_id:   string;
  what_worked:  string;
  what_failed:  string;
  pattern:      string;
  next_action:  string;
}): Promise<void> {
  await insforge.database.from('telemetry_events').insert([{
    event_type: 'reflection',
    metadata: {
      episode_id:  context.episode_id,
      what_worked: context.what_worked,
      what_failed: context.what_failed,
      pattern:     context.pattern,
      next_action: context.next_action,
    },
  }]);
  console.log(`  [Reflection]  Pattern: ${context.pattern} | Action: ${context.next_action}`);
}

// ── Telemetry Helper ──────────────────────────────────────────────────────
export async function logTelemetry(
  eventType: string,
  metadata: Record<string, unknown>,
  layerId?: number,
): Promise<void> {
  await insforge.database.from('telemetry_events').insert([{
    event_type: eventType,
    layer_id:   layerId,
    metadata,
  }]).select();
}
