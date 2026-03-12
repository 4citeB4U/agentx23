// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/testsprite-agent-mcp/index.ts
// Project: Agent Lee OS — TestSpriteAgent MCP Server
// Purpose: QA orchestration: preflight, unit, contract, E2E tests
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);
const CWD = "C:\\Tools\\Portable-VSCode-MCP-Kit";

async function runShell(
  cmd: string,
): Promise<{ stdout: string; stderr: string; ok: boolean }> {
  try {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: CWD,
      timeout: 120_000,
      maxBuffer: 1024 * 1024 * 8,
    });
    return { stdout: stdout.trim(), stderr: stderr.trim(), ok: true };
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string };
    return {
      stdout: (e.stdout ?? "").trim(),
      stderr: (e.stderr ?? String(err)).trim(),
      ok: false,
    };
  }
}

const TOOLS = [
  {
    name: "run_preflight",
    description: "Check all services are healthy before tests.",
    inputSchema: { type: "object" },
  },
  {
    name: "run_unit_tests",
    description: "Execute unit tests with Vitest.",
    inputSchema: { type: "object" },
  },
  {
    name: "run_contract_tests",
    description: "Validate API contracts against JSON schemas.",
    inputSchema: { type: "object" },
  },
  {
    name: "run_e2e_tests",
    description: "Run E2E browser tests via Playwright.",
    inputSchema: { type: "object" },
  },
  {
    name: "summarize_failures",
    description: "Produce a concise failure report from test output.",
    inputSchema: { type: "object" },
  },
];

const server = new MCPServer(
  { name: "testsprite-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let result: unknown;

  switch (req.params.name) {
    case "run_preflight": {
      const r = await runShell(
        "node Health-Check.ps1 2>&1 || pwsh -File Health-Check.ps1",
      );
      result = { ok: r.ok, output: r.stdout || r.stderr };
      break;
    }
    case "run_unit_tests": {
      const pattern = args["pattern"] ? `-- "${args["pattern"]}"` : "";
      const coverage = args["coverage"] ? "--coverage" : "";
      const r = await runShell(`npx vitest run ${coverage} ${pattern}`.trim());
      result = { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
      break;
    }
    case "run_contract_tests": {
      const r = await runShell("npx vitest run tests/contracts");
      result = { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
      break;
    }
    case "run_e2e_tests": {
      const spec = args["spec_pattern"] ? `"${args["spec_pattern"]}"` : "";
      const headed = args["headed"] ? "--headed" : "";
      const r = await runShell(`npx playwright test ${spec} ${headed}`.trim());
      result = { ok: r.ok, stdout: r.stdout, stderr: r.stderr };
      break;
    }
    case "summarize_failures": {
      const output = String(args["test_output"] ?? "");
      const failures = output
        .split("\n")
        .filter(
          (l) => l.includes("FAIL") || l.includes("Error") || l.includes("✗"),
        )
        .slice(0, 30);
      result = {
        summary: failures.length
          ? failures.join("\n")
          : "No failures detected.",
        count: failures.length,
      };
      break;
    }
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }

  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
