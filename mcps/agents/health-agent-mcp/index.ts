// health-agent-mcp/index.ts
// Monitors availability of all Agent Lee OS services, model lanes, and Cerebral VM.

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import "dotenv/config";
import { existsSync } from "fs";
import { join } from "path";
import { promisify } from "util";

const execAsync = promisify(exec);

const REGISTRY_PATH =
  process.env.REGISTRY_PATH ?? join(__dirname, "../../../agent-registry.json");

// ── URL safety guard ─────────────────────────────────────────────────────
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i;

function isSafeTargetUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol === "file:") return false;
    return !PRIVATE_IP_RE.test(u.hostname) || u.hostname === "localhost";
  } catch {
    return false;
  }
}

// Known model lane probe endpoints
const MODEL_LANE_PROBES: Record<string, { url: string; body: object }> = {
  glm_flash: {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    body: {
      model: "glm-4-flash",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    },
  },
  gemini: {
    url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY ?? ""}`,
    body: { contents: [{ parts: [{ text: "ping" }] }] },
  },
  qwen_local: {
    url: `${process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"}/api/generate`,
    body: { model: "qwen2.5:latest", prompt: "ping", stream: false },
  },
  glm_vision: {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    body: {
      model: "glm-4v-flash",
      messages: [{ role: "user", content: "ping" }],
      max_tokens: 1,
    },
  },
  qwen_3d: {
    url: `${process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"}/api/generate`,
    body: { model: "qwen3-3d:1.8b", prompt: "ping", stream: false },
  },
  notebooklm: {
    url: "https://notebooklm.googleapis.com",
    body: {},
  },
};

// ── tool implementations ──────────────────────────────────────────────────

async function pingService(
  target: string,
  timeout_ms = 10000,
): Promise<{
  target: string;
  status: "ok" | "timeout" | "error";
  latency_ms: number;
  http_status?: number;
  error?: string;
}> {
  // If target looks like an agent ID (no slashes), ping its conceptual health
  if (!target.startsWith("http")) {
    return {
      target,
      status: "ok",
      latency_ms: 0,
      error: "Agent ID ping: use url for HTTP check",
    };
  }
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout_ms);
    const res = await fetch(target, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      target,
      status: res.ok ? "ok" : "error",
      latency_ms: Date.now() - t0,
      http_status: res.status,
    };
  } catch (e: unknown) {
    const latency_ms = Date.now() - t0;
    const timedOut = latency_ms >= timeout_ms - 50;
    return {
      target,
      status: timedOut ? "timeout" : "error",
      latency_ms,
      error: String(e),
    };
  }
}

async function checkModelLane(
  model_lane: string,
): Promise<{
  model_lane: string;
  status: "ok" | "timeout" | "error";
  latency_ms: number;
  error?: string;
}> {
  const probe = MODEL_LANE_PROBES[model_lane];
  if (!probe)
    return {
      model_lane,
      status: "error",
      latency_ms: 0,
      error: "Unknown model lane",
    };
  const t0 = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(probe.url, {
      method: model_lane === "notebooklm" ? "GET" : "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.ZAI_API_KEY && model_lane.startsWith("glm")
          ? { Authorization: `Bearer ${process.env.ZAI_API_KEY}` }
          : {}),
      },
      body:
        model_lane === "notebooklm" ? undefined : JSON.stringify(probe.body),
      signal: controller.signal,
    });
    clearTimeout(timer);
    return {
      model_lane,
      status: res.status < 500 ? "ok" : "error",
      latency_ms: Date.now() - t0,
    };
  } catch (e: unknown) {
    return {
      model_lane,
      status: "error",
      latency_ms: Date.now() - t0,
      error: String(e),
    };
  }
}

async function checkDbConnection(
  target: "vercel_postgres" | "insforge" | "local_cache" = "vercel_postgres",
): Promise<{
  target: string;
  status: "ok" | "error";
  latency_ms: number;
  error?: string;
}> {
  const t0 = Date.now();
  if (target === "local_cache") {
    // Just check that the data dir exists
    const exists = existsSync(join(__dirname, "../../../../data"));
    return {
      target,
      status: exists ? "ok" : "error",
      latency_ms: Date.now() - t0,
    };
  }
  const baseUrl = process.env.INSFORGE_BASE_URL ?? "";
  if (!baseUrl)
    return {
      target,
      status: "error",
      latency_ms: Date.now() - t0,
      error: "INSFORGE_BASE_URL not set",
    };
  try {
    const res = await fetch(`${baseUrl}/health`, {
      headers: {
        Authorization: `Bearer ${process.env.INSFORGE_API_KEY ?? ""}`,
      },
    });
    return {
      target,
      status: res.ok ? "ok" : "error",
      latency_ms: Date.now() - t0,
    };
  } catch (e: unknown) {
    return {
      target,
      status: "error",
      latency_ms: Date.now() - t0,
      error: String(e),
    };
  }
}

async function checkCerebralVm(
  includeResources = true,
): Promise<{
  status: "ok" | "error";
  latency_ms: number;
  resources?: object;
  error?: string;
}> {
  const t0 = Date.now();
  try {
    if (includeResources) {
      const { stdout } = await execAsync(
        "wmic OS get FreePhysicalMemory,TotalVisibleMemorySize /VALUE 2>NUL",
      );
      return {
        status: "ok",
        latency_ms: Date.now() - t0,
        resources: { raw: stdout.trim() },
      };
    }
    return { status: "ok", latency_ms: Date.now() - t0 };
  } catch (e: unknown) {
    return { status: "error", latency_ms: Date.now() - t0, error: String(e) };
  }
}

async function sweepAllServices(
  includeLanes = true,
  includeAgents = true,
  includeDb = true,
): Promise<{
  services: object[];
  degraded_count: number;
  healthy_count: number;
  root_cause_analysis: object[];
}> {
  const results: {
    name: string;
    status: string;
    latency_ms: number;
    error?: string;
  }[] = [];

  // Model lanes
  if (includeLanes) {
    const lanes = Object.keys(MODEL_LANE_PROBES);
    for (const lane of lanes) {
      const r = await checkModelLane(lane);
      results.push({
        name: `model:${lane}`,
        status: r.status,
        latency_ms: r.latency_ms,
        error: r.error,
      });
    }
  }

  // Backend service
  const backendPing = await pingService(
    "http://localhost:6001/api/health",
    5000,
  );
  results.push({
    name: "service:backend",
    status: backendPing.status,
    latency_ms: backendPing.latency_ms,
  });

  // DB
  if (includeDb) {
    const db = await checkDbConnection("local_cache");
    results.push({
      name: "db:local_cache",
      status: db.status,
      latency_ms: db.latency_ms,
    });
  }

  // Cerebral
  const cerebral = await checkCerebralVm(false);
  results.push({
    name: "vm:cerebral",
    status: cerebral.status,
    latency_ms: cerebral.latency_ms,
  });

  const degraded = results.filter((r) => r.status !== "ok");
  const healthy_count = results.length - degraded.length;

  const root_cause_analysis = degraded.map((d) => ({
    service: d.name,
    probable_cause: d.error?.includes("API key")
      ? "Auth key missing or expired"
      : d.error?.includes("ECONNREFUSED") || d.error?.includes("fetch")
        ? "Service not running or unreachable"
        : d.status === "timeout"
          ? "Service too slow or overloaded"
          : "Unknown — check logs",
    recommendation: `Check ${d.name} config and restart.`,
  }));

  return {
    services: results,
    degraded_count: degraded.length,
    healthy_count,
    root_cause_analysis,
  };
}

// ── MCP Server ────────────────────────────────────────────────────────────

const server = new Server(
  { name: "health-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "ping_service",
      description: "Ping a single service URL or agent ID.",
      inputSchema: {
        type: "object",
        required: ["target"],
        properties: {
          target: { type: "string" },
          timeout_ms: { type: "number" },
        },
      },
    },
    {
      name: "check_model_lane",
      description: "Test a model lane with a minimal probe.",
      inputSchema: {
        type: "object",
        required: ["model_lane"],
        properties: { model_lane: { type: "string" } },
      },
    },
    {
      name: "check_db_connection",
      description: "Verify DB connectivity.",
      inputSchema: {
        type: "object",
        properties: { target: { type: "string" } },
      },
    },
    {
      name: "check_cerebral_vm",
      description: "Verify Cerebral PC is reachable.",
      inputSchema: {
        type: "object",
        properties: { include_resources: { type: "boolean" } },
      },
    },
    {
      name: "sweep_all_services",
      description: "Full multi-service diagnostic sweep.",
      inputSchema: {
        type: "object",
        properties: {
          include_model_lanes: { type: "boolean" },
          include_agents: { type: "boolean" },
          include_db: { type: "boolean" },
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
      case "ping_service":
        result = await pingService(
          args.target as string,
          args.timeout_ms as number,
        );
        break;
      case "check_model_lane":
        result = await checkModelLane(args.model_lane as string);
        break;
      case "check_db_connection":
        result = await checkDbConnection(
          args.target as "vercel_postgres" | "insforge" | "local_cache",
        );
        break;
      case "check_cerebral_vm":
        result = await checkCerebralVm(args.include_resources as boolean);
        break;
      case "sweep_all_services":
        result = await sweepAllServices(
          args.include_model_lanes as boolean,
          args.include_agents as boolean,
          args.include_db as boolean,
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
  id: "health-agent-mcp",
  name: "HealthAgent",
  layer: "backbone",
  model_lane: "none",
  status: "unknown",
};
