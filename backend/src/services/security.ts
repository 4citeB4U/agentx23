import dotenv from "dotenv";
import { NextFunction, Request, Response } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { AuditLogger } from "./AuditLogger.js";
import { CryptoUtils } from "./CryptoUtils.js";
import { DeviceRegistry } from "./DeviceRegistry.js";
import { rateLimiter } from "./RateLimiter.js";
import { ResourceGovernor } from "./ResourceGovernor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envCandidates = [
  path.resolve(__dirname, "../../../.env.local"),
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), "../.env.local"),
];
const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
if (envPath) {
  dotenv.config({ path: envPath });
} else {
  dotenv.config();
}

// Ensure registry and audit log are loaded
DeviceRegistry.load();
AuditLogger.init();

const SESSION_TIMEOUT_MS = parseInt(
  process.env.SESSION_TIMEOUT_MS || "1800000",
); // Default 30 minutes

let lastActivityTimestamp = Date.now();

export const securityMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  // /health is intentionally public (infrastructure health checks).
  // /services/system-status is now gated — it exposes auth state which is privileged.
  if (req.path === "/health") {
    return next();
  }

  await DeviceRegistry.ensureReady();

  const normalizedPath = req.path.split("?")[0];
  const normalizedOriginalUrl = (req.originalUrl || "").split("?")[0];
  const isScreenshotRoute =
    normalizedPath.includes("/device/screenshot") ||
    normalizedOriginalUrl.includes("/api/device/screenshot");
  const isActRoute =
    normalizedPath.includes("/device/act") ||
    normalizedOriginalUrl.includes("/api/device/act");
  const isDeploymentInitiate =
    normalizedPath.includes("/deployment/initiate") ||
    normalizedOriginalUrl.includes("/api/deployment/initiate");
  const isFsRoute =
    normalizedPath.includes("/fs/") ||
    normalizedPath === "/fs" ||
    normalizedOriginalUrl.includes("/api/fs/");
  const isRuntimeRoute =
    normalizedPath.includes("/services/runtime") ||
    normalizedOriginalUrl.includes("/api/services/runtime");
  const isChatRoute =
    normalizedPath.includes("/chat") ||
    normalizedOriginalUrl.includes("/api/chat");
  const isMcpRoute =
    normalizedPath.includes("/mcp") ||
    normalizedOriginalUrl.includes("/api/mcp");
  const isTunnelRoute =
    normalizedPath.includes("/tunnel") ||
    normalizedOriginalUrl.includes("/api/tunnel");
  const isAgentsRoute =
    normalizedPath.includes("/agents") ||
    normalizedOriginalUrl.includes("/api/agents");
  const isBrainRoute =
    normalizedPath.includes("/brain") ||
    normalizedOriginalUrl.includes("/api/brain");
  const isPhoneRoute =
    normalizedPath.includes("/phone") ||
    normalizedOriginalUrl.includes("/api/phone");
  const isAppsRoute =
    normalizedPath.includes("/apps") ||
    normalizedOriginalUrl.includes("/api/apps");
  const isTerminalRoute =
    normalizedPath.includes("/terminal") ||
    normalizedOriginalUrl.includes("/api/terminal");
  const isSearchRoute =
    normalizedPath.includes("/search") ||
    normalizedOriginalUrl.includes("/api/search");
  const isVmRoute =
    normalizedPath.includes("/vm") || normalizedOriginalUrl.includes("/api/vm");
  const isSystemStatusRoute =
    normalizedPath === "/services/system-status" ||
    normalizedOriginalUrl === "/api/services/system-status";

  const handshakeHeader = (
    req.headers["x-neural-handshake"] as string | undefined
  )?.trim();
  // Default to a known sovereign handshake when env not provided (helps local test runs)
  const expectedHandshake = (
    process.env.NEURAL_HANDSHAKE ||
    process.env.NEURAL_HANDSHAKE_KEY ||
    "AGENT_LEE_SOVEREIGN_V1"
  ).trim();
  const hasValidHandshake = Boolean(
    expectedHandshake &&
    handshakeHeader &&
    handshakeHeader === expectedHandshake,
  );

  const remotePublicRead = req.method === "GET" && isScreenshotRoute;
  const remotePublicWrite = req.method === "POST" && isActRoute;
  const remotePublicDeploy = req.method === "POST" && isDeploymentInitiate;
  const remoteFsAllowed = isFsRoute;
  const remoteRuntimeAllowed = req.method === "GET" && isRuntimeRoute;
  const remoteChatAllowed = isChatRoute;
  const remoteMcpAllowed = isMcpRoute;
  const remoteTunnelAllowed = isTunnelRoute; // tunnel start/stop/status/telegram
  const remoteAgentsAllowed = isAgentsRoute; // sub-agent dispatch
  const remoteBrainAllowed = isBrainRoute; // brain diagnostics proxy
  const remotePhoneAllowed = isPhoneRoute; // phone mirror bridge
  const remoteAppsAllowed = isAppsRoute; // deployment dashboard
  const remoteTerminalAllowed = isTerminalRoute; // host terminal bridge
  const remoteSearchAllowed = isSearchRoute; // vm search proxy
  const remoteVmAllowed = isVmRoute; // agent lee vm sandbox
  const remoteStatusAllowed = isSystemStatusRoute && req.method === "GET"; // system-status gated behind handshake

  // system-status: requires handshake but NOT device-level crypto (lightweight gate)
  if (isSystemStatusRoute) {
    if (!hasValidHandshake) {
      return res.status(401).json({
        error: "MISSING_HANDSHAKE",
        message: "x-neural-handshake required.",
      });
    }
    return next();
  }

  // Best-effort throttling for handshake-allowed routes (often exposed via ngrok).
  // This protects against accidental overload and simple abuse.
  if (
    hasValidHandshake &&
    (remotePublicRead ||
      remotePublicWrite ||
      remotePublicDeploy ||
      remoteFsAllowed ||
      remoteRuntimeAllowed ||
      remoteChatAllowed ||
      remoteMcpAllowed ||
      remoteTunnelAllowed ||
      remoteAgentsAllowed ||
      remoteBrainAllowed ||
      remotePhoneAllowed ||
      remoteTerminalAllowed ||
      remoteAppsAllowed ||
      remoteSearchAllowed ||
      remoteVmAllowed ||
      remoteStatusAllowed)
  ) {
    const forwardedFor = String(req.headers["x-forwarded-for"] || "")
      .split(",")[0]
      ?.trim();
    const ip = forwardedFor || req.ip || req.socket.remoteAddress || "unknown";
    const routeKey = `${req.method}:${normalizedOriginalUrl || normalizedPath}`;

    // Route-specific defaults
    let limit = 60;
    let windowMs = 60_000;
    if (remotePublicRead) {
      limit = 20;
      windowMs = 5_000;
    } // screenshots
    else if (remotePublicWrite) {
      limit = 60;
      windowMs = 10_000;
    } // input actions
    else if (remoteChatAllowed) {
      limit = 12;
      windowMs = 60_000;
    } // chat requests
    else if (remoteFsAllowed) {
      limit = 30;
      windowMs = 60_000;
    } // fs operations
    else if (remoteMcpAllowed) {
      limit = 10;
      windowMs = 60_000;
    } // start/stop/status/logs

    const decision = rateLimiter.decide(`${ip}:${routeKey}`, limit, windowMs);
    if (!decision.allowed) {
      const d: any = decision;
      res.setHeader("Retry-After", Math.ceil((d.retryAfterMs || 0) / 1000));
      return res.status(429).json({
        error: "RATE_LIMITED",
        message: "Too many requests for this route. Slow down and retry.",
        retryAfterMs: d.retryAfterMs,
        windowMs: d.windowMs,
        limit: d.limit,
      });
    }

    // keep memory bounded
    if (Math.random() < 0.01) rateLimiter.cleanup();
    return next();
  }

  // 1. Check for Safe Mode (System Lockdown)
  const governorStatus = ResourceGovernor.status();
  const isWriteRequest = ["POST", "PUT", "DELETE", "PATCH"].includes(
    req.method,
  );

  if (governorStatus.isLocked && isWriteRequest) {
    return res.status(403).json({
      error: "SAFE_MODE_ACTIVE",
      message:
        "System is in read-only Safe Mode. Write operations are disabled.",
    });
  }

  // 2. Resource Quotas
  const deviceId = req.headers["x-device-id"] as string;
  const quotaType = isWriteRequest ? "file_write" : "file_read";
  const quotaCheck = ResourceGovernor.checkQuota(
    quotaType,
    deviceId || "unknown",
  );

  if (!quotaCheck.allowed) {
    return res.status(429).json({
      error: "RATE_LIMIT_EXCEEDED",
      message: quotaCheck.reason,
    });
  }

  const now = Date.now();
  const inactivityPeriod = now - lastActivityTimestamp;

  // 3. HMAC-SHA256 SIGNED HANDSHAKE (Stage 2)
  const signature = req.headers["x-neural-signature"] as string;
  const timestamp = req.headers["x-neural-timestamp"] as string;
  const nonce = req.headers["x-neural-nonce"] as string;

  // Dev bypass: allow unauthenticated local/dev requests when explicitly enabled.
  // Enable with env `DEV_ALLOW_UNAUTH=true`. This is intentionally conservative
  // and only permits known local/dev routes (chat, phone, tunnel, fs, runtime).
  const devAllow =
    String(process.env.DEV_ALLOW_UNAUTH || "").toLowerCase() === "true";
  const originHeader = String(req.headers.origin || "");
  const remoteAddr = req.socket.remoteAddress || "";
  const bodyHandshake =
    (req.body && (req.body.handshake || req.body.handshakeKey)) || "";
  const allowLocalHandshakeByBody =
    bodyHandshake && bodyHandshake === expectedHandshake;

  if (devAllow) {
    const isLocalOrigin =
      originHeader.includes("localhost") || originHeader.includes("127.0.0.1");
    const isLoopback =
      remoteAddr === "127.0.0.1" ||
      remoteAddr === "::1" ||
      remoteAddr === "localhost";
    if (isLocalOrigin || isLoopback || allowLocalHandshakeByBody) {
      if (
        isChatRoute ||
        isPhoneRoute ||
        isTunnelRoute ||
        isTerminalRoute ||
        isFsRoute ||
        isRuntimeRoute
      ) {
        console.log(
          "[security] DEV_ALLOW_UNAUTH enabled; bypassing crypto checks for local/dev request",
        );
        lastActivityTimestamp = now;
        return next();
      }
    }
  }

  if (!deviceId || !signature || !timestamp || !nonce) {
    return res.status(401).json({
      error: "MISSING_CRYPTO_IDENTITY",
      message:
        "Every request must be cryptographically signed by an approved device node.",
    });
  }

  const device = DeviceRegistry.getDevice(deviceId);
  if (!device) {
    console.warn(`[security] Unauthorized device attempt: ${deviceId}`);
    await AuditLogger.log({
      level: "CRITICAL",
      deviceId: deviceId || "unknown",
      action: "AUTH_FAILURE",
      resource: req.path,
      status: "UNAUTHORIZED_DEVICE",
    });
    return res.status(401).json({ error: "UNAUTHORIZED_DEVICE" });
  }

  // Verify timestamp (30s window) to prevent replay
  const requestTime = parseInt(timestamp);
  if (isNaN(requestTime) || Math.abs(now - requestTime) > 30000) {
    await AuditLogger.log({
      level: "WARN",
      deviceId,
      action: "AUTH_FAILURE",
      resource: req.path,
      status: "STALE_TIMESTAMP",
    });
    return res.status(401).json({ error: "STALE_REQUEST_TIMESTAMP" });
  }

  // Verify Signature
  // Write requests sign body; read requests sign query params
  const signedPayload = isWriteRequest ? req.body || {} : req.query || {};
  const payloadStr = JSON.stringify(signedPayload);
  const message = payloadStr + timestamp + nonce;
  const isValid = CryptoUtils.verifySignature(
    message,
    signature,
    device.secret,
  );

  if (!isValid) {
    console.warn(`[security] Invalid signature from device ${deviceId}`);
    await AuditLogger.log({
      level: "CRITICAL",
      deviceId,
      action: "AUTH_FAILURE",
      resource: req.path,
      status: "INVALID_SIGNATURE",
    });
    return res.status(401).json({ error: "INVALID_NEURAL_SIGNATURE" });
  }

  // Successful Auth Log
  await AuditLogger.log({
    level: "INFO",
    deviceId,
    action: "API_REQUEST",
    resource: req.path,
    status: "SUCCESS",
  });

  // Update activity timer on successful authenticated request
  lastActivityTimestamp = now;
  next();
};

export const sanitizeLog = (message: string): string => {
  // Mask sensitive keys if they appear in logs
  return message.replace(/AIza[0-9A-Za-z-_]{35}/g, "***REDACTED_API_KEY***");
};
