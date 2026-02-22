/**
 * Agent Lee — Research-First Enforcement Middleware
 * Layer 8: ResearchFirstGate | LEEWAY-CORE-2026
 * Backed by InsForge AI (web search enabled)
 */

import { createClient } from '@insforge/sdk';

const insforge = createClient({
  baseUrl: process.env.INSFORGE_URL || 'https://3c4cp27v.us-west.insforge.app',
  anonKey: process.env.INSFORGE_ANON_KEY || '',
});

// ── Trigger Keywords ──────────────────────────────────────────────────────
const RESEARCH_TRIGGERS = [
  'build', 'create', 'design', 'plan', 'architect', 'campaign',
  'system', 'game', 'engine', 'model', 'deploy', 'launch', 'develop',
  'make', 'write', 'generate', 'implement', 'construct', 'setup',
];

const TRIVIAL_KEYWORDS = [
  'what is', 'who is', 'define', 'explain briefly', 'quick', 'fast',
  'capital of', 'stand for', 'mean', '× ', 'plus', 'minus',
];

// ── Research Output Schema ────────────────────────────────────────────────
export interface ResearchDocument {
  task_id:              string;
  domain:               string;
  domain_summary:       string;
  architectural_models: string[];
  risk_patterns:        string[];
  edge_cases:           string[];
  recommended_stack:    string[];
  confidence_score:     number;
  web_search_used:      boolean;
  sources:              Array<{ title: string; url: string }>;
}

// ── Intent Complexity Classifier ─────────────────────────────────────────
export function classifyIntent(message: string): {
  requiresResearch: boolean;
  domain: string;
  complexity: 'trivial' | 'moderate' | 'complex';
  triggerKeyword: string | null;
} {
  const lower = message.toLowerCase();

  const isTrivial = TRIVIAL_KEYWORDS.some(kw => lower.includes(kw));
  if (isTrivial) {
    return { requiresResearch: false, domain: 'general', complexity: 'trivial', triggerKeyword: null };
  }

  const trigger = RESEARCH_TRIGGERS.find(kw => lower.includes(kw)) ?? null;
  if (!trigger) {
    return { requiresResearch: false, domain: 'general', complexity: 'moderate', triggerKeyword: null };
  }

  // Domain detection
  let domain = 'general';
  if (/game|chess|pac.?man|racing|puzzle/.test(lower))       domain = 'gaming';
  else if (/email|campaign|newsletter|smtp/.test(lower))      domain = 'marketing';
  else if (/phone|call|sip|voip|asterisk|twilio/.test(lower)) domain = 'telephony';
  else if (/restaurant|food|menu|kitchen/.test(lower))        domain = 'food_service';
  else if (/crm|dispatch|logistics|inventory/.test(lower))    domain = 'operations';
  else if (/api|backend|server|database|schema/.test(lower))  domain = 'engineering';
  else if (/frontend|ui|ux|react|component/.test(lower))      domain = 'frontend';
  else if (/security|auth|token|handshake/.test(lower))       domain = 'security';

  return { requiresResearch: true, domain, complexity: 'complex', triggerKeyword: trigger };
}

// ── Phase 1: Domain Research via InsForge AI ──────────────────────────────
async function runDomainResearch(domain: string, intent: string): Promise<string> {
  const completion = await insforge.ai.chat.completions.create({
    model: 'anthropic/claude-3.5-haiku',
    messages: [{
      role: 'user',
      content: `You are Agent Lee's Research Engine. Conduct Phase 1 Domain Research for:
Domain: ${domain}
Intent: ${intent}

Return a structured JSON with:
- rules: domain rules and constraints
- industry_patterns: common architectural patterns
- known_edge_cases: list of pitfalls
- performance_expectations: benchmarks and expectations

Be concise and precise. JSON only.`,
    }],
    webSearch: { enabled: true, maxResults: 3 },
  });
  return completion.choices[0].message.content;
}

// ── Phase 2: Implementation Research ─────────────────────────────────────
async function runImplementationResearch(domain: string, intent: string): Promise<string> {
  const completion = await insforge.ai.chat.completions.create({
    model: 'anthropic/claude-3.5-haiku',
    messages: [{
      role: 'user',
      content: `Agent Lee Research Phase 2 — Implementation Research:
Domain: ${domain}
Intent: ${intent}

Return JSON with:
- framework_comparisons: top options with pros/cons
- recommended_stack: best choice with reasoning
- scalability_concerns: known limits
- security_considerations: must-address items`,
    }],
  });
  return completion.choices[0].message.content;
}

// ── Phase 3: Failure Analysis ─────────────────────────────────────────────
async function runFailureAnalysis(domain: string, intent: string): Promise<string> {
  const completion = await insforge.ai.chat.completions.create({
    model: 'anthropic/claude-3.5-haiku',
    messages: [{
      role: 'user',
      content: `Agent Lee Research Phase 3 — Failure Analysis:
Domain: ${domain}
Intent: ${intent}

Return JSON with:
- common_mistakes: top 5 mistakes developers make
- historical_bug_patterns: recurring bugs in this domain
- known_vulnerabilities: security holes to avoid`,
    }],
  });
  return completion.choices[0].message.content;
}

// ── Phase 4: Structured Understanding Output ──────────────────────────────
async function buildStructuredUnderstanding(
  domain: string,
  phase1: string,
  phase2: string,
  phase3: string,
): Promise<Omit<ResearchDocument, 'task_id' | 'web_search_used' | 'sources'>> {
  const completion = await insforge.ai.chat.completions.create({
    model: 'anthropic/claude-3.5-haiku',
    messages: [{
      role: 'user',
      content: `Agent Lee Research Phase 4 — Structured Understanding Synthesis.

Synthesize these research phases into a final understanding document:

Phase 1 (Domain): ${phase1}
Phase 2 (Implementation): ${phase2}
Phase 3 (Failure Analysis): ${phase3}

Return JSON matching exactly:
{
  "domain": "${domain}",
  "domain_summary": "2-3 sentence executive summary",
  "architectural_models": ["model1", "model2"],
  "risk_patterns": ["risk1", "risk2"],
  "edge_cases": ["case1", "case2"],
  "recommended_stack": ["tech1", "tech2"],
  "confidence_score": 0.0
}`,
    }],
  });

  try {
    const text = completion.choices[0].message.content;
    const json = JSON.parse(text.match(/\{[\s\S]*\}/)?.[0] ?? '{}');
    return {
      domain:               json.domain || domain,
      domain_summary:       json.domain_summary || '',
      architectural_models: json.architectural_models || [],
      risk_patterns:        json.risk_patterns || [],
      edge_cases:           json.edge_cases || [],
      recommended_stack:    json.recommended_stack || [],
      confidence_score:     json.confidence_score || 0.75,
    };
  } catch {
    return {
      domain, domain_summary: 'Research compiled.', architectural_models: [],
      risk_patterns: [], edge_cases: [], recommended_stack: [], confidence_score: 0.6,
    };
  }
}

// ── Main Research Pipeline ────────────────────────────────────────────────
export async function executeResearchPipeline(
  taskId: string,
  domain: string,
  intent: string,
): Promise<ResearchDocument> {
  console.log(`  [ResearchFirstGate] Phase 1: Domain Research — ${domain}`);
  const phase1 = await runDomainResearch(domain, intent);

  console.log(`  [ResearchFirstGate] Phase 2: Implementation Research`);
  const phase2 = await runImplementationResearch(domain, intent);

  console.log(`  [ResearchFirstGate] Phase 3: Failure Analysis`);
  const phase3 = await runFailureAnalysis(domain, intent);

  console.log(`  [ResearchFirstGate] Phase 4: Structured Understanding`);
  const structured = await buildStructuredUnderstanding(domain, phase1, phase2, phase3);

  const doc: ResearchDocument = {
    task_id: taskId,
    web_search_used: true,
    sources: [],
    ...structured,
  };

  // Persist to InsForge
  await insforge.database.from('research_documents').insert([{
    task_id:              taskId,
    domain:               doc.domain,
    domain_summary:       doc.domain_summary,
    architectural_models: doc.architectural_models,
    risk_patterns:        doc.risk_patterns,
    edge_cases:           doc.edge_cases,
    recommended_stack:    doc.recommended_stack,
    confidence_score:     doc.confidence_score,
    web_search_used:      doc.web_search_used,
    sources:              doc.sources,
  }]).select();

  console.log(`  [ResearchFirstGate] Research complete. Confidence: ${doc.confidence_score}`);
  return doc;
}

// ── Express Middleware Export ─────────────────────────────────────────────
export function researchFirstMiddleware() {
  return async (req: any, res: any, next: any) => {
    const message: string = req.body?.message || req.body?.input || '';
    const { requiresResearch, domain, triggerKeyword } = classifyIntent(message);

    if (!requiresResearch) {
      return next();
    }

    const taskId = req.body?.task_id || crypto.randomUUID();
    console.log(`  [Layer 8] Research gate triggered by: "${triggerKeyword}" in domain: ${domain}`);

    try {
      const researchDoc = await executeResearchPipeline(taskId, domain, message);
      // Attach research context to request for downstream handlers
      req.researchDoc = researchDoc;
      req.body.task_id = taskId;
      req.body.research_doc_id = taskId;
      next();
    } catch (err) {
      console.error('  [Layer 8] Research pipeline failed:', err);
      // Degraded mode — continue without blocking (log the failure)
      req.researchDoc = null;
      next();
    }
  };
}
