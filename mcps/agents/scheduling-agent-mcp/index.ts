// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/scheduling-agent-mcp/index.ts
// Project: Agent Lee OS — SchedulingAgent MCP Server
// Purpose: Calendar & task scheduling backed by InsForge Postgres
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const INSFORGE_BASE = process.env.INSFORGE_API_BASE_URL ?? "";
const INSFORGE_TOKEN = process.env.INSFORGE_TOKEN ?? "";

// ---------------------------------------------------------------------------
// InsForge REST helper — thin wrapper over PostgREST API
// ---------------------------------------------------------------------------
async function insforge(
  path: string,
  method: "GET" | "POST" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<unknown> {
  if (!INSFORGE_BASE || !INSFORGE_TOKEN) {
    throw new Error("INSFORGE_API_BASE_URL / INSFORGE_TOKEN not configured");
  }
  const res = await fetch(`${INSFORGE_BASE}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: INSFORGE_TOKEN,
      Authorization: `Bearer ${INSFORGE_TOKEN}`,
      "Content-Type": "application/json",
      Prefer: method === "POST" ? "return=representation" : "return=minimal",
    },
    body: body != null ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => `HTTP ${res.status}`);
    throw new Error(`InsForge ${res.status}: ${text.slice(0, 200)}`);
  }
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json") && res.status !== 204) {
    return res.json();
  }
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Tool definitions
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "create_event",
    description: "Schedule a new event or task.",
    inputSchema: {
      type: "object",
      properties: {
        title: { type: "string", description: "Event title." },
        description: {
          type: "string",
          description: "Details about the event.",
        },
        start_time: {
          type: "string",
          description: "ISO-8601 datetime for event start.",
        },
        end_time: {
          type: "string",
          description: "ISO-8601 datetime for event end.",
        },
        recurrence: {
          type: "string",
          description:
            "Optional: daily | weekly | monthly | none (default: none).",
        },
        tags: {
          type: "array",
          items: { type: "string" },
          description: "Optional labels (e.g. ['urgent', 'meeting']).",
        },
      },
      required: ["title", "start_time"],
    },
  },
  {
    name: "list_events",
    description: "List upcoming events within a date range.",
    inputSchema: {
      type: "object",
      properties: {
        from: {
          type: "string",
          description: "ISO-8601 start date (default: now).",
        },
        to: {
          type: "string",
          description: "ISO-8601 end date (default: 7 days from now).",
        },
        limit: {
          type: "number",
          description: "Max events to return (default: 20).",
        },
      },
    },
  },
  {
    name: "update_event",
    description: "Update an existing event by ID.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "UUID of the event to update.",
        },
        title: { type: "string" },
        description: { type: "string" },
        start_time: { type: "string" },
        end_time: { type: "string" },
        recurrence: { type: "string" },
        status: {
          type: "string",
          description: "pending | in_progress | done | cancelled",
        },
      },
      required: ["event_id"],
    },
  },
  {
    name: "delete_event",
    description: "Remove an event by ID.",
    inputSchema: {
      type: "object",
      properties: {
        event_id: {
          type: "string",
          description: "UUID of the event to delete.",
        },
      },
      required: ["event_id"],
    },
  },
  {
    name: "get_next_event",
    description: "Retrieve the next upcoming event from now.",
    inputSchema: { type: "object" },
  },
];

// ---------------------------------------------------------------------------
// Server setup
// ---------------------------------------------------------------------------
const server = new MCPServer(
  { name: "scheduling-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let result: unknown;

  switch (req.params.name) {
    case "create_event": {
      const payload = {
        title: String(args["title"] ?? ""),
        description: String(args["description"] ?? ""),
        start_time: String(args["start_time"] ?? new Date().toISOString()),
        end_time: args["end_time"] ? String(args["end_time"]) : null,
        recurrence: String(args["recurrence"] ?? "none"),
        tags: Array.isArray(args["tags"]) ? args["tags"] : [],
        status: "pending",
        created_at: new Date().toISOString(),
      };
      result = await insforge("agent_events", "POST", payload);
      break;
    }
    case "list_events": {
      const from = String(args["from"] ?? new Date().toISOString());
      const to = String(
        args["to"] ??
          new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      );
      const limit = Number(args["limit"] ?? 20);
      result = await insforge(
        `agent_events?select=*&start_time=gte.${encodeURIComponent(from)}&start_time=lte.${encodeURIComponent(to)}&order=start_time.asc&limit=${limit}`,
        "GET",
      );
      break;
    }
    case "update_event": {
      const id = String(args["event_id"] ?? "");
      const patch: Record<string, unknown> = {};
      for (const key of [
        "title",
        "description",
        "start_time",
        "end_time",
        "recurrence",
        "status",
      ]) {
        if (args[key] != null) patch[key] = args[key];
      }
      result = await insforge(
        `agent_events?id=eq.${encodeURIComponent(id)}`,
        "PATCH",
        patch,
      );
      break;
    }
    case "delete_event": {
      const id = String(args["event_id"] ?? "");
      result = await insforge(
        `agent_events?id=eq.${encodeURIComponent(id)}`,
        "DELETE",
      );
      break;
    }
    case "get_next_event": {
      const now = new Date().toISOString();
      result = await insforge(
        `agent_events?select=*&start_time=gte.${encodeURIComponent(now)}&status=eq.pending&order=start_time.asc&limit=1`,
        "GET",
      );
      break;
    }
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }

  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
