/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.TOOLDISPATCHER
LICENSE: MIT

PURPOSE: Phase 4 tool dispatcher.
         11 core tools + 13 device bridge actions (real implementations).
         + Digital life operator integration.
         MCP routing for eligible tools.

TOOLS:
  Core:      search_web, read_file, write_file, run_terminal
  Retrieval: search_workspace, search_memory, search_logs,
             list_directory, summarize_file
  Research:  research (structured multi-query workflow)
  Device:    open_app, launch_intent, inspect_device_state,
             inspect_bluetooth, open_system_panel, verify_action,
             open_phone_dialer, open_calendar, open_maps,
             open_messages, open_email, open_settings_panel,
             inspect_battery, inspect_network
*/

import {
  ActiveTool,
  ThreadEvent,
  createThreadEvent,
} from "./types";
import {
  DeviceActionName,
  executeDeviceBridge as realDeviceBridge,
  buildDeviceVerificationEvent,
} from "./deviceBridge";
import {
  runDoctor,
  runAssess,
  runAudit,
  explainFile,
  routeTask,
  runHealthCheck,
  formatDoctorReport,
  formatAssessment,
  getComplianceEmoji,
  logMemoryReceipt,
  scoreFileCompliance,
} from "./leewayBridge";

// ── API Helper ─────────────────────────────────────────────────────────────
const HANDSHAKE =
  (import.meta as any)?.env?.VITE_NEURAL_HANDSHAKE ||
  localStorage.getItem("AGENT_LEE_KEY") ||
  "AGENT_LEE_SOVEREIGN_V1";

const vmFetch = (url: string, opts: RequestInit = {}) =>
  fetch(url, {
    ...opts,
    headers: {
      "Content-Type": "application/json",
      "x-neural-handshake": HANDSHAKE,
      ...(opts.headers as any),
    },
  });

// ── Tool Names ─────────────────────────────────────────────────────────────
export type ToolName =
  // Core (Phase 2)
  | "search_web"
  | "read_file"
  | "write_file"
  | "run_terminal"
  // Retrieval (Phase 3)
  | "search_workspace"
  | "search_memory"
  | "search_logs"
  | "list_directory"
  | "summarize_file"
  // Research (Phase 3)
  | "research"
  // Device bridge (Phase 3 originals)
  | "open_app"
  | "launch_intent"
  | "inspect_device_state"
  | "inspect_bluetooth"
  | "open_system_panel"
  | "verify_action"
  // Device bridge (Phase 4 additions)
  | "open_phone_dialer"
  | "open_calendar"
  | "open_maps"
  | "open_messages"
  | "open_email"
  | "open_settings_panel"
  | "inspect_battery"
  | "inspect_network"
  // Leeway SDK (Phase 4)
  | "leeway_doctor"
  | "leeway_assess"
  | "leeway_audit"
  | "leeway_explain"
  | "leeway_route"
  | "leeway_health";

/** Maps a tool name to the right-panel ActiveTool */
export const TOOL_TO_PANEL: Record<ToolName, ActiveTool> = {
  search_web: "browser",
  read_file: "editor",
  write_file: "editor",
  run_terminal: "terminal",
  search_workspace: "files",
  search_memory: "files",
  search_logs: "terminal",
  list_directory: "files",
  summarize_file: "editor",
  research: "browser",
  open_app: "browser",
  launch_intent: "none",
  inspect_device_state: "terminal",
  inspect_bluetooth: "terminal",
  open_system_panel: "none",
  verify_action: "none",
  // Phase 4
  open_phone_dialer: "none",
  open_calendar: "browser",
  open_maps: "browser",
  open_messages: "none",
  open_email: "browser",
  open_settings_panel: "none",
  inspect_battery: "terminal",
  inspect_network: "terminal",
  // Leeway SDK
  leeway_doctor: "terminal",
  leeway_assess: "terminal",
  leeway_audit: "terminal",
  leeway_explain: "editor",
  leeway_route: "none",
  leeway_health: "terminal",
};

/** Tools that are eligible for MCP routing */
export const MCP_ELIGIBLE: Set<ToolName> = new Set([
  "search_web",
  "research",
  "search_workspace",
  "search_memory",
  "summarize_file",
  // Phase 4: device inspections can leverage MCP
  "inspect_device_state",
  "inspect_battery",
  "inspect_network",
  "inspect_bluetooth",
  // Leeway SDK agents can be MCP-routed for enhanced results
  "leeway_doctor",
  "leeway_assess",
  "leeway_audit",
  "leeway_health",
]);


// ── Tool Result ────────────────────────────────────────────────────────────
export interface ToolResult {
  success: boolean;
  /** Human-readable summary */
  summary: string;
  /** Raw data */
  data: any;
  /** Verification evidence */
  verification: {
    verified: boolean;
    evidence: string;
  };
  /** Corresponding panel to show */
  panel: ActiveTool;
  /** Thread events emitted by this invocation */
  events: ThreadEvent[];
  /** Whether this was routed through MCP */
  mcpRouted?: boolean;
}

// ── Helper: verification event ─────────────────────────────────────────────
function verifyEvt(
  success: boolean,
  title: string,
  detail: string,
  tool: string,
  verification: { verified: boolean; evidence: string },
): ThreadEvent {
  return createThreadEvent(
    "verify",
    title,
    detail,
    { status: success ? "success" : "error", verification, tool },
  );
}

// ── Helper: error result ───────────────────────────────────────────────────
function errorResult(
  msg: string,
  tool: ToolName,
  events: ThreadEvent[],
): ToolResult {
  return {
    success: false,
    summary: msg,
    data: null,
    verification: { verified: true, evidence: msg },
    panel: TOOL_TO_PANEL[tool],
    events,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  CORE TOOLS (Phase 2 — preserved + improved)
// ══════════════════════════════════════════════════════════════════════════

export async function searchWeb(query: string): Promise<ToolResult> {
  const evt = createThreadEvent("search", `Searching: "${query}"`, "Checking the web from my workspace…", { status: "running", tool: "search_web" });
  const events: ThreadEvent[] = [evt];
  try {
    const res = await vmFetch(`/api/search?q=${encodeURIComponent(query)}&engine=duckduckgo`);
    if (!res.ok) { evt.status = "error"; evt.content = `HTTP ${res.status}`; evt.verification = { verified: true, evidence: `HTTP ${res.status}` }; return errorResult(evt.content, "search_web", events); }
    const data = await res.json();
    const results = data.results || [];
    evt.status = "success"; evt.content = `${results.length} results for "${query}"`; evt.data = { query, results };
    evt.verification = { verified: true, evidence: `${results.length} results, HTTP 200` };
    events.push(verifyEvt(results.length > 0, results.length > 0 ? "Search verified" : "No results", results.length > 0 ? `Top: ${results[0]?.title || "?"}` : "Query needs refinement", "search_web", evt.verification));
    return { success: results.length > 0, summary: evt.content, data: { query, results, url: data.url }, verification: evt.verification, panel: "browser", events };
  } catch (err: any) {
    evt.status = "error"; evt.content = `Network: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "search_web", events);
  }
}

export async function readFile(filePath: string): Promise<ToolResult> {
  const evt = createThreadEvent("read_file", `Reading: ${filePath}`, "Opening file in workspace…", { status: "running", tool: "read_file" });
  const events: ThreadEvent[] = [evt];
  try {
    const res = await vmFetch(`/api/vm/vfs/read?path=${encodeURIComponent(filePath)}`);
    const data = await res.json();
    if (data.content != null) {
      const len = data.content.length;
      evt.status = "success"; evt.content = `${len} chars loaded`; evt.data = { path: filePath, content: data.content };
      evt.verification = { verified: true, evidence: `File exists, ${len} chars` };
      events.push(verifyEvt(true, "File read verified", `${filePath} — ${len} chars`, "read_file", evt.verification));
      return { success: true, summary: evt.content, data: { path: filePath, content: data.content }, verification: evt.verification, panel: "editor", events };
    }
    evt.status = "error"; evt.content = `Not found: ${filePath}`; evt.verification = { verified: true, evidence: "Missing or empty" }; return errorResult(evt.content, "read_file", events);
  } catch (err: any) {
    evt.status = "error"; evt.content = `Read failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "read_file", events);
  }
}

export async function writeFile(filePath: string, content: string): Promise<ToolResult> {
  const evt = createThreadEvent("write_file", `Writing: ${filePath}`, "Saving to workspace copy…", { status: "running", tool: "write_file" });
  const events: ThreadEvent[] = [evt];
  try {
    const res = await vmFetch("/api/vm/vfs/write", { method: "POST", body: JSON.stringify({ path: filePath, content }) });
    const data = await res.json();
    if (data.ok || res.ok) {
      evt.status = "success"; evt.content = `Saved: ${filePath} (${content.length} chars)`; evt.data = { path: filePath, size: content.length };
      evt.verification = { verified: true, evidence: "Written to workspace VFS" };
      events.push(verifyEvt(true, "Write verified", `${filePath} — ${content.length} chars`, "write_file", evt.verification));
      return { success: true, summary: evt.content, data: { path: filePath, size: content.length }, verification: evt.verification, panel: "editor", events };
    }
    evt.status = "error"; evt.content = `Write failed: ${data.error || "unknown"}`; evt.verification = { verified: true, evidence: data.error || "rejected" }; return errorResult(evt.content, "write_file", events);
  } catch (err: any) {
    evt.status = "error"; evt.content = `Write failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "write_file", events);
  }
}

export async function runTerminal(cmd: string, cwd: string = "/home/agent_lee", reason?: string): Promise<ToolResult> {
  const evt = createThreadEvent("command", `$ ${cmd}`, reason || "Running in workspace sandbox…", { status: "running", tool: "run_terminal", data: { cmd, cwd } });
  const events: ThreadEvent[] = [evt];
  try {
    const res = await vmFetch("/api/vm/sandbox/exec", { method: "POST", body: JSON.stringify({ cmd, cwd }) });
    const data = await res.json();
    if (!data.jobId) { evt.status = "error"; evt.content = data.error || "No job ID"; evt.verification = { verified: true, evidence: evt.content }; return errorResult(evt.content, "run_terminal", events); }
    let output = "", exitCode = -1, attempts = 0;
    while (attempts < 120) {
      await new Promise((r) => setTimeout(r, 1000)); attempts++;
      try {
        const pr = await vmFetch(`/api/vm/sandbox/jobs/${data.jobId}`);
        const pd = await pr.json();
        if (pd.log) output += pd.log;
        if (pd.job?.status !== "running") { exitCode = pd.job?.exitCode ?? -1; break; }
      } catch { /* retry poll */ }
    }
    const ok = exitCode === 0;
    evt.status = ok ? "success" : "error"; evt.content = `Exit ${exitCode}`; evt.data = { cmd, cwd, exitCode, output };
    evt.verification = { verified: true, evidence: `exit ${exitCode}${ok ? " (ok)" : " (fail)"}` };
    events.push(verifyEvt(ok, ok ? "Command verified — exit 0" : `Command failed — exit ${exitCode}`, ok ? `"${cmd}" succeeded.` : `"${cmd}" failed. Check output.`, "run_terminal", evt.verification));
    return { success: ok, summary: evt.content, data: { cmd, cwd, exitCode, output }, verification: evt.verification, panel: "terminal", events };
  } catch (err: any) {
    evt.status = "error"; evt.content = `Exec failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "run_terminal", events);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  RETRIEVAL TOOLS (Phase 3)
// ══════════════════════════════════════════════════════════════════════════

/** Search workspace files by content pattern (grep-like) */
export async function searchWorkspace(query: string, path: string = "/home/agent_lee"): Promise<ToolResult> {
  const evt = createThreadEvent("retrieval", `Searching workspace: "${query}"`, `Scanning ${path} for matches…`, { status: "running", tool: "search_workspace" });
  const events: ThreadEvent[] = [evt];
  try {
    // Use terminal grep as the backend for workspace search
    const grepCmd = `grep -rn --include="*.*" "${query.replace(/"/g, '\\"')}" ${path} 2>/dev/null | head -50`;
    const res = await vmFetch("/api/vm/sandbox/exec", { method: "POST", body: JSON.stringify({ cmd: grepCmd, cwd: path }) });
    const data = await res.json();
    if (!data.jobId) { evt.status = "error"; evt.content = "Search init failed"; evt.verification = { verified: true, evidence: "No job" }; return errorResult(evt.content, "search_workspace", events); }

    let output = "", exitCode = -1, attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 800)); attempts++;
      try {
        const pr = await vmFetch(`/api/vm/sandbox/jobs/${data.jobId}`);
        const pd = await pr.json();
        if (pd.log) output += pd.log;
        if (pd.job?.status !== "running") { exitCode = pd.job?.exitCode ?? -1; break; }
      } catch { /* retry */ }
    }

    const lines = output.trim().split("\n").filter(Boolean);
    const matchCount = lines.length;
    const matches = lines.map((line) => {
      const m = line.match(/^([^:]+):(\d+):(.*)$/);
      return m ? { file: m[1], line: parseInt(m[2]), text: m[3].trim() } : { file: "?", line: 0, text: line };
    });

    evt.status = "success"; evt.content = `${matchCount} match${matchCount !== 1 ? "es" : ""} for "${query}" in workspace`;
    evt.data = { query, path, matches, rawOutput: output };
    evt.verification = { verified: true, evidence: `grep returned ${matchCount} matches, exit ${exitCode}` };
    events.push(verifyEvt(matchCount > 0, matchCount > 0 ? "Workspace search verified" : "No matches found", `${matchCount} results for "${query}"`, "search_workspace", evt.verification));
    return { success: true, summary: evt.content, data: { query, path, matches }, verification: evt.verification, panel: "files", events };
  } catch (err: any) {
    evt.status = "error"; evt.content = `Search failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "search_workspace", events);
  }
}

/** Search agent memory / context store */
export async function searchMemory(query: string): Promise<ToolResult> {
  const evt = createThreadEvent("retrieval", `Memory search: "${query}"`, "Searching agent memory store…", { status: "running", tool: "search_memory" });
  const events: ThreadEvent[] = [evt];
  try {
    // Try MCP memory endpoint first, fall back to local search
    const res = await vmFetch(`/api/vm/vfs/read?path=/home/agent_lee/.memory/index.json`);
    let memories: any[] = [];
    if (res.ok) {
      const data = await res.json();
      if (data.content) {
        try {
          const parsed = JSON.parse(data.content);
          const queryLower = query.toLowerCase();
          memories = (Array.isArray(parsed) ? parsed : parsed.entries || [])
            .filter((m: any) => JSON.stringify(m).toLowerCase().includes(queryLower))
            .slice(0, 20);
        } catch { /* parse error */ }
      }
    }

    evt.status = "success"; evt.content = `${memories.length} memory entries for "${query}"`;
    evt.data = { query, memories };
    evt.verification = { verified: true, evidence: `${memories.length} entries found` };
    events.push(verifyEvt(true, "Memory search complete", `${memories.length} entries matched`, "search_memory", evt.verification));
    return { success: true, summary: evt.content, data: { query, memories }, verification: evt.verification, panel: "files", events };
  } catch (err: any) {
    evt.status = "error"; evt.content = `Memory search failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "search_memory", events);
  }
}

/** Search system or agent logs */
export async function searchLogs(query: string, source: string = "agent"): Promise<ToolResult> {
  const evt = createThreadEvent("retrieval", `Log search: "${query}"`, `Searching ${source} logs…`, { status: "running", tool: "search_logs" });
  const events: ThreadEvent[] = [evt];
  try {
    const logPath = source === "system" ? "/var/log" : "/home/agent_lee/.logs";
    const grepCmd = `grep -rn "${query.replace(/"/g, '\\"')}" ${logPath} 2>/dev/null | tail -30`;
    const res = await vmFetch("/api/vm/sandbox/exec", { method: "POST", body: JSON.stringify({ cmd: grepCmd, cwd: "/" }) });
    const data = await res.json();
    if (!data.jobId) { evt.status = "success"; evt.content = "No logs found (log dir may not exist)"; evt.verification = { verified: true, evidence: "No log directory" }; return { success: true, summary: evt.content, data: { query, entries: [] }, verification: evt.verification, panel: "terminal", events }; }

    let output = "", attempts = 0;
    while (attempts < 20) {
      await new Promise((r) => setTimeout(r, 800)); attempts++;
      try {
        const pr = await vmFetch(`/api/vm/sandbox/jobs/${data.jobId}`);
        const pd = await pr.json();
        if (pd.log) output += pd.log;
        if (pd.job?.status !== "running") break;
      } catch { /* retry */ }
    }

    const entries = output.trim().split("\n").filter(Boolean);
    evt.status = "success"; evt.content = `${entries.length} log entries for "${query}"`;
    evt.data = { query, source, entries };
    evt.verification = { verified: true, evidence: `${entries.length} log entries` };
    events.push(verifyEvt(true, "Log search complete", `${entries.length} entries from ${source} logs`, "search_logs", evt.verification));
    return { success: true, summary: evt.content, data: { query, source, entries }, verification: evt.verification, panel: "terminal", events };
  } catch (err: any) {
    evt.status = "error"; evt.content = `Log search failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "search_logs", events);
  }
}

/** List directory contents */
export async function listDirectory(path: string = "/home/agent_lee"): Promise<ToolResult> {
  const evt = createThreadEvent("retrieval", `Listing: ${path}`, "Inspecting workspace directory…", { status: "running", tool: "list_directory" });
  const events: ThreadEvent[] = [evt];
  try {
    const res = await vmFetch(`/api/vm/vfs?path=${encodeURIComponent(path)}`);
    if (!res.ok) { evt.status = "error"; evt.content = `Dir not found: ${path}`; evt.verification = { verified: true, evidence: `HTTP ${res.status}` }; return errorResult(evt.content, "list_directory", events); }
    const dir = await res.json();
    const children = dir.children || [];
    const summary = children.map((c: any) => `${c.type === "dir" ? "📁" : "📄"} ${c.name}`).join("\n");
    evt.status = "success"; evt.content = `${children.length} items in ${path}\n${summary}`;
    evt.data = { path, dir, children };
    evt.verification = { verified: true, evidence: `${children.length} items found` };
    events.push(verifyEvt(true, "Directory listed", `${children.length} items in ${path}`, "list_directory", evt.verification));
    return { success: true, summary: evt.content, data: { path, dir, children }, verification: evt.verification, panel: "files", events };
  } catch (err: any) {
    evt.status = "error"; evt.content = `List failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "list_directory", events);
  }
}

/** Read and summarize a file's key contents */
export async function summarizeFile(filePath: string): Promise<ToolResult> {
  const evt = createThreadEvent("summarize", `Summarizing: ${filePath}`, "Reading and analyzing file…", { status: "running", tool: "summarize_file" });
  const events: ThreadEvent[] = [evt];
  try {
    const readResult = await readFile(filePath);
    if (!readResult.success) {
      evt.status = "error"; evt.content = `Cannot summarize — ${readResult.summary}`; evt.verification = readResult.verification;
      return errorResult(evt.content, "summarize_file", events);
    }

    const content = readResult.data.content as string;
    const lines = content.split("\n");
    const lineCount = lines.length;
    const charCount = content.length;

    // Generate a structural summary
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    const summaryLines: string[] = [];
    summaryLines.push(`File: ${filePath}`);
    summaryLines.push(`Size: ${charCount} chars, ${lineCount} lines`);
    summaryLines.push(`Type: ${ext || "unknown"}`);

    // Extract key patterns
    if (["ts", "tsx", "js", "jsx"].includes(ext)) {
      const exports = lines.filter((l) => /^export\s/.test(l.trim())).map((l) => l.trim().slice(0, 80));
      const imports = lines.filter((l) => /^import\s/.test(l.trim())).length;
      const functions = lines.filter((l) => /(?:function|const\s+\w+\s*=\s*(?:async\s+)?\()/.test(l)).length;
      summaryLines.push(`Imports: ${imports}`);
      summaryLines.push(`Functions/consts: ${functions}`);
      if (exports.length > 0) summaryLines.push(`Exports (first 5):\n${exports.slice(0, 5).map((e) => `  • ${e}`).join("\n")}`);
    } else if (ext === "json") {
      try {
        const parsed = JSON.parse(content);
        const keys = Object.keys(parsed);
        summaryLines.push(`Top-level keys: ${keys.join(", ")}`);
        if (parsed.name) summaryLines.push(`name: ${parsed.name}`);
        if (parsed.version) summaryLines.push(`version: ${parsed.version}`);
        if (parsed.scripts) summaryLines.push(`scripts: ${Object.keys(parsed.scripts).join(", ")}`);
        if (parsed.dependencies) summaryLines.push(`dependencies: ${Object.keys(parsed.dependencies).length}`);
      } catch { summaryLines.push("(invalid JSON)"); }
    } else {
      // Generic: first 10 and last 5 lines
      summaryLines.push("Preview (first 10 lines):");
      summaryLines.push(...lines.slice(0, 10).map((l) => `  ${l}`));
      if (lineCount > 15) {
        summaryLines.push(`  … (${lineCount - 15} more lines)`);
        summaryLines.push("Last 5 lines:");
        summaryLines.push(...lines.slice(-5).map((l) => `  ${l}`));
      }
    }

    const summaryText = summaryLines.join("\n");
    evt.status = "success"; evt.content = summaryText; evt.data = { path: filePath, summary: summaryText, lineCount, charCount };
    evt.verification = { verified: true, evidence: `Summarized ${lineCount} lines, ${charCount} chars` };
    events.push(verifyEvt(true, "File summarized", `${filePath} — ${lineCount} lines`, "summarize_file", evt.verification));
    return { success: true, summary: summaryText, data: { path: filePath, summary: summaryText, content, lineCount, charCount }, verification: evt.verification, panel: "editor", events };
  } catch (err: any) {
    evt.status = "error"; evt.content = `Summarize failed: ${err.message}`; evt.verification = { verified: true, evidence: err.message }; return errorResult(evt.content, "summarize_file", events);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  STRUCTURED RESEARCH (Phase 3)
// ══════════════════════════════════════════════════════════════════════════

/** Multi-query research workflow: searches + reads + synthesizes */
export async function research(topic: string, queries?: string[]): Promise<ToolResult> {
  const evt = createThreadEvent("research", `Researching: ${topic}`, "Running structured research workflow…", { status: "running", tool: "research" });
  const events: ThreadEvent[] = [evt];

  const searchQueries = queries && queries.length > 0 ? queries : [topic, `${topic} best practices`, `${topic} common issues`];
  const allResults: any[] = [];

  for (const q of searchQueries) {
    const searchResult = await searchWeb(q);
    // Absorb search events but add a research context marker
    for (const se of searchResult.events) {
      se.tool = "research";
      events.push(se);
    }
    if (searchResult.success && searchResult.data?.results) {
      allResults.push(...searchResult.data.results);
    }
  }

  const uniqueResults = allResults.filter((r, i, arr) => arr.findIndex((a) => a.url === r.url) === i).slice(0, 15);

  evt.status = "success"; evt.content = `Research complete: ${uniqueResults.length} unique sources across ${searchQueries.length} queries for "${topic}"`;
  evt.data = { topic, queries: searchQueries, results: uniqueResults, queryCount: searchQueries.length };
  evt.verification = { verified: true, evidence: `${uniqueResults.length} unique sources, ${searchQueries.length} queries` };
  events.push(verifyEvt(uniqueResults.length > 0, "Research verified", `${uniqueResults.length} sources for "${topic}"`, "research", evt.verification));
  return { success: true, summary: evt.content, data: evt.data, verification: evt.verification, panel: "browser", events };
}

// ══════════════════════════════════════════════════════════════════════════
//  LEEWAY SDK TOOLS (Phase 4 — Real Agent Integration)
// ══════════════════════════════════════════════════════════════════════════

/** Run Leeway DoctorAgent — full system health + compliance diagnosis */
export async function leewayDoctor(): Promise<ToolResult> {
  const evt = createThreadEvent("tool_call", "Leeway Doctor", "Running LEEWAY™ system diagnosis…", { status: "running", tool: "leeway_doctor" });
  const events: ThreadEvent[] = [evt];

  const report = await runDoctor();
  if (!report) {
    evt.status = "error";
    evt.content = "Leeway Doctor unavailable — backend API not responding";
    evt.verification = { verified: true, evidence: "Backend offline" };
    events.push(verifyEvt(false, "Doctor unavailable", "Backend API not responding", "leeway_doctor", evt.verification));
    return { success: false, summary: evt.content, data: null, verification: evt.verification, panel: "terminal", events };
  }

  const formatted = formatDoctorReport(report);
  evt.status = report.healthy ? "success" : "error";
  evt.content = `LEEWAY™ Doctor: ${report.summary.status}\n\n${formatted}`;
  evt.data = report;
  evt.verification = { verified: true, evidence: `${report.summary.passed}/${report.summary.totalChecks} checks passed` };

  await logMemoryReceipt({ agent: "leeway_doctor", action: "diagnosis", result: report.summary.status });
  events.push(verifyEvt(report.healthy, "Doctor diagnosis", report.summary.status, "leeway_doctor", evt.verification));
  return { success: true, summary: `LEEWAY™ Doctor: ${report.summary.status}`, data: report, verification: evt.verification, panel: "terminal", events };
}

/** Run Leeway AssessAgent — workspace inventory survey */
export async function leewayAssess(rootDir?: string): Promise<ToolResult> {
  const evt = createThreadEvent("tool_call", "Leeway Assess", "Surveying workspace structure…", { status: "running", tool: "leeway_assess" });
  const events: ThreadEvent[] = [evt];

  const result = await runAssess(rootDir);
  if (!result) {
    evt.status = "error";
    evt.content = "Leeway Assess unavailable";
    evt.verification = { verified: true, evidence: "Backend offline" };
    events.push(verifyEvt(false, "Assess unavailable", "Backend API not responding", "leeway_assess", evt.verification));
    return { success: false, summary: evt.content, data: null, verification: evt.verification, panel: "terminal", events };
  }

  const formatted = formatAssessment(result);
  evt.status = "success";
  evt.content = `Workspace Assessment\n\n${formatted}`;
  evt.data = result;
  evt.verification = { verified: true, evidence: `${result.summary.codeFiles} code files, ${result.summary.headerCoverage} coverage` };

  await logMemoryReceipt({ agent: "leeway_assess", action: "survey", result: result.summary.headerCoverage });
  events.push(verifyEvt(true, "Assessment complete", result.summary.headerCoverage, "leeway_assess", evt.verification));
  return { success: true, summary: `Workspace: ${result.summary.codeFiles} files, ${result.summary.headerCoverage} LEEWAY coverage`, data: result, verification: evt.verification, panel: "terminal", events };
}

/** Run Leeway AuditAgent — compliance scoring */
export async function leewayAudit(rootDir?: string): Promise<ToolResult> {
  const evt = createThreadEvent("tool_call", "Leeway Audit", "Running compliance audit…", { status: "running", tool: "leeway_audit" });
  const events: ThreadEvent[] = [evt];

  const result = await runAudit(rootDir);
  if (!result) {
    evt.status = "error";
    evt.content = "Leeway Audit unavailable";
    evt.verification = { verified: true, evidence: "Backend offline" };
    events.push(verifyEvt(false, "Audit unavailable", "Backend API not responding", "leeway_audit", evt.verification));
    return { success: false, summary: evt.content, data: null, verification: evt.verification, panel: "terminal", events };
  }

  const emoji = getComplianceEmoji(result.summary.averageScore);
  const summary = `${emoji} Compliance: ${result.summary.averageScore}/100 (${result.summary.complianceLevel})`;
  evt.status = "success";
  evt.content = `${summary}\nFiles audited: ${result.summary.fileCount}`;
  evt.data = result;
  evt.verification = { verified: true, evidence: `Score: ${result.summary.averageScore}/100` };

  await logMemoryReceipt({ agent: "leeway_audit", action: "audit", result: summary });
  events.push(verifyEvt(true, "Audit complete", summary, "leeway_audit", evt.verification));
  return { success: true, summary, data: result, verification: evt.verification, panel: "terminal", events };
}

/** Run Leeway ExplainAgent — explain a file */
export async function leewayExplain(filePath: string): Promise<ToolResult> {
  const evt = createThreadEvent("tool_call", "Leeway Explain", `Explaining: ${filePath}`, { status: "running", tool: "leeway_explain" });
  const events: ThreadEvent[] = [evt];

  const result = await explainFile(filePath);
  if (!result) {
    evt.status = "error";
    evt.content = "Leeway Explain unavailable";
    evt.verification = { verified: true, evidence: "Backend offline" };
    return { success: false, summary: evt.content, data: null, verification: evt.verification, panel: "editor", events };
  }

  evt.status = "success";
  evt.content = result.explanation;
  evt.data = result;
  evt.verification = { verified: true, evidence: result.hasHeader ? `LEEWAY header found (${result.region})` : "No LEEWAY header" };

  return { success: true, summary: result.explanation, data: result, verification: evt.verification, panel: "editor", events };
}

/** Run Leeway RouterAgent — route a task to the right agent */
export async function leewayRoute(task: string): Promise<ToolResult> {
  const evt = createThreadEvent("tool_call", "Leeway Router", `Routing: ${task.slice(0, 60)}`, { status: "running", tool: "leeway_route" });
  const events: ThreadEvent[] = [evt];

  const result = await routeTask(task);
  if (!result) {
    evt.status = "error";
    evt.content = "Leeway Router unavailable";
    evt.verification = { verified: true, evidence: "Backend offline" };
    return { success: false, summary: evt.content, data: null, verification: evt.verification, panel: "none", events };
  }

  evt.status = result.routed ? "success" : "error";
  evt.content = result.routed ? `Routed to ${result.agent}: ${JSON.stringify(result.result).slice(0, 200)}` : `No route matched: ${result.reason}`;
  evt.data = result;
  evt.verification = { verified: result.routed ?? false, evidence: result.routed ? `Agent: ${result.agent}` : "No match" };

  return { success: result.routed ?? false, summary: evt.content, data: result, verification: evt.verification, panel: "none", events };
}

/** Run Leeway HealthAgentLite — lightweight system check */
export async function leewayHealth(): Promise<ToolResult> {
  const evt = createThreadEvent("tool_call", "Leeway Health", "Running system health check…", { status: "running", tool: "leeway_health" });
  const events: ThreadEvent[] = [evt];

  const result = await runHealthCheck();
  if (!result) {
    evt.status = "error";
    evt.content = "Leeway Health unavailable";
    evt.verification = { verified: true, evidence: "Backend offline" };
    return { success: false, summary: evt.content, data: null, verification: evt.verification, panel: "terminal", events };
  }

  evt.status = result.healthy ? "success" : "error";
  evt.content = `System Health: ${result.healthy ? "✅ Healthy" : "⚠️ Issues detected"}\n${result.summary}`;
  evt.data = result;
  evt.verification = { verified: true, evidence: result.healthy ? "All checks passed" : "Some checks failed" };

  return { success: result.healthy, summary: `Health: ${result.healthy ? "Healthy" : "Issues"}`, data: result, verification: evt.verification, panel: "terminal", events };
}


// ══════════════════════════════════════════════════════════════════════════
//  DEVICE ACTIONS & MCP
// ══════════════════════════════════════════════════════════════════════════

/** All device action names for routing */
const DEVICE_ACTIONS: Set<string> = new Set([
  "open_app", "launch_intent", "inspect_device_state", "inspect_bluetooth",
  "open_system_panel", "verify_action",
  // Phase 4
  "open_phone_dialer", "open_calendar", "open_maps", "open_messages",
  "open_email", "open_settings_panel", "inspect_battery", "inspect_network",
]);

/** Determine if an action is phone-specific */
function isPhoneAction(action: string): boolean {
  return ["open_phone_dialer", "open_messages", "open_calendar", "open_maps", "open_email"].includes(action);
}

/** Determine if an action is a diagnostic */
function isDiagnosticAction(action: string): boolean {
  return ["inspect_device_state", "inspect_bluetooth", "inspect_battery", "inspect_network"].includes(action);
}

export async function deviceAction(action: string, params: Record<string, any>): Promise<ToolResult> {
  const toolName = action as ToolName;
  const eventType = isPhoneAction(action) ? "phone_action" : isDiagnosticAction(action) ? "diagnostic" : "device";
  const evt = createThreadEvent(eventType as any, `Device: ${action}`, `Executing device action: ${action}`, { status: "running", tool: toolName });
  const events: ThreadEvent[] = [evt];

  // Use real device bridge (Phase 4)
  const result = await realDeviceBridge(action as DeviceActionName, params);

  evt.status = result.success ? "success" : "error";
  evt.content = result.summary;
  evt.data = { action, params, result, stub: result.stub, verified: result.verified };
  evt.verification = {
    verified: result.verified ?? false,
    evidence: result.verificationEvidence || (result.stub ? "Stub — action NOT performed" : "Completed"),
  };

  // If stub: clearly mark as unverified
  if (result.stub) {
    events.push(createThreadEvent("narration", "Device bridge",
      `⚠️ ${result.summary}\n(No backend available: MCP, companion, URL scheme, and Web API all tried)`,
      { status: "error", tool: toolName }));
  }

  // Verification event from deviceBridge module
  events.push(buildDeviceVerificationEvent(result, toolName));

  return {
    success: result.success,
    summary: result.summary,
    data: result,
    verification: evt.verification,
    panel: TOOL_TO_PANEL[toolName] || "none",
    events,
  };
}

/** Try to route a tool call through MCP agents first */
export async function tryMCPRoute(tool: ToolName, params: Record<string, any>): Promise<ToolResult | null> {
  if (!MCP_ELIGIBLE.has(tool)) return null;

  try {
    const res = await fetch("/api/mcp/invoke", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-neural-handshake": HANDSHAKE },
      body: JSON.stringify({ tool, params }),
    });
    if (!res.ok) return null;

    const data = await res.json();
    if (!data.result) return null;

    const evt = createThreadEvent("mcp_invoke", `MCP: ${tool}`, `Routed through MCP agent`, {
      status: data.result.success ? "success" : "error",
      tool,
      agent: data.agent || "mcp",
      data: data.result,
    });
    evt.verification = { verified: true, evidence: `MCP-routed via ${data.agent || "mcp"}` };

    return {
      success: data.result.success ?? true,
      summary: data.result.summary || `MCP ${tool} complete`,
      data: data.result.data || data.result,
      verification: evt.verification,
      panel: TOOL_TO_PANEL[tool],
      events: [evt],
      mcpRouted: true,
    };
  } catch {
    return null; // MCP not available, fall through
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  MASTER DISPATCHER
// ══════════════════════════════════════════════════════════════════════════

export async function dispatchTool(
  tool: ToolName,
  params: Record<string, any>,
  options?: { skipMCP?: boolean },
): Promise<ToolResult> {
  // 0. Log every dispatched tool to Leeway memory for audit trail
  logMemoryReceipt({ agent: "tool-dispatcher", action: tool, target: JSON.stringify(params).slice(0, 100) }).catch(() => {});

  // 1. Try MCP routing first for eligible tools
  if (!options?.skipMCP && MCP_ELIGIBLE.has(tool)) {
    const mcpResult = await tryMCPRoute(tool, params);
    if (mcpResult) return mcpResult;
  }

  // 2. Fall through to local implementation
  switch (tool) {
    // Core
    case "search_web":
      return searchWeb(params.query || params.q || "");
    case "read_file":
      return readFile(params.path || params.filePath || "");
    case "write_file":
      return writeFile(params.path || params.filePath || "", params.content || "");
    case "run_terminal":
      return runTerminal(params.cmd || params.command || "", params.cwd || "/home/agent_lee", params.reason);
    // Retrieval
    case "search_workspace":
      return searchWorkspace(params.query || params.q || "", params.path || "/home/agent_lee");
    case "search_memory":
      return searchMemory(params.query || params.q || "");
    case "search_logs":
      return searchLogs(params.query || params.q || "", params.source || "agent");
    case "list_directory":
      return listDirectory(params.path || "/home/agent_lee");
    case "summarize_file":
      return summarizeFile(params.path || params.filePath || "");
    // Research
    case "research":
      return research(params.topic || params.query || "", params.queries);
    // Leeway SDK
    case "leeway_doctor":
      return leewayDoctor();
    case "leeway_assess":
      return leewayAssess(params.rootDir);
    case "leeway_audit":
      return leewayAudit(params.rootDir);
    case "leeway_explain":
      return leewayExplain(params.filePath || params.path || "");
    case "leeway_route":
      return leewayRoute(params.task || params.query || "");
    case "leeway_health":
      return leewayHealth();
    default:
      // Device bridge (all 13 actions)
      if (DEVICE_ACTIONS.has(tool)) {
        return deviceAction(tool, params);
      }
      return {
        success: false,
        summary: `Unknown tool: ${tool}`,
        data: null,
        verification: { verified: true, evidence: "Tool not recognized" },
        panel: "none",
        events: [createThreadEvent("error", `Unknown tool: ${tool}`, `Tool "${tool}" is not available.`, { status: "error" })],
      };
  }
}


