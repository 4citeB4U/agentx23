// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/stitch-agent-mcp/index.ts
// Project: Agent Lee OS — StitchAgent MCP Server
// Purpose: UI generation and design refinement via Stitch MCP + Gemini
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { callGemini } from "./lib/gemini.js";

const TOOLS = [
  {
    name: "generate_component",
    description: "Generate a React component from a description.",
    inputSchema: { type: "object" },
  },
  {
    name: "refine_layout",
    description: "Refine an existing component given improvement notes.",
    inputSchema: { type: "object" },
  },
  {
    name: "draft_screen",
    description: "Draft a full screen layout for a given page purpose.",
    inputSchema: { type: "object" },
  },
  {
    name: "map_ui_flow",
    description: "Map navigation flow between screens for a feature.",
    inputSchema: { type: "object" },
  },
  {
    name: "propose_design_patch",
    description: "Propose a targeted UI fix given complaint + screenshot.",
    inputSchema: { type: "object" },
  },
];

const server = new MCPServer(
  { name: "stitch-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let prompt: string;

  switch (req.params.name) {
    case "generate_component":
      prompt = `Generate a clean, accessible ${args["framework"] ?? "React"} component for: "${args["description"]}". ${args["style_guide"] ? `Style guide: ${args["style_guide"]}` : ""} Return only the component code.`;
      break;
    case "refine_layout":
      prompt = `Refine this UI component based on the following notes.\n\nNotes: ${args["notes"]}\n\nOriginal:\n\`\`\`tsx\n${args["component_code"]}\n\`\`\`\n\nReturn only the improved code.`;
      break;
    case "draft_screen":
      prompt = `Draft a full ${args["framework"] ?? "React"} screen layout for "${args["screen_name"]}" whose purpose is: "${args["purpose"]}". Sections: ${JSON.stringify(args["sections"] ?? [])}. Return JSX only.`;
      break;
    case "map_ui_flow":
      prompt = `Map the navigation flow for feature "${args["feature"]}" across these screens: ${JSON.stringify(args["screens"] ?? [])}. Return a Mermaid flowchart diagram.`;
      break;
    case "propose_design_patch":
      prompt = `The user reports: "${args["complaint"]}". Analyze the attached screenshot and propose a minimal targeted CSS/JSX patch to fix this issue. Return only the patch code.`;
      break;
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }

  const result = await callGemini(
    prompt,
    args["screenshot_base64"] as string | undefined,
  );
  return { content: [{ type: "text", text: result }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
