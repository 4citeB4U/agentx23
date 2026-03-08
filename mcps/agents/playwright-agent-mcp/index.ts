// =============================================================================
// LEEWAY HEADER
// File: mcps/agents/playwright-agent-mcp/index.ts
// Project: Agent Lee OS — PlaywrightAgent MCP Server
// Purpose: Browser automation via Playwright with SSRF guard
// =============================================================================
import { Server as MCPServer } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
    CallToolRequestSchema,
    ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { BrowserContext, chromium, Page } from "playwright";

// ---------------------------------------------------------------------------
// SSRF guard — block file:// and private IP ranges
// ---------------------------------------------------------------------------
function assertSafeUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.protocol === "file:")
    throw new Error("[PlaywrightAgent] file:// URLs are blocked.");
  const host = parsed.hostname;
  const privateRanges = [
    /^127\./,
    /^10\./,
    /^192\.168\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^::1$/,
    /^localhost$/i,
  ];
  if (privateRanges.some((r) => r.test(host))) {
    throw new Error(
      `[PlaywrightAgent] Access to private/internal host "${host}" is blocked (SSRF guard).`,
    );
  }
}

// ---------------------------------------------------------------------------
// Browser singleton
// ---------------------------------------------------------------------------
let ctx: BrowserContext | null = null;
let page: Page | null = null;

async function getPage(): Promise<Page> {
  if (!ctx) {
    const browser = await chromium.launch({ headless: true });
    ctx = await browser.newContext({ userAgent: "AgentLeeBot/1.0" });
  }
  if (!page || page.isClosed()) {
    page = await ctx.newPage();
  }
  return page;
}

// ---------------------------------------------------------------------------
// Tool implementations
// ---------------------------------------------------------------------------
async function openPage(args: Record<string, unknown>) {
  const url = String(args["url"] ?? "");
  const wait = Number(args["wait_ms"] ?? 2000);
  assertSafeUrl(url);
  const p = await getPage();
  await p.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  if (wait > 0) await p.waitForTimeout(wait);
  return { title: await p.title(), url: p.url() };
}

async function clickElement(args: Record<string, unknown>) {
  const p = await getPage();
  const selector = String(args["selector"] ?? "");
  const text = args["text"] as string | undefined;
  if (text) {
    await p.getByText(text).first().click({ timeout: 10_000 });
  } else {
    await p.locator(selector).first().click({ timeout: 10_000 });
  }
  return { clicked: true };
}

async function extractPageData(args: Record<string, unknown>) {
  const p = await getPage();
  const selector = String(args["selector"] ?? "body");
  const format = String(args["format"] ?? "text");
  const el = p.locator(selector).first();
  if (format === "html") return { data: await el.innerHTML() };
  if (format === "json") return { data: await el.innerText() }; // caller parses
  return { data: await el.innerText() };
}

async function submitForm(args: Record<string, unknown>) {
  const p = await getPage();
  const fields = (args["fields"] as Record<string, string>) ?? {};
  const submit = String(
    args["submit_selector"] ?? "button[type=submit], input[type=submit]",
  );
  for (const [sel, val] of Object.entries(fields)) {
    await p.locator(sel).first().fill(val);
  }
  await p.locator(submit).first().click();
  await p.waitForLoadState("domcontentloaded");
  return { submitted: true, url: p.url() };
}

async function captureBrowserScreenshot(args: Record<string, unknown>) {
  const p = await getPage();
  const fullPage = Boolean(args["full_page"] ?? true);
  const buf = await p.screenshot({ fullPage, type: "png" });
  return { image_base64: buf.toString("base64") };
}

// ---------------------------------------------------------------------------
// MCP Server
// ---------------------------------------------------------------------------
const TOOLS = [
  {
    name: "open_page",
    description: "Navigate browser to a URL.",
    inputSchema: { type: "object" },
  },
  {
    name: "click_element",
    description: "Click a UI element by selector or text.",
    inputSchema: { type: "object" },
  },
  {
    name: "extract_page_data",
    description: "Extract text/html from current page.",
    inputSchema: { type: "object" },
  },
  {
    name: "submit_form",
    description: "Fill and submit a form.",
    inputSchema: { type: "object" },
  },
  {
    name: "capture_browser_screenshot",
    description: "Take a full-page screenshot as base64.",
    inputSchema: { type: "object" },
  },
];

const server = new MCPServer(
  { name: "playwright-agent-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const args = (req.params.arguments ?? {}) as Record<string, unknown>;
  let result: unknown;
  switch (req.params.name) {
    case "open_page":
      result = await openPage(args);
      break;
    case "click_element":
      result = await clickElement(args);
      break;
    case "extract_page_data":
      result = await extractPageData(args);
      break;
    case "submit_form":
      result = await submitForm(args);
      break;
    case "capture_browser_screenshot":
      result = await captureBrowserScreenshot(args);
      break;
    default:
      throw new Error(`Unknown tool: ${req.params.name}`);
  }
  return { content: [{ type: "text", text: JSON.stringify(result) }] };
});

const transport = new StdioServerTransport();
await server.connect(transport);
