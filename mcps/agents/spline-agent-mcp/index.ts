// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/spline-agent-mcp/index.ts
// Project: Agent Lee OS — SplineAgent MCP Server
// Purpose: 3D spec generation via Qwen3-3D + Qwen3-Math with GLM fallback
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { callQwen } from "./lib/qwen-local.js";

const TOOLS = [
  {
    name: "generate_3d_spec",
    description: "Generate a 3D scene spec from a description.",
    inputSchema: { type: "object" },
  },
  {
    name: "svg_to_shape",
    description: "Convert SVG path to a 3D extrusion spec.",
    inputSchema: { type: "object" },
  },
  {
    name: "calculate_geometry",
    description: "Solve geometry/spatial math problems.",
    inputSchema: { type: "object" },
  },
  {
    name: "describe_scene",
    description: "Natural language description of a 3D scene spec.",
    inputSchema: { type: "object" },
  },
  {
    name: "refine_model_prompt",
    description: "Improve a 3D model generation prompt.",
    inputSchema: { type: "object" },
  },
];

const server = new MCPServer(
  { name: "spline-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let prompt: string;
  let model: string;

  switch (req.params.name) {
    case "generate_3d_spec":
      model = "qwen3-3d:1.8b";
      prompt = `Generate a structured JSON 3D scene specification for Spline/Three.js.\nStyle: ${args["style"] ?? "minimal"}\nFormat: ${args["output_format"] ?? "json"}\nDescription: ${args["description"]}`;
      break;
    case "svg_to_shape":
      model = "qwen3-3d:1.8b";
      prompt = `Convert this SVG path to a 3D extrusion spec. Depth: ${args["depth"] ?? 10}, Bevel: ${args["bevel"] ?? true}.\nSVG: ${args["svg_path"]}`;
      break;
    case "calculate_geometry":
      model = "qwen3-math:4b";
      prompt = `Solve this geometry/spatial math problem step by step:\n${args["problem"]}`;
      break;
    case "describe_scene":
      model = "qwen3:latest";
      prompt = `Describe this 3D scene in natural language:\n${JSON.stringify(args["scene_json"], null, 2)}`;
      break;
    case "refine_model_prompt":
      model = "qwen3:latest";
      prompt = `Improve this 3D model generation prompt for ${args["platform"] ?? "spline"}. Make it more specific, descriptive, and likely to yield high-quality output:\n"${args["prompt"]}"`;
      break;
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }

  const result = await callQwen(model, prompt);
  return { content: [{ type: "text", text: result }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
