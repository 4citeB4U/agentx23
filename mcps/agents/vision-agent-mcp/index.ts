// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/vision-agent-mcp/index.ts
// Project: Agent Lee OS — VisionAgent MCP Server
// Purpose: Visual perception via GLM-4.6V + Qwen3-Vision fallback
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { callGlmVision } from "./lib/glm-vision.js";

const TOOLS = [
  {
    name: "describe_screenshot",
    description: "Describe what is visible in a base64 screenshot.",
    inputSchema: { type: "object" },
  },
  {
    name: "read_ui_elements",
    description: "Extract interactive UI elements from a screenshot.",
    inputSchema: { type: "object" },
  },
  {
    name: "extract_text_from_image",
    description: "OCR — pull all text from an image.",
    inputSchema: { type: "object" },
  },
  {
    name: "compare_before_after",
    description: "Diff two screenshots and describe what changed.",
    inputSchema: { type: "object" },
  },
  {
    name: "detect_error_state",
    description: "Detect visible errors, warnings, or crash indicators.",
    inputSchema: { type: "object" },
  },
];

const PROMPTS: Record<string, string> = {
  describe_screenshot: "Describe what is shown in this screenshot in detail.",
  read_ui_elements:
    "List all interactive UI elements (buttons, inputs, links, dropdowns) visible in this screenshot with their labels and approximate positions.",
  extract_text_from_image:
    "Extract all visible text from this image. Return only the text, no commentary.",
  detect_error_state:
    'Identify any error messages, warning banners, crash dialogs, or anomalous states visible in this screenshot. If none, say "No errors detected."',
};

const server = new MCPServer(
  { name: "vision-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  const toolName = req.params.name;

  if (toolName === "compare_before_after") {
    const result = await callGlmVision(
      "Compare these two screenshots. Describe specifically what UI elements changed, appeared, or disappeared.",
      String(args["before_base64"] ?? ""),
      String(args["after_base64"] ?? ""),
    );
    return { content: [{ type: "text", text: result }] };
  }

  const prompt =
    (args["question"] as string) || PROMPTS[toolName] || "Describe this image.";
  const image = String(args["image_base64"] ?? "");

  if (!image) {
    throw new Error("image_base64 is required");
  }

  // Guard: reject oversized images (>10MB base64 ≈ ~7.5MB binary)
  if (image.length > 14_000_000) {
    throw new Error("Image too large. Maximum size is ~10MB.");
  }

  const result = await callGlmVision(prompt, image);
  return { content: [{ type: "text", text: result }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
