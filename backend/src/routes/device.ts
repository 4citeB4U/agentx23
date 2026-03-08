import { exec } from "child_process";
import express from "express";
import screenshot from "screenshot-desktop";
import { promisify } from "util";
import { AuditLogger } from "../services/AuditLogger.js";
import { securityMiddleware } from "../services/security.js";

const execAsync = promisify(exec);

export const deviceRouter = express.Router();
const DESKTOP_AGENT_PORT = Number(process.env.DESKTOP_AGENT_PORT || 8005);

// Apply security middleware to all device routes
deviceRouter.use(securityMiddleware);

/**
 * POST /api/device/verify
 * Confirms the provided signed device identity is valid.
 */
deviceRouter.post("/verify", async (req, res) => {
  try {
    const deviceId = (req.headers["x-device-id"] as string) || "unknown";
    res.json({
      status: "AUTHORIZED",
      deviceId,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({ error: "VERIFY_FAILED", details: String(error) });
  }
});

/**
 * GET /api/device/screenshot
 * Capture and return the current desktop screen.
 */
deviceRouter.get("/screenshot", async (req, res) => {
  try {
    const displayIndexRaw = Number(req.query.display);
    const useDisplayIndex =
      Number.isFinite(displayIndexRaw) && displayIndexRaw >= 1;

    // Desktop agent /screen is single-display; if a display is requested, use screenshot-desktop.
    if (!useDisplayIndex) {
      try {
        const desktopResponse = await fetch(
          `http://127.0.0.1:${DESKTOP_AGENT_PORT}/screen`,
        );
        if (desktopResponse.ok) {
          const image = Buffer.from(await desktopResponse.arrayBuffer());
          res.set("Content-Type", "image/jpeg");
          return res.send(image);
        }
      } catch {
        // Desktop agent unreachable — fall through to screenshot-desktop
      }
    }

    const options: any = { format: "jpg" };
    if (useDisplayIndex) {
      const displays = await screenshot.listDisplays();
      const selectedDisplay = displays[Math.floor(displayIndexRaw) - 1];
      if (!selectedDisplay) {
        return res
          .status(404)
          .json({
            error: "DISPLAY_NOT_FOUND",
            available: displays.length,
            requested: Math.floor(displayIndexRaw),
          });
      }
      if (selectedDisplay?.id) {
        options.screen = selectedDisplay.id;
      }
    }

    const img = await screenshot(options);
    res.set("Content-Type", "image/jpeg");
    res.send(img);
  } catch (error) {
    console.error("[device] Screenshot failed:", error);
    res
      .status(500)
      .json({ error: "SCREEN_CAPTURE_FAILED", details: String(error) });
  }
});
/**
 * POST /api/device/act
 * Proxy a command to the Desktop Agent.
 */
deviceRouter.post("/act", async (req, res) => {
  try {
    const { action, coordinates, text, keys, display } = req.body;

    // Audit every OS-control request (best-effort; do not block on audit failures).
    try {
      const forwardedFor = String(req.headers["x-forwarded-for"] || "")
        .split(",")[0]
        ?.trim();
      const ip =
        forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
      const deviceId = (req.headers["x-device-id"] as string) || "handshake";
      await AuditLogger.log({
        level: "IMPORTANT",
        deviceId,
        action: "DEVICE_ACT",
        resource: "/api/device/act",
        status: "REQUESTED",
        meta: {
          ip,
          action,
          hasCoordinates: Boolean(
            Array.isArray(coordinates) && coordinates.length >= 2,
          ),
          hasText: Boolean(typeof text === "string" && text.length > 0),
          hasKeys: Boolean(Array.isArray(keys) && keys.length > 0),
        },
      } as any);
    } catch {
      // non-blocking
    }

    // Proxy to vision_agent.py — format: {action, x, y, text, keys, dx, dy}
    const agentBody: Record<string, unknown> = { action };
    if (Array.isArray(coordinates) && coordinates.length >= 2) {
      agentBody.x = Math.round(Number(coordinates[0]));
      agentBody.y = Math.round(Number(coordinates[1]));
      if (coordinates.length > 2) {
        agentBody.dy = Math.round(Number(coordinates[2]));
      }
    }
    if (text !== undefined) agentBody.text = text;
    if (Array.isArray(keys) && keys.length > 0) agentBody.keys = keys;

    const response = await fetch(`http://127.0.0.1:${DESKTOP_AGENT_PORT}/act`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(agentBody),
    });

    const contentType = response.headers.get("content-type") || "";
    const raw = await response.text();
    if (contentType.includes("application/json")) {
      try {
        const data = JSON.parse(raw);
        return res.status(response.status).json(data);
      } catch {
        return res
          .status(502)
          .json({
            error: "DESKTOP_AGENT_BAD_JSON",
            status: response.status,
            raw: raw.slice(0, 2000),
          });
      }
    }
    return res
      .status(502)
      .json({
        error: "DESKTOP_AGENT_NON_JSON",
        status: response.status,
        raw: raw.slice(0, 2000),
      });
  } catch (error: any) {
    console.error("[device] Action failed:", error);
    res
      .status(500)
      .json({ error: "ACTION_EXECUTION_FAILED", details: String(error) });
  }
});

/**
 * POST /api/device/reset-comms
 * Force restart the Chrome Remote Desktop host service via PowerShell.
 */
deviceRouter.post("/reset-comms", async (req, res) => {
  try {
    // Restart chromoting service (Chrome Remote Desktop)
    // We use -Force on Stop-Service to ensure it closes even if busy
    const command = `powershell -Command "Get-Service chromoting | Stop-Service -Force; Get-Service chromoting | Start-Service"`;
    await execAsync(command);
    res.json({
      status: "success",
      message: "Chrome Remote Desktop (chromoting) service has been restarted.",
    });
  } catch (error: any) {
    console.error("[device] Reset Comms failed:", error);
    res.status(500).json({
      error: "RESET_FAILED",
      details: String(error),
    });
  }
});
