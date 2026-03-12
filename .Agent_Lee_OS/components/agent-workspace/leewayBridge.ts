/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI.ORCHESTRATION.AGENTWORKSPACE
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.LEEWAYBRIDGE

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=layers

5WH:
WHAT = Leeway SDK integration bridge for Agent Lee Workspace
WHY = Agent Lee must use the Leeway SDK for governance, routing,
      compliance, diagnostics, memory, and security — not just stub tools
WHO = LEEWAY / Agent Lee OS
WHERE = .Agent_Lee_OS/components/agent-workspace/leewayBridge.ts
WHEN = 2026
HOW = Wraps leeway-sdk agents into callable async functions for the
      tool dispatcher and controller. Provides workspace-safe wrappers
      around RouterAgent, DoctorAgent, AssessAgent, AuditAgent,
      MemoryAgentLite, ExplainAgent, HealthAgentLite, and compliance-scorer.

AGENTS:
ROUTER
DOCTOR
ASSESS
AUDIT
MEMORY
EXPLAIN
HEALTH

LICENSE:
MIT
*/

// ══════════════════════════════════════════════════════════════════════════
//  LEEWAY SDK BRIDGE
//
//  This module wraps the leeway-sdk Node.js agents for use in the
//  Agent Lee Workspace frontend. Since some agents rely on Node.js
//  fs/process APIs, we provide:
//
//  1. Direct import paths for isomorphic-safe operations
//  2. Backend API routes for agents that need server-side execution
//  3. Fallback stubs when neither is available
//
//  The workspace can call these from the tool dispatcher or controller.
// ══════════════════════════════════════════════════════════════════════════

// ── API Helper ─────────────────────────────────────────────────────────────
const HANDSHAKE =
  (import.meta as any)?.env?.VITE_NEURAL_HANDSHAKE ||
  localStorage.getItem("AGENT_LEE_KEY") ||
  "AGENT_LEE_SOVEREIGN_V1";

const leewaySafeRequire = async (path: string) => {
  try {
    return await import(/* @vite-ignore */ path);
  } catch {
    return null;
  }
};

// ── Types ──────────────────────────────────────────────────────────────────

export interface LeewayDiagnosisReport {
  agent: string;
  rootDir: string;
  timestamp: string;
  checks: Record<string, { status: string; score?: number; level?: string; issues?: string[]; missing?: string[]; summary?: string; error?: string }>;
  summary: { totalChecks: number; passed: number; warnings: number; failed: number; status: string };
  healthy: boolean;
  durationMs: number;
}

export interface LeewayAssessment {
  agent: string;
  rootDir: string;
  durationMs: number;
  inventory: {
    totalFiles: number;
    codeFiles: number;
    filesWithHeaders: number;
    filesWithoutHeaders: string[];
    regionMap: Record<string, number>;
    tagMap: Record<string, string[]>;
    duplicateTags: Array<{ tag: string; files: string[] }>;
    missingHeaders: string[];
  };
  summary: {
    headerCoverage: string;
    codeFiles: number;
    totalFiles: number;
    filesNeedingHeaders: number;
    duplicateTagCount: number;
    regionsFound: number;
  };
}

export interface LeewayComplianceResult {
  score: number;
  level: string;
  breakdown: Record<string, number>;
  issues: string[];
}

export interface LeewayExplanation {
  file: string;
  hasHeader: boolean;
  explanation: string;
  region?: string;
  tag?: string;
  fiveWH?: Record<string, string>;
}

export interface LeewayRouterResult {
  routed: boolean;
  agent?: string;
  result?: any;
  reason?: string;
  error?: string;
}

export interface LeewayMemoryReceipt {
  agent: string;
  action: string;
  target?: string;
  result?: string;
  timestamp: string;
}

// ── Compliance Levels (mirrored from SDK) ──────────────────────────────────
export const COMPLIANCE_LEVELS = {
  PLATINUM: { min: 95, label: "Platinum", emoji: "🥇", description: "Fully LEEWAY-compliant" },
  GOLD: { min: 80, label: "Gold", emoji: "🥈", description: "Mostly compliant, minor gaps" },
  SILVER: { min: 60, label: "Silver", emoji: "🥉", description: "Partially compliant" },
  BRONZE: { min: 40, label: "Bronze", emoji: "🔶", description: "Minimal compliance" },
  NONE: { min: 0, label: "None", emoji: "❌", description: "Not LEEWAY-compliant" },
};

export function getComplianceEmoji(score: number): string {
  if (score >= 95) return "🥇";
  if (score >= 80) return "🥈";
  if (score >= 60) return "🥉";
  if (score >= 40) return "🔶";
  return "❌";
}

// ══════════════════════════════════════════════════════════════════════════
//  BACKEND-ROUTED AGENT CALLS
//  These call our backend API which has access to Node.js + leeway-sdk
// ══════════════════════════════════════════════════════════════════════════

const leewayFetch = async (endpoint: string, body: Record<string, any> = {}): Promise<any> => {
  try {
    const res = await fetch(`/api/leeway/${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-neural-handshake": HANDSHAKE,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`Leeway API ${endpoint}: ${res.status}`);
    return await res.json();
  } catch (err: any) {
    console.warn(`[LeewayBridge] ${endpoint} failed:`, err.message);
    return null;
  }
};

// ══════════════════════════════════════════════════════════════════════════
//  DOCTOR — Full System Diagnosis
// ══════════════════════════════════════════════════════════════════════════

/**
 * Run the Leeway DoctorAgent — full health + compliance diagnosis.
 * Routes through backend API for Node.js access.
 */
export async function runDoctor(rootDir?: string): Promise<LeewayDiagnosisReport | null> {
  return leewayFetch("doctor", { rootDir: rootDir || "." });
}

/**
 * Format a diagnosis report as human-readable text.
 */
export function formatDoctorReport(report: LeewayDiagnosisReport): string {
  const lines = [
    "═══════════════════════════════════════════════",
    "          LEEWAY™ SYSTEM DOCTOR REPORT         ",
    "═══════════════════════════════════════════════",
    `Status    : ${report.summary.status}`,
    `Timestamp : ${report.timestamp}`,
    `Duration  : ${report.durationMs}ms`,
    "",
    "── CHECKS ──────────────────────────────────────",
  ];
  for (const [name, check] of Object.entries(report.checks)) {
    const icon = check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌";
    lines.push(`${icon} ${name.padEnd(15)} [${check.status.toUpperCase()}]`);
    if (check.issues?.length) lines.push(`   Issues: ${check.issues.slice(0, 3).join(", ")}`);
    if (check.missing?.length) lines.push(`   Missing env: ${check.missing.join(", ")}`);
    if (check.score !== undefined) lines.push(`   Score: ${check.score}/100 (${check.level})`);
  }
  lines.push("═══════════════════════════════════════════════");
  return lines.join("\n");
}

// ══════════════════════════════════════════════════════════════════════════
//  ASSESS — Workspace Inventory Survey
// ══════════════════════════════════════════════════════════════════════════

/**
 * Run the Leeway AssessAgent — survey workspace structure and compliance coverage.
 */
export async function runAssess(rootDir?: string): Promise<LeewayAssessment | null> {
  return leewayFetch("assess", { rootDir: rootDir || "." });
}

/**
 * Format an assessment result as readable text.
 */
export function formatAssessment(result: LeewayAssessment): string {
  const s = result.summary;
  return [
    "── LEEWAY WORKSPACE ASSESSMENT ──────────────────",
    `Total Files     : ${s.totalFiles}`,
    `Code Files      : ${s.codeFiles}`,
    `Header Coverage : ${s.headerCoverage}`,
    `Needs Headers   : ${s.filesNeedingHeaders}`,
    `Duplicate Tags  : ${s.duplicateTagCount}`,
    `Regions Found   : ${s.regionsFound}`,
    `Duration        : ${result.durationMs}ms`,
    "─────────────────────────────────────────────────",
  ].join("\n");
}

// ══════════════════════════════════════════════════════════════════════════
//  AUDIT — Compliance Scoring
// ══════════════════════════════════════════════════════════════════════════

/**
 * Run the Leeway AuditAgent — score compliance across the workspace.
 */
export async function runAudit(rootDir?: string): Promise<{ summary: { averageScore: number; complianceLevel: string; fileCount: number }; files: Array<{ file: string; score: number; level: string }> } | null> {
  return leewayFetch("audit", { rootDir: rootDir || "." });
}

/**
 * Score compliance for a single file content (can run client-side with parsed header).
 */
export function scoreFileCompliance(filePath: string, content: string): LeewayComplianceResult {
  // Client-side lightweight scoring based on header detection
  const hasHeader = content.includes("LEEWAY HEADER") || content.includes("LEEWAY HEADER — DO NOT REMOVE");
  const hasRegion = /REGION:\s*\S+/i.test(content);
  const hasTag = /TAG:\s*\S+/i.test(content);
  const has5WH = /5WH:/.test(content);
  const hasWhat = /WHAT\s*=/.test(content);
  const hasWhy = /WHY\s*=/.test(content);
  const hasLicense = /LICENSE:/i.test(content);
  
  let score = 0;
  const breakdown: Record<string, number> = {};
  const issues: string[] = [];

  // Header presence (30 pts)
  breakdown.hasHeader = hasHeader ? 30 : 0;
  score += breakdown.hasHeader;
  if (!hasHeader) issues.push("Missing LEEWAY header");

  // Header validity (20 pts — has REGION + TAG + 5WH min)
  if (hasHeader) {
    let validPts = 0;
    if (hasRegion) validPts += 7;
    else issues.push("Missing REGION");
    if (hasTag) validPts += 7;
    else issues.push("Missing TAG");
    if (has5WH && hasWhat) validPts += 6;
    else issues.push("Missing 5WH/WHAT");
    breakdown.headerValid = validPts;
    score += validPts;
  }

  // TAG format (15 pts)
  if (hasTag) {
    const tagMatch = content.match(/TAG:\s*(\S+)/);
    const tag = tagMatch?.[1] || "";
    const dotCount = tag.split(".").length;
    breakdown.tagValid = dotCount >= 3 ? 15 : dotCount >= 2 ? 10 : 5;
    score += breakdown.tagValid;
  }

  // Region declared (10 pts)
  breakdown.regionDeclared = hasRegion ? 10 : 0;
  score += breakdown.regionDeclared;

  // Naming convention (10 pts — check file extension)
  const hasProperExt = /\.(ts|tsx|js|jsx|py|go|rs|css|html)$/i.test(filePath);
  breakdown.namingConvention = hasProperExt ? 10 : 5;
  score += breakdown.namingConvention;

  // License (5 pts)
  breakdown.license = hasLicense ? 5 : 0;
  score += breakdown.license;
  if (!hasLicense) issues.push("Missing LICENSE");

  score = Math.min(100, Math.max(0, score));
  const level = score >= 95 ? "PLATINUM" : score >= 80 ? "GOLD" : score >= 60 ? "SILVER" : score >= 40 ? "BRONZE" : "NONE";

  return { score, level, breakdown, issues };
}

// ══════════════════════════════════════════════════════════════════════════
//  EXPLAIN — File Explanation
// ══════════════════════════════════════════════════════════════════════════

/**
 * Explain a file using its LEEWAY header.
 * Routes through backend for full parsing.
 */
export async function explainFile(filePath: string): Promise<LeewayExplanation | null> {
  return leewayFetch("explain", { filePath });
}

// ══════════════════════════════════════════════════════════════════════════
//  ROUTER — Intent-Based Task Routing
// ══════════════════════════════════════════════════════════════════════════

/**
 * Route a task through the Leeway RouterAgent.
 * Used by the controller to decide which agent handles a task.
 */
export async function routeTask(task: string, context?: Record<string, any>): Promise<LeewayRouterResult | null> {
  return leewayFetch("route", { task, context });
}

// ══════════════════════════════════════════════════════════════════════════
//  MEMORY — Persistent State & Receipts
// ══════════════════════════════════════════════════════════════════════════

/**
 * Log a receipt for audit trail.
 */
export async function logMemoryReceipt(receipt: Omit<LeewayMemoryReceipt, "timestamp">): Promise<boolean> {
  const result = await leewayFetch("memory/receipt", receipt);
  return result?.success ?? false;
}

/**
 * Get recent operation receipts.
 */
export async function getMemoryReceipts(limit = 50): Promise<LeewayMemoryReceipt[]> {
  const result = await leewayFetch("memory/receipts", { limit });
  return result?.receipts ?? [];
}

/**
 * Set a key-value in persistent memory.
 */
export async function setMemoryValue(key: string, value: any): Promise<boolean> {
  const result = await leewayFetch("memory/set", { key, value });
  return result?.success ?? false;
}

/**
 * Get a key from persistent memory.
 */
export async function getMemoryValue(key: string, defaultValue: any = null): Promise<any> {
  const result = await leewayFetch("memory/get", { key });
  return result?.value ?? defaultValue;
}

// ══════════════════════════════════════════════════════════════════════════
//  HEALTH — Lightweight System Health
// ══════════════════════════════════════════════════════════════════════════

export async function runHealthCheck(): Promise<{ healthy: boolean; checks: Record<string, any>; summary: string } | null> {
  return leewayFetch("health");
}

// ══════════════════════════════════════════════════════════════════════════
//  SECURITY — Secret Scanning
// ══════════════════════════════════════════════════════════════════════════

export async function runSecretScan(rootDir?: string): Promise<{ clean: boolean; issues: string[] } | null> {
  return leewayFetch("security/scan", { rootDir: rootDir || "." });
}

// ══════════════════════════════════════════════════════════════════════════
//  MCP VALIDATION — Endpoint/Transport/Port checks
// ══════════════════════════════════════════════════════════════════════════

export async function validateMCPEndpoints(): Promise<{ endpoints: Array<{ url: string; status: string }>; healthy: boolean } | null> {
  return leewayFetch("mcp/validate");
}

// ══════════════════════════════════════════════════════════════════════════
//  COMBINED "LEEWAY STATUS" — Quick health snapshot
// ══════════════════════════════════════════════════════════════════════════

export interface LeewayStatus {
  sdkVersion: string;
  healthy: boolean;
  complianceScore: number | null;
  complianceLevel: string;
  headerCoverage: string;
  mcpHealthy: boolean;
  memoryOnline: boolean;
  lastDiagnosis: string | null;
}

/**
 * Get a quick Leeway SDK status snapshot.
 * Used by the workspace footer/status bar.
 */
export async function getLeewayStatus(): Promise<LeewayStatus> {
  try {
    const result = await leewayFetch("status");
    if (result) return result;
  } catch {}

  // Offline fallback
  return {
    sdkVersion: "1.0.1",
    healthy: false,
    complianceScore: null,
    complianceLevel: "UNKNOWN",
    headerCoverage: "N/A",
    mcpHealthy: false,
    memoryOnline: false,
    lastDiagnosis: null,
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  EXPORT ALL AGENT NAMES (for UI display)
// ══════════════════════════════════════════════════════════════════════════

export const LEEWAY_AGENT_ROSTER = {
  governance: ["assess-agent", "align-agent", "audit-agent"],
  standards: ["header-agent", "tag-agent", "region-agent", "discovery-pipeline-agent", "authority-agent", "placement-agent", "registry-agent"],
  mcp: ["endpoint-agent", "transport-agent", "port-agent", "process-agent", "env-agent", "runtime-agent", "manifest-agent", "health-agent-lite"],
  integrity: ["syntax-agent", "import-agent", "module-policy-agent", "duplicate-logic-agent", "dependency-graph-agent", "circular-dependency-agent", "refactor-scan-agent"],
  security: ["secret-scan-agent", "permission-agent", "prompt-security-agent", "tool-access-agent", "policy-agent", "privacy-agent"],
  discovery: ["schema-agent", "sitemap-agent", "intent-registry-agent", "docs-agent", "explain-agent", "architecture-map-agent"],
  orchestration: ["router-agent", "memory-agent-lite", "doctor-agent"],
} as const;

export const LEEWAY_TOTAL_AGENTS = Object.values(LEEWAY_AGENT_ROSTER).reduce((sum, group) => sum + group.length, 0);
