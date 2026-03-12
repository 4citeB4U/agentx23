/**
 * /api/agents — Sub-agent dispatch router
 *
 * SWARM GOVERNANCE: Every agent call flows through BrainRouter first.
 * User → BrainRouter(classify+plan) → Agent(execute) → BrainRouter(log) → Result
 * No agent is directly exposed. The orchestrator owns all dispatch decisions.
 *
 * Routes:
 *   POST /api/agents/insforge  → backend code-gen (APIs, routes, schemas)
 *   POST /api/agents/stitch    → frontend code-gen (components, pages, styles)
 *   POST /api/agents/spline    → 3D / Spline scene generation
 *   GET  /api/agents/status    → list all agents + capabilities
 */
// LEEWAY v12 HEADER
// File: backend/src/routes/agents.ts
// Purpose: Sub-agent dispatch router (InsForge, Stitch, Spline) with swarm governance and concurrency cap.
// Security: All dispatches log through BrainRouter orchestrator; tool concurrency capped via ConcurrencyGuard.
// Performance: toolJobs slot capped per ConcurrencyGuard policy.
// Discovery: ROLE=internal; INTENT=agent-dispatch; REGION=🧠 AI

import { Router } from "express";
import { insForgAgent } from "../agents/InsForgeAgent.js";
import { splineAgent } from "../agents/SplineAgent.js";
import { stitchAgent } from "../agents/StitchAgent.js";
import {
    classifyDomain,
    needsMultiPass,
    routeToBrain,
} from "../services/BrainRouter.js";
import { concurrencyGuard } from "../services/ConcurrencyGuard.js";

export const agentsRouter = Router();

/**
 * Swarm governance wrapper — log every agent dispatch through BrainRouter orchestrator.
 * Ensures no agent tool is exposed without orchestrator awareness.
 */
async function governedDispatch<T>(
  agentName: string,
  agentTask: string,
  input: string,
  execFn: () => Promise<T>,
): Promise<T> {
  const domain = classifyDomain(`${agentName} ${agentTask} ${input}`);
  const mode = needsMultiPass(input) ? "multi_pass" : "auto";

  // Log dispatch intent to BrainRouter (fire-and-forget — don’t block agent execution)
  routeToBrain({
    prompt: `[SWARM_DISPATCH][agent:${agentName}][task:${agentTask}] ${input.slice(0, 300)}`,
    mode,
    domain,
    user_id: `agent_${agentName}`,
  }).catch((e: Error) =>
    console.warn(`[governance] brain log failed for ${agentName}:`, e.message),
  );

  const slot = concurrencyGuard.acquire("toolJobs");
  if (!slot.allowed)
    throw new Error(
      `Tool concurrency cap — retry in ${slot.retryAfterMs ?? 2000}ms`,
    );
  try {
    return await execFn();
  } finally {
    concurrencyGuard.release("toolJobs");
  }
}

/* ── Status ── */
agentsRouter.get("/status", (_req, res) => {
  res.json({
    ok: true,
    agents: [
      {
        name: "insforge",
        description:
          "Backend code-generation sub-agent (APIs, routes, schemas, services)",
        tasks: [
          "scaffold_api",
          "generate_route",
          "generate_schema",
          "generate_service",
          "review_code",
          "custom",
        ],
        endpoint: "/api/agents/insforge",
      },
      {
        name: "stitch",
        description:
          "Frontend / UI design sub-agent (React, TypeScript, Tailwind)",
        tasks: [
          "scaffold_component",
          "generate_page",
          "generate_styles",
          "generate_hook",
          "design_system",
          "preview_url",
          "custom",
        ],
        endpoint: "/api/agents/stitch",
        preview_port: Number(process.env.STITCH_PORT || 8015),
      },
      {
        name: "spline",
        description: "3D design / Spline WebGL sub-agent",
        tasks: [
          "embed_scene",
          "generate_animation",
          "scaffold_3d_page",
          "design_brief",
          "orb_component",
          "status",
        ],
        endpoint: "/api/agents/spline",
        team_invite:
          "https://app.spline.design/team-invitation/e6646575-c700-467b-8304-579fdebc4c28",
      },
    ],
  });
});

/* ── InsForge (backend code-gen) ── */
agentsRouter.post("/insforge", async (req, res) => {
  const { task, input, lang, context } = req.body || {};
  if (!task || !input) {
    return res
      .status(400)
      .json({ ok: false, error: "task and input are required" });
  }
  const result = await governedDispatch("insforge", task, input, () =>
    insForgAgent.run({ task, input, lang, context }),
  );
  res.status(result.ok ? 200 : 500).json(result);
});

/* ── Stitch (frontend code-gen) ── */
agentsRouter.post("/stitch", async (req, res) => {
  const { task, input, context, framework, styling, name } = req.body || {};
  if (!task || !input) {
    return res
      .status(400)
      .json({ ok: false, error: "task and input are required" });
  }
  const result = await governedDispatch("stitch", task, input, () =>
    stitchAgent.run({ task, input, context, framework, styling, name }),
  );
  res.status(result.ok ? 200 : 500).json(result);
});

/* ── Spline (3-D design) ── */
agentsRouter.post("/spline", async (req, res) => {
  const { task, input, sceneUrl, context } = req.body || {};
  if (!task || !input) {
    return res
      .status(400)
      .json({ ok: false, error: "task and input are required" });
  }
  const result = await governedDispatch("spline", task, input, () =>
    splineAgent.run({ task, input, sceneUrl, context }),
  );
  res.status(result.ok ? 200 : 500).json(result);
});
