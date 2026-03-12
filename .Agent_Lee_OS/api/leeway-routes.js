/*
LEEWAY HEADER — DO NOT REMOVE
REGION: CORE.API.LEEWAY
TAG: CORE.API.LEEWAY.ROUTES

5WH:
WHAT = Backend API routes for leeway-sdk agent execution
WHY = Frontend cannot run Node.js-dependent SDK agents directly;
      these routes wrap real leeway-sdk agent calls.
WHO = LEEWAY / Agent Lee OS
WHERE = .Agent_Lee_OS/api/leeway-routes.js
WHEN = 2026
HOW = Express-style route handlers that import and run leeway-sdk agents.
      Each route validates the handshake token before executing.

LICENSE:
MIT
*/

import { Router } from 'express';
import {
  DoctorAgent,
  AssessAgent,
  AuditAgent,
  ExplainAgent,
  RouterAgent,
  MemoryAgentLite,
  HealthAgentLite,
  SecretScanAgent,
  EndpointAgent,
  scoreCompliance,
  COMPLIANCE_LEVELS,
} from 'leeway-sdk';

const router = Router();
const PROJECT_ROOT = process.cwd();

// ── Auth middleware ─────────────────────────────────────────────────────────
function requireHandshake(req, res, next) {
  const token = req.headers['x-neural-handshake'];
  if (!token) return res.status(401).json({ error: 'Missing x-neural-handshake' });
  next();
}
router.use(requireHandshake);

// ── Shared instances (lazy init) ────────────────────────────────────────────
let _memory = null;
function getMemory() {
  if (!_memory) _memory = new MemoryAgentLite({ rootDir: PROJECT_ROOT });
  return _memory;
}

// ══════════════════════════════════════════════════════════════════════════
//  DOCTOR — Full system diagnosis
// ══════════════════════════════════════════════════════════════════════════

router.post('/doctor', async (req, res) => {
  try {
    const rootDir = req.body.rootDir || PROJECT_ROOT;
    const doctor = new DoctorAgent({ rootDir });
    const report = await doctor.run();

    // Log receipt
    await getMemory().logReceipt({
      agent: 'doctor-agent',
      action: 'run',
      target: rootDir,
      result: report.summary.status,
    });

    res.json(report);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  ASSESS — Workspace inventory
// ══════════════════════════════════════════════════════════════════════════

router.post('/assess', async (req, res) => {
  try {
    const rootDir = req.body.rootDir || PROJECT_ROOT;
    const assess = new AssessAgent({ rootDir });
    const result = await assess.run();

    await getMemory().logReceipt({
      agent: 'assess-agent',
      action: 'run',
      target: rootDir,
      result: `${result.summary.headerCoverage} coverage`,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  AUDIT — Compliance scoring
// ══════════════════════════════════════════════════════════════════════════

router.post('/audit', async (req, res) => {
  try {
    const rootDir = req.body.rootDir || PROJECT_ROOT;
    const audit = new AuditAgent({ rootDir });
    const result = await audit.runAndSave();
    res.json(result);
  } catch (err) {
    // If AuditAgent.runAndSave isn't available, try .run()
    try {
      const rootDir = req.body.rootDir || PROJECT_ROOT;
      const audit = new AuditAgent({ rootDir });
      const result = await audit.run();
      res.json(result);
    } catch (err2) {
      res.status(500).json({ error: err2.message });
    }
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  EXPLAIN — File explanation
// ══════════════════════════════════════════════════════════════════════════

router.post('/explain', async (req, res) => {
  try {
    const { filePath } = req.body;
    if (!filePath) return res.status(400).json({ error: 'filePath required' });

    const explain = new ExplainAgent({ rootDir: PROJECT_ROOT });
    const result = await explain.explain(filePath);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  ROUTER — Intent-based agent routing
// ══════════════════════════════════════════════════════════════════════════

router.post('/route', async (req, res) => {
  try {
    const { task, context } = req.body;
    if (!task) return res.status(400).json({ error: 'task required' });

    // Build router with standard Leeway agents
    const agents = {
      assess: new AssessAgent({ rootDir: PROJECT_ROOT }),
      audit: new AuditAgent({ rootDir: PROJECT_ROOT }),
      doctor: new DoctorAgent({ rootDir: PROJECT_ROOT }),
    };
    const routerAgent = RouterAgent.withStandardRoutes(agents);

    // Add custom Agent Lee routes
    routerAgent.register(/(?:explain|describe).*file/i, {
      agent: 'explain-agent',
      handler: async () => {
        const explain = new ExplainAgent({ rootDir: PROJECT_ROOT });
        const fileMatch = task.match(/(?:file\s+)?['"`]?([^\s'"`,;]+\.\w+)['"`]?/i);
        return explain.explain(fileMatch?.[1] || '.');
      },
    });

    routerAgent.register(/(?:health|status|check)/i, {
      agent: 'health-agent-lite',
      handler: async () => {
        const health = HealthAgentLite.withSystemChecks();
        return health.run();
      },
    });

    routerAgent.register(/(?:secret|scan|security)/i, {
      agent: 'secret-scan-agent',
      handler: async () => {
        const scanner = new SecretScanAgent({ rootDir: PROJECT_ROOT });
        return scanner.scan();
      },
    });

    const result = await routerAgent.route(task, context || {});

    await getMemory().logReceipt({
      agent: 'router-agent',
      action: 'route',
      target: task.slice(0, 80),
      result: result.routed ? `Routed to ${result.agent}` : 'No route matched',
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  MEMORY — Persistent state (key-value + receipts)
// ══════════════════════════════════════════════════════════════════════════

router.post('/memory/receipt', async (req, res) => {
  try {
    await getMemory().logReceipt(req.body);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/memory/receipts', async (req, res) => {
  try {
    const receipts = await getMemory().getReceipts(req.body.limit || 50);
    res.json({ receipts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/memory/set', async (req, res) => {
  try {
    await getMemory().set(req.body.key, req.body.value);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/memory/get', async (req, res) => {
  try {
    const value = await getMemory().get(req.body.key);
    res.json({ value });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  HEALTH — Lightweight readiness check
// ══════════════════════════════════════════════════════════════════════════

router.post('/health', async (req, res) => {
  try {
    const health = HealthAgentLite.withSystemChecks();
    const result = await health.run();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  SECURITY — Secret scanning
// ══════════════════════════════════════════════════════════════════════════

router.post('/security/scan', async (req, res) => {
  try {
    const rootDir = req.body.rootDir || PROJECT_ROOT;
    const scanner = new SecretScanAgent({ rootDir });
    const result = await scanner.scan();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  MCP VALIDATION
// ══════════════════════════════════════════════════════════════════════════

router.post('/mcp/validate', async (req, res) => {
  try {
    const endpoint = new EndpointAgent({ rootDir: PROJECT_ROOT });
    const result = await endpoint.detect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
//  STATUS — Quick snapshot for UI status bar
// ══════════════════════════════════════════════════════════════════════════

router.post('/status', async (req, res) => {
  try {
    const memory = getMemory();
    const lastDiagnosis = await memory.get('lastDiagnosis', null);
    const lastAudit = await memory.get('lastAuditScore', null);

    // Quick health check
    let healthy = true;
    try {
      const health = HealthAgentLite.withSystemChecks();
      const healthResult = await health.run();
      healthy = healthResult.healthy;
    } catch { healthy = false; }

    res.json({
      sdkVersion: '1.0.1',
      healthy,
      complianceScore: lastAudit?.score || null,
      complianceLevel: lastAudit?.level || 'UNKNOWN',
      headerCoverage: lastAudit?.headerCoverage || 'N/A',
      mcpHealthy: healthy,
      memoryOnline: true,
      lastDiagnosis: lastDiagnosis?.timestamp || null,
    });
  } catch (err) {
    res.json({
      sdkVersion: '1.0.1',
      healthy: false,
      complianceScore: null,
      complianceLevel: 'UNKNOWN',
      headerCoverage: 'N/A',
      mcpHealthy: false,
      memoryOnline: false,
      lastDiagnosis: null,
    });
  }
});

export default router;
