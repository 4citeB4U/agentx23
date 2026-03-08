// LEEWAY v12 HEADER
// File: backend/src/services/BrainRouter.ts
// Purpose: TypeScript adapter to Python Brain Router; routes prompts to port 7004 with ConcurrencyGuard.
// Security: Sovereign handshake enforced on all /chat requests.
// Performance: LLM slot capped via ConcurrencyGuard; LiteMode injects 'fast' mode when on battery.
// Discovery: ROLE=internal; INTENT=brain-routing; REGION=🧠 AI

import { concurrencyGuard } from "./ConcurrencyGuard.js";
import { liteMode } from "./LiteMode.js";

/**
 * BrainRouter — TypeScript adapter-side of the Sovereign Intelligence Loop
 *
 * Provides the Express backend with a typed interface to the Python Brain Router (port 8004).
 * Handles:
 *  - Adapter classification (general | code | ui | cdl)
 *  - Execution mode selection (single_pass | multi_pass)
 *  - Structured output contract enforcement
 *  - Reward score pass-through
 *  - Teacher distillation trigger
 */

const BRAIN_URL = `http://127.0.0.1:${process.env.NEURAL_ROUTER_PORT || 7004}`;
const HANDSHAKE =
  process.env.NEURAL_HANDSHAKE || process.env.NEURAL_HANDSHAKE_KEY || "";

export type AdapterName =
  | "qwen_general_adapter"
  | "qwen_code_adapter"
  | "qwen_ui_adapter"
  | "qwen_cdl_adapter";

export type DomainName = "auto" | "general" | "code" | "ui" | "cdl";
export type ExecutionMode =
  | "auto"
  | "single_pass"
  | "multi_pass"
  | "qwen"
  | "gemini";

export interface StructuredOutput {
  intent: string;
  plan: string[];
  tool_calls: {
    tool: string;
    args: Record<string, unknown>;
    verified?: boolean;
  }[];
  analysis: string;
  final_answer: string;
  confidence: number;
}

export interface BrainResponse {
  model: string;
  adapter: AdapterName;
  domain: DomainName;
  execution_mode: string;
  pass_sequence: string[];
  structured_output: StructuredOutput;
  response: string;
  confidence: number;
  reward_score: number;
  episode_id: string;
}

export interface BrainRouterOptions {
  prompt: string;
  mode?: ExecutionMode;
  domain?: DomainName;
  user_id?: string;
}

// Domain classifier (mirrors server.py logic on the TS side for pre-routing)
const CODE_KW = [
  "typescript",
  "python",
  "api",
  "route",
  "schema",
  "function",
  "test",
  "debug",
  "endpoint",
  "backend",
  "scaffold",
  "refactor",
  "sql",
  "query",
];
const UI_KW = [
  "spline",
  "puppeteer",
  "component",
  "react",
  "frontend",
  "css",
  "tailwind",
  "animate",
  "3d",
  "scene",
  "stitch",
  "browser",
  "webgl",
  "design",
];
const CDL_KW = [
  "cdl",
  "logistics",
  "driver",
  "fleet",
  "manifest",
  "shipment",
  "cargo",
  "warehouse",
];

export function classifyDomain(prompt: string): DomainName {
  const p = prompt.toLowerCase();
  if (CDL_KW.some((k) => p.includes(k))) return "cdl";
  if (UI_KW.some((k) => p.includes(k))) return "ui";
  if (CODE_KW.some((k) => p.includes(k))) return "code";
  return "general";
}

const COMPLEX_KW = [
  "build",
  "create an app",
  "architect",
  "design system",
  "deploy",
  "orchestrate",
  "migrate",
  "integrate",
  "scaffold entire",
  "full stack",
  "pipeline",
  "workflow",
  "automate",
  "refactor all",
  "multi-step",
];

export function needsMultiPass(prompt: string): boolean {
  const p = prompt.toLowerCase();
  return COMPLEX_KW.some((k) => p.includes(k));
}

export const adapterForDomain: Record<DomainName, AdapterName> = {
  auto: "qwen_general_adapter",
  general: "qwen_general_adapter",
  code: "qwen_code_adapter",
  ui: "qwen_ui_adapter",
  cdl: "qwen_cdl_adapter",
};

/**
 * Route a prompt through the Brain Router v3 (sovereign intelligence loop).
 */
export async function routeToBrain(
  opts: BrainRouterOptions,
): Promise<BrainResponse> {
  const { prompt, mode = "auto", domain = "auto", user_id = "anon" } = opts;

  const slot = concurrencyGuard.acquire("llm");
  if (!slot.allowed)
    throw new Error(
      `LLM concurrency cap — retry in ${slot.retryAfterMs ?? 5000}ms`,
    );
  const effectiveMode = mode === "auto" ? liteMode.preferredMode() : mode;
  const body = JSON.stringify({
    prompt,
    handshake: HANDSHAKE,
    mode: effectiveMode,
    domain,
    user_id,
  });

  let resp: Response;
  try {
    resp = await fetch(`${BRAIN_URL}/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      signal: AbortSignal.timeout(120_000),
    });
  } finally {
    concurrencyGuard.release("llm");
  }

  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`Brain router error ${resp.status}: ${text}`);
  }

  return resp.json() as Promise<BrainResponse>;
}

/**
 * Trigger teacher distillation for a given prompt (Gemini Pro as teacher).
 */
export async function teachBrain(
  prompt: string,
  domain: DomainName = "auto",
): Promise<unknown> {
  const resp = await fetch(`${BRAIN_URL}/teach`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handshake: HANDSHAKE, prompt, domain }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) throw new Error(`Teacher distillation error ${resp.status}`);
  return resp.json();
}

/**
 * Trigger synthetic expansion for a high-scoring episode.
 */
export async function expandEpisode(episodeId: string = ""): Promise<unknown> {
  const resp = await fetch(`${BRAIN_URL}/expand`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ handshake: HANDSHAKE, episode_id: episodeId }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!resp.ok) throw new Error(`Synthetic expansion error ${resp.status}`);
  return resp.json();
}

/**
 * Get the full AI status + adapter performance metrics from the brain.
 */
export async function getBrainStatus(): Promise<unknown> {
  const resp = await fetch(`${BRAIN_URL}/ai-status`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Brain status error ${resp.status}`);
  return resp.json();
}

/**
 * Get recent episodes for the diagnostics dashboard.
 */
export async function getRecentEpisodes(limit = 10): Promise<unknown> {
  const resp = await fetch(`${BRAIN_URL}/episodes?limit=${limit}`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Episodes error ${resp.status}`);
  return resp.json();
}

/**
 * Get 7-day rolling drift metrics (reward trend, hallucination trend, adapter dominance).
 */
export async function getDriftData(): Promise<unknown> {
  const resp = await fetch(`${BRAIN_URL}/drift`, {
    signal: AbortSignal.timeout(10_000),
  });
  if (!resp.ok) throw new Error(`Drift data error ${resp.status}`);
  return resp.json();
}

export const brainRouter = {
  route: routeToBrain,
  teach: teachBrain,
  expand: expandEpisode,
  status: getBrainStatus,
  episodes: getRecentEpisodes,
  drift: getDriftData,
  classifyDomain,
  needsMultiPass,
  adapterForDomain,
};
