/**
 * AgentLee MCP Server
 * Exposes Agent Lee's capabilities to GitHub Copilot Chat as MCP tools.
 *
 * TAG: AGENTLEE.MCP.SERVER.STDIO
 * VERSION: 1.0.0
 *
 * Tools exposed:
 *   agentlee_health    — brain + vision agent health status
 *   agentlee_chat      — send a prompt to Agent Lee's brain (Qwen2.5)
 *   agentlee_speak     — TTS: speak text through Agent Lee's voice chain
 *   agentlee_screen    — capture + return current screen context
 *   agentlee_analyze   — trigger fresh vision analysis (BLIP + ResNet)
 *   agentlee_act       — execute a desktop action (click, type, key)
 *   agentlee_memory    — read Agent Lee's persistent memory lake
 *   agentlee_mission   — get the next mission from the mission queue
 */

import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { loadDotenv, mergeEnv } from "./dotenv.js";
import { CONFIG } from "./config.js";

// ── Bootstrap env ─────────────────────────────────────────────────────────────
mergeEnv(loadDotenv(CONFIG.DOTENV_PATH));

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..");

const BRAIN_URL  = process.env.BRAIN_URL  || "http://localhost:8004";
const VISION_URL = process.env.VISION_URL || "http://localhost:8005";
const HANDSHAKE  = process.env.NEURAL_HANDSHAKE || process.env.NEURAL_HANDSHAKE_KEY || "";
const MEMORY_PATH = path.join(PROJECT_ROOT, "workspace", "memory.json");

// ── HTTP helper ───────────────────────────────────────────────────────────────
async function apiFetch(url, opts = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
    if (HANDSHAKE) headers["X-Agent-Handshake"] = HANDSHAKE;
    const res = await fetch(url, { ...opts, headers, signal: controller.signal });
    const text = await res.text();
    let body;
    try { body = JSON.parse(text); } catch { body = text; }
    return { ok: res.ok, status: res.status, body };
  } catch (err) {
    return { ok: false, status: 0, body: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function ok(text) {
  return { content: [{ type: "text", text: String(text) }] };
}

function fail(text) {
  return { isError: true, content: [{ type: "text", text: String(text) }] };
}

function pretty(obj) {
  return JSON.stringify(obj, null, 2);
}

// ── Tool definitions ──────────────────────────────────────────────────────────
const TOOLS = [
  {
    name: "agentlee_health",
    description:
      "Check the health status of all Agent Lee services (brain on :8004 and vision agent on :8005). Returns combined JSON status.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "agentlee_chat",
    description:
      "Send a prompt to Agent Lee's brain (powered by Qwen2.5 via Ollama). Returns the AI response with emotional state and reasoning context.",
    inputSchema: {
      type: "object",
      properties: {
        prompt: {
          type: "string",
          description: "The message or question to send to Agent Lee",
        },
        user_id: {
          type: "string",
          description: "Optional user identifier (default: copilot)",
        },
      },
      required: ["prompt"],
    },
  },
  {
    name: "agentlee_speak",
    description:
      "Make Agent Lee speak text aloud through the TTS chain (PocketTTS → Gemini TTS → edge-tts fallback). Returns confirmation with the active TTS tier used.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "The text for Agent Lee to speak",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "agentlee_screen",
    description:
      "Get the current vision context — what Agent Lee sees on screen right now. Returns the latest perception snapshot including caption, detected objects, lighting, and CPU load.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "agentlee_analyze",
    description:
      "Trigger a fresh vision analysis: takes a screenshot, runs BLIP captioning and ResNet object detection. Returns caption, top objects, lighting estimate, and inference time.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "agentlee_act",
    description:
      "Execute a desktop action through Agent Lee's vision hands. Supported actions: click, double_click, right_click, type, key, scroll, move.",
    inputSchema: {
      type: "object",
      properties: {
        action: {
          type: "string",
          enum: ["click", "double_click", "right_click", "type", "key", "scroll", "move"],
          description: "Action to perform",
        },
        x: {
          type: "number",
          description: "X coordinate (for click/move/scroll)",
        },
        y: {
          type: "number",
          description: "Y coordinate (for click/move/scroll)",
        },
        text: {
          type: "string",
          description: "Text to type or key to press",
        },
        dx: {
          type: "number",
          description: "Horizontal scroll delta",
        },
        dy: {
          type: "number",
          description: "Vertical scroll delta",
        },
      },
      required: ["action"],
    },
  },
  {
    name: "agentlee_memory",
    description:
      "Read Agent Lee's persistent memory lake (workspace/memory.json). Returns all stored knowledge, facts, and episodic memories.",
    inputSchema: {
      type: "object",
      properties: {
        key: {
          type: "string",
          description: "Optional — filter memory by key name",
        },
      },
      required: [],
    },
  },
  {
    name: "agentlee_mission",
    description:
      "Get the next pending mission from Agent Lee's mission queue. Returns mission details including goal, priority, and status.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// ── Tool handlers ─────────────────────────────────────────────────────────────
async function handleTool(name, args) {
  switch (name) {

    case "agentlee_health": {
      const [brain, vision] = await Promise.all([
        apiFetch(`${BRAIN_URL}/health`),
        apiFetch(`${VISION_URL}/health`),
      ]);
      const result = {
        brain:  { status: brain.ok ? "ok" : "error",  data: brain.body  },
        vision: { status: vision.ok ? "ok" : "error", data: vision.body },
      };
      const allOk = brain.ok && vision.ok;
      return allOk ? ok(pretty(result)) : fail(pretty(result));
    }

    case "agentlee_chat": {
      const { prompt, user_id = "copilot" } = args;
      if (!prompt) return fail("prompt is required");
      const r = await apiFetch(`${BRAIN_URL}/chat`, {
        method: "POST",
        body: JSON.stringify({ prompt, user_id, history: [] }),
      });
      if (!r.ok) return fail(`Brain /chat error ${r.status}: ${pretty(r.body)}`);
      const reply = r.body?.reply || r.body?.response || pretty(r.body);
      return ok(reply);
    }

    case "agentlee_speak": {
      const { text } = args;
      if (!text) return fail("text is required");
      const r = await apiFetch(`${BRAIN_URL}/tts`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      if (!r.ok) return fail(`TTS error ${r.status}: ${pretty(r.body)}`);
      return ok(`Speaking: "${text}"\n${pretty(r.body)}`);
    }

    case "agentlee_screen": {
      const r = await apiFetch(`${VISION_URL}/stream/state`);
      if (!r.ok) return fail(`Vision /stream/state error ${r.status}: ${pretty(r.body)}`);
      return ok(pretty(r.body));
    }

    case "agentlee_analyze": {
      const r = await apiFetch(`${VISION_URL}/analyze`);
      if (!r.ok) return fail(`Vision /analyze error ${r.status}: ${pretty(r.body)}`);
      return ok(pretty(r.body));
    }

    case "agentlee_act": {
      const { action, x, y, text, dx, dy } = args;
      if (!action) return fail("action is required");
      const payload = { action };
      if (x !== undefined) payload.x = x;
      if (y !== undefined) payload.y = y;
      if (text !== undefined) payload.text = text;
      if (dx !== undefined) payload.dx = dx;
      if (dy !== undefined) payload.dy = dy;
      const r = await apiFetch(`${VISION_URL}/act`, {
        method: "POST",
        body: JSON.stringify(payload),
      });
      if (!r.ok) return fail(`Vision /act error ${r.status}: ${pretty(r.body)}`);
      return ok(pretty(r.body));
    }

    case "agentlee_memory": {
      const { key } = args;
      if (!fs.existsSync(MEMORY_PATH)) {
        return fail(`Memory file not found: ${MEMORY_PATH}`);
      }
      try {
        const raw = fs.readFileSync(MEMORY_PATH, "utf8");
        const mem = JSON.parse(raw);
        if (key) {
          const val = mem[key];
          if (val === undefined) return fail(`Key "${key}" not found in memory`);
          return ok(pretty({ [key]: val }));
        }
        return ok(pretty(mem));
      } catch (err) {
        return fail(`Memory read error: ${err.message}`);
      }
    }

    case "agentlee_mission": {
      const r = await apiFetch(`${BRAIN_URL}/missions/next`);
      if (!r.ok) return fail(`Missions error ${r.status}: ${pretty(r.body)}`);
      return ok(pretty(r.body));
    }

    default:
      return fail(`Unknown tool: ${name}`);
  }
}

// ── MCP Server bootstrap ──────────────────────────────────────────────────────
const server = new Server(
  { name: "AgentLee", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  return await handleTool(name, args);
});

const transport = new StdioServerTransport();
await server.connect(transport);

// Keep alive
process.stdin.resume();
