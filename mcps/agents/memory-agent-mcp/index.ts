// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/memory-agent-mcp/index.ts
// Project: Agent Lee OS — MemoryAgent MCP Server
// Purpose: Three-layer memory (session → InsForge cache → NotebookLM deep recall)
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { sessionStore } from "./lib/session-store.js";
import { buildContextPacket } from "./tools/build-context-packet.js";
import { compressSession } from "./tools/compress-session.js";
import { fetchRelatedEpisodes } from "./tools/fetch-related-episodes.js";
import { recallContext } from "./tools/recall-context.js";
import { writeSummary } from "./tools/write-summary.js";

const TOOLS = [
  {
    name: "recall_context",
    description:
      "3-layer memory recall: session → InsForge cache → NotebookLM deep. Pass utterance + session_id.",
    inputSchema: {
      type: "object",
      properties: {
        utterance: {
          type: "string",
          description: "The query or utterance to search memory for.",
        },
        session_id: {
          type: "string",
          description: "Active session identifier (default: 'default').",
        },
      },
    },
  },
  {
    name: "append_session",
    description: "Append a message to the Layer-1 in-memory session store.",
    inputSchema: {
      type: "object",
      properties: {
        session_id: { type: "string" },
        role: { type: "string", enum: ["user", "agent"] },
        content: { type: "string" },
      },
      required: ["session_id", "role", "content"],
    },
  },
  {
    name: "compress_session",
    description: "Summarize current session into a MemorySnapshot.",
    inputSchema: { type: "object" },
  },
  {
    name: "build_context_packet",
    description: "Assemble a full ContextPacket from session + memory.",
    inputSchema: { type: "object" },
  },
  {
    name: "write_summary",
    description: "Persist a MissionSummary to canonical memory.",
    inputSchema: { type: "object" },
  },
  {
    name: "fetch_related_episodes",
    description: "Retrieve past MissionSummaries related to utterance.",
    inputSchema: { type: "object" },
  },
];

const server = new MCPServer(
  { name: "memory-agent-mcp", version: "2.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let result: unknown;
  switch (req.params.name) {
    case "recall_context":
      result = await recallContext(args);
      break;
    case "append_session": {
      const msg = sessionStore.append(
        String(args["session_id"] ?? "default"),
        (args["role"] as "user" | "agent") ?? "user",
        String(args["content"] ?? ""),
      );
      result = { ok: true, id: msg.id };
      break;
    }
    case "compress_session":
      result = await compressSession(args);
      break;
    case "build_context_packet":
      result = await buildContextPacket(args);
      break;
    case "write_summary":
      result = await writeSummary(args);
      break;
    case "fetch_related_episodes":
      result = await fetchRelatedEpisodes(args);
      break;
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
