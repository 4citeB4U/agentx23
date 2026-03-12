/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.DIGITALLIFE
LICENSE: MIT

PURPOSE: Phase 4 digital-life operator flows.
         Multi-step workflows for personal operations:
         - Scheduling (create/check events)
         - Trip planning (directions, routes, transit)
         - Product/price comparison (web research)
         - Day/task planning (daily agenda)
         - Device diagnostics (battery, network, bluetooth, system)
         Each flow generates a structured plan and returns
         tool actions for the controller to execute.
*/

import { ToolName, MCP_ELIGIBLE } from "./toolDispatcher";

// ══════════════════════════════════════════════════════════════════════════
//  FLOW TYPES
// ══════════════════════════════════════════════════════════════════════════

export type DigitalLifeFlowType =
  | "scheduling"
  | "trip_planning"
  | "price_comparison"
  | "day_planning"
  | "device_diagnostics"
  | "communication"
  | "reminder"
  | "quick_action";

export interface DigitalLifeAction {
  tool: ToolName;
  params: Record<string, any>;
  title: string;
  description: string;
  maxRetries: number;
  mcpEligible: boolean;
}

export interface DigitalLifePlan {
  flowType: DigitalLifeFlowType;
  summary: string;
  actions: DigitalLifeAction[];
  requiresApproval: boolean;
  estimatedMinutes: number;
}

// ── Helper ─────────────────────────────────────────────────────────────────
function act(
  tool: ToolName,
  params: Record<string, any>,
  title: string,
  description: string,
  maxRetries = 0,
): DigitalLifeAction {
  return { tool, params, title, description, maxRetries, mcpEligible: MCP_ELIGIBLE.has(tool) };
}

// ══════════════════════════════════════════════════════════════════════════
//  SCHEDULING FLOW
// ══════════════════════════════════════════════════════════════════════════

export function planScheduling(params: {
  action: "create" | "check" | "list";
  title?: string;
  date?: string;
  time?: string;
  duration?: string;
  location?: string;
}): DigitalLifePlan {
  const actions: DigitalLifeAction[] = [];

  if (params.action === "create" && params.title) {
    // Build event details
    const eventDetails = [
      `Event: ${params.title}`,
      params.date ? `Date: ${params.date}` : "",
      params.time ? `Time: ${params.time}` : "",
      params.duration ? `Duration: ${params.duration}` : "",
      params.location ? `Location: ${params.location}` : "",
    ].filter(Boolean).join("\n");

    actions.push(act("open_calendar" as ToolName, {
      title: params.title,
      date: params.date,
      time: params.time,
      duration: params.duration,
      location: params.location,
    }, `Create calendar event: ${params.title}`, eventDetails));

    if (params.location) {
      actions.push(act("open_maps" as ToolName, {
        query: params.location,
      }, `Look up location: ${params.location}`, `Finding "${params.location}" on maps`));
    }

    actions.push(act("run_terminal", {
      cmd: `echo "✅ Event scheduled: ${params.title}${params.date ? ` on ${params.date}` : ""}${params.time ? ` at ${params.time}` : ""}"`,
      reason: "Confirming event creation",
    }, "Confirm scheduling", "Verification and confirmation"));

    return {
      flowType: "scheduling",
      summary: `Schedule "${params.title}"${params.date ? ` on ${params.date}` : ""}`,
      actions,
      requiresApproval: true,
      estimatedMinutes: 1,
    };
  }

  // Check/list calendar
  actions.push(act("search_web", {
    query: `calendar events ${params.date || "today"} schedule`,
  }, `Check calendar: ${params.date || "today"}`, "Looking up your schedule"));

  actions.push(act("run_terminal", {
    cmd: `echo "📅 Calendar check for ${params.date || "today"} — see results above"`,
    reason: "Calendar summary",
  }, "Calendar summary", "Summarizing schedule results"));

  return {
    flowType: "scheduling",
    summary: `Check calendar for ${params.date || "today"}`,
    actions,
    requiresApproval: false,
    estimatedMinutes: 1,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  TRIP PLANNING FLOW
// ══════════════════════════════════════════════════════════════════════════

export function planTrip(params: {
  origin?: string;
  destination: string;
  mode?: "driving" | "transit" | "walking" | "cycling";
  date?: string;
}): DigitalLifePlan {
  const actions: DigitalLifeAction[] = [];
  const mode = params.mode || "driving";

  // Step 1: Research destination
  actions.push(act("research", {
    topic: `${params.destination} travel guide directions`,
    queries: [
      `directions to ${params.destination} ${mode}`,
      `${params.destination} best route ${mode}`,
      params.date ? `${params.destination} weather ${params.date}` : `${params.destination} current conditions`,
    ],
  }, `Research: ${params.destination}`, `Gathering travel info for ${params.destination}`));

  // Step 2: Open maps with directions
  actions.push(act("open_maps" as ToolName, {
    destination: params.destination,
    origin: params.origin,
    mode,
  }, `Directions to ${params.destination}`, `Opening maps with ${mode} directions`));

  // Step 3: Check weather
  actions.push(act("search_web", {
    query: `weather ${params.destination} ${params.date || "today"}`,
  }, `Weather: ${params.destination}`, "Checking weather conditions"));

  // Step 4: Summary
  actions.push(act("run_terminal", {
    cmd: `echo "🗺️ Trip plan to ${params.destination} via ${mode}\n${params.origin ? `From: ${params.origin}\n` : ""}${params.date ? `Date: ${params.date}\n` : ""}See research and map results above."`,
    reason: "Trip summary",
  }, "Trip summary", "Compiling trip plan"));

  return {
    flowType: "trip_planning",
    summary: `Plan trip to ${params.destination} (${mode})`,
    actions,
    requiresApproval: false,
    estimatedMinutes: 3,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  PRICE / PRODUCT COMPARISON FLOW
// ══════════════════════════════════════════════════════════════════════════

export function planPriceComparison(params: {
  product: string;
  budget?: string;
  category?: string;
}): DigitalLifePlan {
  const actions: DigitalLifeAction[] = [];

  // Step 1: Multi-query research
  const queries = [
    `${params.product} price comparison ${new Date().getFullYear()}`,
    `${params.product} best deal reviews`,
    `${params.product} vs alternatives ${params.category || ""}`.trim(),
  ];
  if (params.budget) {
    queries.push(`${params.product} under ${params.budget}`);
  }

  actions.push(act("research", {
    topic: `${params.product} price comparison`,
    queries,
  }, `Research: ${params.product}`, "Comparing prices across multiple sources"));

  // Step 2: Specific retailer searches
  actions.push(act("search_web", {
    query: `${params.product} price Amazon Best Buy Walmart`,
  }, `Retailer prices: ${params.product}`, "Checking major retailers"));

  // Step 3: Reviews
  actions.push(act("search_web", {
    query: `${params.product} review rating ${new Date().getFullYear()}`,
  }, `Reviews: ${params.product}`, "Looking up latest reviews and ratings"));

  // Step 4: Build comparison report
  actions.push(act("write_file", {
    path: `/home/agent_lee/output/comparison_${params.product.replace(/\s+/g, "_").toLowerCase()}.md`,
    content: `# Product Comparison: ${params.product}\n\nGenerated: ${new Date().toISOString()}\nBudget: ${params.budget || "Not specified"}\n\n## Sources\n- See research results in thread\n\n## Recommendation\n- Pending analysis of search results\n`,
  }, `Create comparison report`, "Saving comparison results to workspace"));

  // Step 5: Summary
  actions.push(act("run_terminal", {
    cmd: `echo "🛒 Price comparison for ${params.product}\n${params.budget ? `Budget: ${params.budget}\n` : ""}Report saved to output/comparison_${params.product.replace(/\s+/g, "_").toLowerCase()}.md"`,
    reason: "Comparison summary",
  }, "Comparison summary", "Final comparison report"));

  return {
    flowType: "price_comparison",
    summary: `Compare prices: ${params.product}${params.budget ? ` (budget: ${params.budget})` : ""}`,
    actions,
    requiresApproval: false,
    estimatedMinutes: 4,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  DAY / TASK PLANNING FLOW
// ══════════════════════════════════════════════════════════════════════════

export function planDay(params: {
  date?: string;
  tasks?: string[];
  priorities?: string[];
}): DigitalLifePlan {
  const actions: DigitalLifeAction[] = [];
  const dateStr = params.date || new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  // Step 1: Check device state for context
  actions.push(act("inspect_device_state" as ToolName, {},
    "Check device status", "Getting current device context"));

  // Step 2: Check network
  actions.push(act("inspect_network" as ToolName, {},
    "Check connectivity", "Verifying network status"));

  // Step 3: Check calendar
  actions.push(act("search_web", {
    query: `what day is ${params.date || "today"} events schedule`,
  }, `Check agenda: ${dateStr}`, "Looking up today's schedule"));

  // Step 4: Check weather
  actions.push(act("search_web", {
    query: `weather today ${dateStr}`,
  }, `Weather: ${dateStr}`, "Checking weather for planning"));

  // Step 5: Build daily plan
  const tasksList = params.tasks && params.tasks.length > 0
    ? params.tasks.map((t, i) => `${i + 1}. ${t}`).join("\n")
    : "No specific tasks listed - check calendar results above";

  const prioritiesList = params.priorities && params.priorities.length > 0
    ? params.priorities.map((p) => `⭐ ${p}`).join("\n")
    : "";

  actions.push(act("write_file", {
    path: `/home/agent_lee/output/daily_plan_${new Date().toISOString().split("T")[0]}.md`,
    content: `# Daily Plan: ${dateStr}\n\nGenerated: ${new Date().toISOString()}\n\n## Tasks\n${tasksList}\n\n${prioritiesList ? `## Priorities\n${prioritiesList}\n\n` : ""}## Notes\n- See weather and calendar results in thread\n- Device and connectivity status checked\n`,
  }, "Create daily plan", "Saving daily plan to workspace"));

  // Step 6: Summary
  actions.push(act("run_terminal", {
    cmd: `echo "📋 Daily plan for ${dateStr}\n${params.tasks ? `${params.tasks.length} task(s) planned\n` : ""}Plan saved to output/"`,
    reason: "Day planning complete",
  }, "Plan summary", "Daily plan ready"));

  return {
    flowType: "day_planning",
    summary: `Plan day: ${dateStr}`,
    actions,
    requiresApproval: false,
    estimatedMinutes: 2,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  DEVICE DIAGNOSTICS FLOW
// ══════════════════════════════════════════════════════════════════════════

export function planDeviceDiagnostics(params: {
  area?: "full" | "battery" | "network" | "bluetooth" | "storage" | "performance";
}): DigitalLifePlan {
  const actions: DigitalLifeAction[] = [];
  const area = params.area || "full";

  // Always start with device state
  actions.push(act("inspect_device_state" as ToolName, {},
    "Full device inspection", "Collecting comprehensive device information"));

  if (area === "full" || area === "battery") {
    actions.push(act("inspect_battery" as ToolName, {},
      "Battery diagnostics", "Checking battery level, charge state, and health"));
  }

  if (area === "full" || area === "network") {
    actions.push(act("inspect_network" as ToolName, {},
      "Network diagnostics", "Checking connectivity, type, speed"));
  }

  if (area === "full" || area === "bluetooth") {
    actions.push(act("inspect_bluetooth" as ToolName, {},
      "Bluetooth diagnostics", "Checking Bluetooth availability and status"));
  }

  if (area === "full" || area === "storage") {
    actions.push(act("list_directory", { path: "/home/agent_lee" },
      "Check workspace storage", "Listing workspace files and sizes"));
  }

  if (area === "full" || area === "performance") {
    actions.push(act("run_terminal", {
      cmd: "echo 'Memory:' && free -h 2>/dev/null || echo 'N/A' && echo 'Uptime:' && uptime 2>/dev/null || echo 'N/A'",
      reason: "Performance check",
    }, "Performance check", "Checking system performance metrics"));
  }

  // Diagnostic report
  actions.push(act("write_file", {
    path: `/home/agent_lee/output/diagnostics_${new Date().toISOString().split("T")[0]}.md`,
    content: `# Device Diagnostics Report\n\nGenerated: ${new Date().toISOString()}\nArea: ${area}\n\n## Results\n- See diagnostic results in thread above\n- Each check includes verification evidence\n`,
  }, "Save diagnostics report", "Writing diagnostics to workspace"));

  actions.push(act("run_terminal", {
    cmd: `echo "🔧 Diagnostics complete (${area})\nReport saved to output/diagnostics_${new Date().toISOString().split("T")[0]}.md"`,
    reason: "Diagnostics summary",
  }, "Diagnostics summary", "Summarizing diagnostic results"));

  return {
    flowType: "device_diagnostics",
    summary: `Device diagnostics: ${area}`,
    actions,
    requiresApproval: false,
    estimatedMinutes: area === "full" ? 3 : 1,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  COMMUNICATION FLOW
// ══════════════════════════════════════════════════════════════════════════

export function planCommunication(params: {
  type: "call" | "text" | "email";
  to?: string;
  subject?: string;
  body?: string;
}): DigitalLifePlan {
  const actions: DigitalLifeAction[] = [];

  switch (params.type) {
    case "call":
      actions.push(act("open_phone_dialer" as ToolName, {
        number: params.to,
      }, `Call: ${params.to || "open dialer"}`, "Opening phone dialer"));
      break;

    case "text":
      actions.push(act("open_messages" as ToolName, {
        number: params.to,
        body: params.body,
      }, `Text: ${params.to || "open messages"}`, "Opening messaging app"));
      break;

    case "email":
      actions.push(act("open_email" as ToolName, {
        to: params.to,
        subject: params.subject,
        body: params.body,
      }, `Email: ${params.to || "open email"}`, "Opening email client"));
      break;
  }

  // Verification step
  actions.push(act("verify_action" as ToolName, {
    description: `${params.type} action to ${params.to || "unknown"}`,
  }, `Verify ${params.type}`, "Confirming action was initiated"));

  return {
    flowType: "communication",
    summary: `${params.type}: ${params.to || "open app"}`,
    actions,
    requiresApproval: params.type === "call",
    estimatedMinutes: 1,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  GOAL → DIGITAL LIFE FLOW DETECTOR
// ══════════════════════════════════════════════════════════════════════════

/** Attempt to detect a digital-life flow from a natural language goal */
export function detectDigitalLifeFlow(goal: string): DigitalLifePlan | null {
  const gl = goal.toLowerCase();

  // ── Scheduling patterns ──────────────────────────────────────────────
  const scheduleCreate = gl.match(
    /(?:schedule|create\s+(?:an?\s+)?event|add\s+(?:to\s+)?(?:my\s+)?calendar|book|plan\s+(?:a\s+)?meeting)\s+(?:for\s+|about\s+|called\s+)?["`']?(.+?)(?:["`']?\s*(?:on|at|for)\s+(.+))?$/i,
  );
  if (scheduleCreate) {
    const title = scheduleCreate[1]?.trim() || goal;
    const dateTime = scheduleCreate[2]?.trim();
    const datePart = dateTime?.match(/^([\w\s,]+?)(?:\s+at\s+(.+))?$/i);
    return planScheduling({
      action: "create",
      title,
      date: datePart?.[1] || dateTime,
      time: datePart?.[2],
    });
  }

  if (/(?:check|show|what'?s)\s+(?:my\s+)?(?:calendar|schedule|agenda)/i.test(gl)) {
    const dateMatch = gl.match(/(?:for|on)\s+(\w+)/i);
    return planScheduling({ action: "check", date: dateMatch?.[1] });
  }

  // ── Trip planning patterns ───────────────────────────────────────────
  const tripMatch = gl.match(
    /(?:directions?\s+to|navigate\s+to|how\s+(?:do\s+I\s+)?get\s+to|trip\s+to|route\s+to|plan\s+(?:a\s+)?trip\s+to)\s+(.+)/i,
  );
  if (tripMatch) {
    const dest = tripMatch[1].trim();
    const modeMatch = gl.match(/(?:by\s+|via\s+)(driving|transit|walking|cycling|car|bus|train|foot|bike)/i);
    let mode: "driving" | "transit" | "walking" | "cycling" = "driving";
    if (modeMatch) {
      const m = modeMatch[1].toLowerCase();
      mode = m === "car" ? "driving" : m === "bus" || m === "train" ? "transit" : m === "foot" ? "walking" : m === "bike" ? "cycling" : m as any;
    }
    return planTrip({ destination: dest, mode });
  }

  // ── Price comparison patterns ────────────────────────────────────────
  const priceMatch = gl.match(
    /(?:compare\s+(?:prices?|costs?)\s+(?:for|of)|price\s+(?:check|comparison)\s+(?:for|on)?|find\s+(?:the\s+)?best\s+(?:price|deal)\s+(?:for|on)?|how\s+much\s+(?:does?|is)\s+(?:a\s+)?)\s*(.+?)(?:\s+under\s+(.+))?$/i,
  );
  if (priceMatch) {
    return planPriceComparison({
      product: priceMatch[1].trim(),
      budget: priceMatch[2]?.trim(),
    });
  }
  if (/(?:shop(?:ping)?\s+for|buy\s+(?:a\s+)?|purchase)\s+(.+)/i.test(gl)) {
    const prodMatch = gl.match(/(?:shop(?:ping)?\s+for|buy\s+(?:a\s+)?|purchase)\s+(.+)/i);
    if (prodMatch) return planPriceComparison({ product: prodMatch[1].trim() });
  }

  // ── Day planning patterns ────────────────────────────────────────────
  if (/(?:plan\s+(?:my\s+)?day|daily\s+plan|what\s+should\s+i\s+do\s+today|today'?s\s+plan|morning\s+briefing|daily\s+briefing)/i.test(gl)) {
    return planDay({});
  }

  // ── Device diagnostics patterns ──────────────────────────────────────
  if (!gl.includes("leeway") && /(?:diagnos(?:e|tics)|check\s+(?:my\s+)?(?:device|phone|system)|device\s+health|system\s+check|run\s+diagnostics)/i.test(gl)) {
    let area: "full" | "battery" | "network" | "bluetooth" | "storage" | "performance" = "full";
    if (/battery/i.test(gl)) area = "battery";
    else if (/network|wifi|connect/i.test(gl)) area = "network";
    else if (/bluetooth|bt/i.test(gl)) area = "bluetooth";
    else if (/storage|disk|space/i.test(gl)) area = "storage";
    else if (/performance|speed|lag/i.test(gl)) area = "performance";
    return planDeviceDiagnostics({ area });
  }

  // ── Communication patterns ───────────────────────────────────────────
  const callMatch = gl.match(/(?:call|dial|phone)\s+(.+)/i);
  if (callMatch) {
    return planCommunication({ type: "call", to: callMatch[1].trim() });
  }

  const textMatch = gl.match(/(?:text|message|sms)\s+(.+?)(?:\s+saying\s+(.+))?$/i);
  if (textMatch) {
    return planCommunication({ type: "text", to: textMatch[1].trim(), body: textMatch[2]?.trim() });
  }

  const emailMatch = gl.match(/(?:email|mail)\s+(.+?)(?:\s+(?:about|subject)\s+(.+))?$/i);
  if (emailMatch) {
    return planCommunication({ type: "email", to: emailMatch[1].trim(), subject: emailMatch[2]?.trim() });
  }

  return null; // Not a digital life flow
}
