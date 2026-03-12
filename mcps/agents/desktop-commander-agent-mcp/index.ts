// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/desktop-commander-agent-mcp/index.ts
// Project: Agent Lee OS — DesktopCommanderAgent MCP Server
// Purpose: Privileged host operations on Cerebral PC with path enforcement
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { captureState } from "./tools/capture-state.js";
import { killProcess } from "./tools/kill-process.js";
import { openApp } from "./tools/open-app.js";
import { readHostFile } from "./tools/read-file.js";
import { runTerminal } from "./tools/run-terminal.js";
import { writeHostFile } from "./tools/write-file.js";

const TOOLS = [
  {
    name: "open_app",
    description: "Launch an application by name or path.",
    inputSchema: { type: "object" },
  },
  {
    name: "run_terminal",
    description: "Run a shell command in an allowlisted working directory.",
    inputSchema: { type: "object" },
  },
  {
    name: "read_file",
    description: "Read a file from an allowlisted path.",
    inputSchema: { type: "object" },
  },
  {
    name: "write_file",
    description: "Write content to a file at an allowlisted path.",
    inputSchema: { type: "object" },
  },
  {
    name: "kill_process",
    description: "Terminate a process by name or PID.",
    inputSchema: { type: "object" },
  },
  {
    name: "capture_state",
    description: "Capture a system snapshot (processes, disk, memory).",
    inputSchema: { type: "object" },
  },
];

const server = new MCPServer(
  { name: "desktop-commander-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let result: unknown;
  switch (req.params.name) {
    case "open_app":
      result = await openApp(args);
      break;
    case "run_terminal":
      result = await runTerminal(args);
      break;
    case "read_file":
      result = await readHostFile(args);
      break;
    case "write_file":
      result = await writeHostFile(args);
      break;
    case "kill_process":
      result = await killProcess(args);
      break;
    case "capture_state":
      result = await captureState(args);
      break;
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
