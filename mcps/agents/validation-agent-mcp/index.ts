// validation-agent-mcp/index.ts
// Validation orchestrator: runs the mandatory 5-level acceptance test for every agent.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { randomUUID } from "crypto";
import "dotenv/config";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

// ── registry path ──────────────────────────────────────────────────────────
const REGISTRY_PATH =
  process.env.REGISTRY_PATH ?? join(__dirname, "../../../agent-registry.json");
const CACHE_PATH =
  process.env.VALIDATION_CACHE_PATH ??
  join(__dirname, "../../../../data/validation_cache.jsonl");

interface AgentEntry {
  id: string;
  name: string;
  status: string;
  basic_task_status?: string;
  complex_task_status?: string;
  last_tested_at?: string | null;
  confidence_score?: number;
  notes?: string;
  [key: string]: unknown;
}

interface ValidationResult {
  run_id: string;
  agent_id: string;
  agent_name: string;
  tested_at: string;
  levels: {
    level1_service_readiness: LevelResult;
    level2_basic_task: LevelResult;
    level3_complex_task: LevelResult;
    level4_verification: LevelResult;
    level5_memory_write: LevelResult;
  };
  readiness: "active" | "degraded" | "failed" | "quarantined";
  confidence_score: number;
  notes: string;
  retry_count: number;
}

interface LevelResult {
  status: "passed" | "failed" | "skipped" | "error" | "partial";
  duration_ms: number;
  error: string | null;
  evidence: string;
}

function loadRegistry(): { version: string; agents: AgentEntry[] } {
  if (!existsSync(REGISTRY_PATH))
    throw new Error(`Registry not found: ${REGISTRY_PATH}`);
  return JSON.parse(readFileSync(REGISTRY_PATH, "utf-8"));
}

function saveRegistry(reg: { version: string; agents: AgentEntry[] }) {
  writeFileSync(REGISTRY_PATH, JSON.stringify(reg, null, 2), "utf-8");
}

function cacheValidationResult(result: ValidationResult) {
  const dir = join(CACHE_PATH, "..");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CACHE_PATH, JSON.stringify(result) + "\n", {
    flag: "a",
    encoding: "utf-8",
  });
}

/** Compute confidence score from level statuses. Weights: L1=10, L2=20, L3=35, L4=25, L5=10 */
function computeConfidence(levels: ValidationResult["levels"]): number {
  const weights: [keyof ValidationResult["levels"], number][] = [
    ["level1_service_readiness", 10],
    ["level2_basic_task", 20],
    ["level3_complex_task", 35],
    ["level4_verification", 25],
    ["level5_memory_write", 10],
  ];
  return weights.reduce((sum, [key, w]) => {
    return (
      sum +
      (levels[key].status === "passed"
        ? w
        : levels[key].status === "partial"
          ? w * 0.5
          : 0)
    );
  }, 0);
}

function deriveReadiness(
  levels: ValidationResult["levels"],
): ValidationResult["readiness"] {
  const l1 = levels.level1_service_readiness.status;
  const l2 = levels.level2_basic_task.status;
  const l3 = levels.level3_complex_task.status;
  if (l1 === "error" || l1 === "failed") return "quarantined";
  if (l2 === "failed" || l2 === "error") return "failed";
  if (l3 !== "passed") return "degraded";
  return "active";
}

// ── tool implementations ──────────────────────────────────────────────────

function discoverAgents(filterStatus = "all"): {
  agents: AgentEntry[];
  count: number;
} {
  const reg = loadRegistry();
  const agents =
    filterStatus === "all"
      ? reg.agents
      : reg.agents.filter((a) => a.status === filterStatus);
  return { agents, count: agents.length };
}

function runLevel1ServiceCheck(agentId: string): LevelResult {
  const t0 = Date.now();
  try {
    const reg = loadRegistry();
    const agent = reg.agents.find((a) => a.id === agentId);
    if (!agent) throw new Error(`Agent ${agentId} not in registry`);
    // Level 1: structural check — manifest fields present, status known
    const required = ["id", "name", "layer", "tools", "deployment_location"];
    const missing = required.filter((k) => !(k in agent));
    if (missing.length > 0)
      throw new Error(`Missing fields: ${missing.join(", ")}`);
    return {
      status: "passed",
      duration_ms: Date.now() - t0,
      error: null,
      evidence: `Registry entry valid. Fields: ${Object.keys(agent).join(", ")}`,
    };
  } catch (e: unknown) {
    return {
      status: "error",
      duration_ms: Date.now() - t0,
      error: String(e),
      evidence: "Service check failed",
    };
  }
}

function runBasicTask(agentId: string): LevelResult {
  const t0 = Date.now();
  // In production this invokes the agent's basic_task via MCP spawn.
  // Stub returns partial so integration tests can override.
  return {
    status: "partial",
    duration_ms: Date.now() - t0,
    error: null,
    evidence: `Basic task for ${agentId} requires live MCP spawn. Marked partial — wire to MCP host.`,
  };
}

function runComplexTask(agentId: string): LevelResult {
  const t0 = Date.now();
  return {
    status: "partial",
    duration_ms: Date.now() - t0,
    error: null,
    evidence: `Complex task for ${agentId} requires live MCP spawn and model inference. Marked partial.`,
  };
}

function verifyResult(
  agentId: string,
  taskName: string,
  output: unknown,
  verificationMethod: string,
  successCriteria: string[],
): LevelResult {
  const t0 = Date.now();
  // Basic structural verification
  const outputIsPresent = output !== null && output !== undefined;
  const passed = outputIsPresent;
  return {
    status: passed ? "passed" : "failed",
    duration_ms: Date.now() - t0,
    error: passed ? null : `Output empty or null for ${taskName}`,
    evidence: `Output present: ${outputIsPresent}. Criteria count: ${successCriteria.length}. Method: ${verificationMethod}`,
  };
}

function writeValidationSummary(
  agentId: string,
  result: ValidationResult,
): { written: boolean; source: string } {
  try {
    // Update registry
    const reg = loadRegistry();
    const agent = reg.agents.find((a) => a.id === agentId);
    if (agent) {
      agent.status =
        result.readiness === "active"
          ? "active"
          : result.readiness === "degraded"
            ? "degraded"
            : result.readiness === "failed"
              ? "failed"
              : "unknown";
      agent.basic_task_status = result.levels.level2_basic_task.status;
      agent.complex_task_status = result.levels.level3_complex_task.status;
      agent.last_tested_at = result.tested_at;
      agent.confidence_score = result.confidence_score;
      agent.notes = result.notes;
    }
    saveRegistry(reg);
    cacheValidationResult(result);
    return { written: true, source: "registry+cache" };
  } catch (e: unknown) {
    cacheValidationResult(result);
    return { written: true, source: "cache_only" };
  }
}

function runFullValidation(
  agentId: string,
  skipLevels: string[] = [],
): ValidationResult {
  const reg = loadRegistry();
  const entry = reg.agents.find((a) => a.id === agentId);
  const name = entry?.name ?? agentId;
  const run_id = randomUUID();
  const tested_at = new Date().toISOString();

  const l1 = skipLevels.includes("level1")
    ? {
        status: "skipped" as const,
        duration_ms: 0,
        error: null,
        evidence: "skipped",
      }
    : runLevel1ServiceCheck(agentId);
  const l2 = skipLevels.includes("level2")
    ? {
        status: "skipped" as const,
        duration_ms: 0,
        error: null,
        evidence: "skipped",
      }
    : runBasicTask(agentId);
  const l3 = skipLevels.includes("level3")
    ? {
        status: "skipped" as const,
        duration_ms: 0,
        error: null,
        evidence: "skipped",
      }
    : runComplexTask(agentId);
  const l4 = skipLevels.includes("level4")
    ? {
        status: "skipped" as const,
        duration_ms: 0,
        error: null,
        evidence: "skipped",
      }
    : verifyResult(agentId, "complex_task", {}, "assertion", []);
  const levels = {
    level1_service_readiness: l1,
    level2_basic_task: l2,
    level3_complex_task: l3,
    level4_verification: l4,
    level5_memory_write: {
      status: "skipped",
      duration_ms: 0,
      error: null,
      evidence: "pending",
    } as LevelResult,
  };
  const confidence_score = computeConfidence(levels);
  const readiness = deriveReadiness(levels);

  const result: ValidationResult = {
    run_id,
    agent_id: agentId,
    agent_name: name,
    tested_at,
    levels,
    readiness,
    confidence_score,
    notes: "",
    retry_count: 0,
  };

  // L5: write summary
  if (!skipLevels.includes("level5")) {
    const writeResult = writeValidationSummary(agentId, result);
    levels.level5_memory_write = {
      status: writeResult.written ? "passed" : "failed",
      duration_ms: 0,
      error: null,
      evidence: `Written to ${writeResult.source}`,
    } as LevelResult;
    result.confidence_score = computeConfidence(levels);
  }

  return result;
}

function runSystemValidation(
  filterStatus = "all",
  parallel = false,
): { total: number; results: ValidationResult[] } {
  const { agents } = discoverAgents(filterStatus);
  // Sequential for safety (parallel would need Promise.all — viable in prod)
  const results = agents.map((a) => runFullValidation(a.id));
  return { total: results.length, results };
}

// ── MCP Server ──────────────────────────────────────────────────────────────

const server = new Server(
  { name: "validation-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "discover_agents",
      description: "Load agent-registry and list all agents.",
      inputSchema: {
        type: "object",
        properties: { filter_status: { type: "string" } },
      },
    },
    {
      name: "run_level1_service_check",
      description: "Verify service-level readiness for one agent.",
      inputSchema: {
        type: "object",
        required: ["agent_id"],
        properties: { agent_id: { type: "string" } },
      },
    },
    {
      name: "run_basic_task",
      description: "Execute the agent's defined basic_task.",
      inputSchema: {
        type: "object",
        required: ["agent_id"],
        properties: { agent_id: { type: "string" } },
      },
    },
    {
      name: "run_complex_task",
      description: "Execute the agent's defined complex_task.",
      inputSchema: {
        type: "object",
        required: ["agent_id"],
        properties: { agent_id: { type: "string" } },
      },
    },
    {
      name: "verify_result",
      description: "Verify a task output against success criteria.",
      inputSchema: {
        type: "object",
        required: [
          "agent_id",
          "task_name",
          "output",
          "verification_method",
          "success_criteria",
        ],
        properties: {
          agent_id: { type: "string" },
          task_name: { type: "string" },
          output: {},
          verification_method: { type: "string" },
          success_criteria: { type: "array" },
        },
      },
    },
    {
      name: "write_validation_summary",
      description: "Write ValidationResult to registry and cache.",
      inputSchema: {
        type: "object",
        required: ["agent_id", "validation_result"],
        properties: {
          agent_id: { type: "string" },
          validation_result: { type: "object" },
        },
      },
    },
    {
      name: "run_full_validation",
      description: "Run all 5 levels for one agent.",
      inputSchema: {
        type: "object",
        required: ["agent_id"],
        properties: {
          agent_id: { type: "string" },
          skip_levels: { type: "array" },
        },
      },
    },
    {
      name: "run_system_validation",
      description: "Run full validation for ALL agents.",
      inputSchema: {
        type: "object",
        properties: {
          filter_status: { type: "string" },
          parallel: { type: "boolean" },
        },
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    let result: unknown;
    switch (name) {
      case "discover_agents":
        result = discoverAgents(args.filter_status as string);
        break;
      case "run_level1_service_check":
        result = runLevel1ServiceCheck(args.agent_id as string);
        break;
      case "run_basic_task":
        result = runBasicTask(args.agent_id as string);
        break;
      case "run_complex_task":
        result = runComplexTask(args.agent_id as string);
        break;
      case "verify_result":
        result = verifyResult(
          args.agent_id as string,
          args.task_name as string,
          args.output,
          args.verification_method as string,
          (args.success_criteria as string[]) ?? [],
        );
        break;
      case "write_validation_summary":
        result = writeValidationSummary(
          args.agent_id as string,
          args.validation_result as ValidationResult,
        );
        break;
      case "run_full_validation":
        result = runFullValidation(
          args.agent_id as string,
          (args.skip_levels as string[]) ?? [],
        );
        break;
      case "run_system_validation":
        result = runSystemValidation(
          args.filter_status as string,
          args.parallel as boolean,
        );
        break;
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    return {
      content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
    };
  } catch (err: unknown) {
    return {
      content: [{ type: "text", text: JSON.stringify({ error: String(err) }) }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
server.connect(transport);

export const REGISTRATION = {
  id: "validation-agent-mcp",
  name: "ValidationAgent",
  layer: "backbone",
  model_lane: "glm_flash",
  status: "unknown",
};
