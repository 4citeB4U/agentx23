import { Router } from "express";
import fs from "fs";
import fsp from "fs/promises";
import multer from "multer";
import path from "path";
import { verifyHmacOrHandshake } from "../services/hmacAuth.js";

export const fsRouter = Router();

// ── HMAC / Handshake guard on all mutating operations ────────────────────────
// GET (read) is allowed via existing securityMiddleware; write needs stronger auth.
fsRouter.use((req, _res, next) => {
  if (
    req.method === "GET" ||
    req.method === "HEAD" ||
    req.method === "OPTIONS"
  ) {
    return next();
  }
  return verifyHmacOrHandshake(req, _res, next);
});

type FsAliasConfig = {
  aliases: Record<string, string>;
  blockedPatterns?: string[];
};

type FsEntry = {
  name: string;
  relPath: string;
  type: "file" | "directory";
  sizeBytes: number;
  modifiedMs: number;
};

const upload = multer({ dest: "uploads/" });

const DEFAULT_ALIASES: Record<string, string> = {
  C: "C:\\",
  L: "D:\\THEBESTAGENTLEE23",
  E: "E:\\",
  O: "O:\\",
  N: "N:\\",
  A: "A:\\",
  R: "R:\\",
  D: "D:\\",
  LEE: "C:\\Tools\\Portable-VSCode-MCP-Kit",
};

const CONFIG_PATH = path.resolve(process.cwd(), "data", "fs_roots.json");
const AUDIT_PATH = path.resolve(process.cwd(), "logs", "fs_audit.jsonl");

function nowIso() {
  return new Date().toISOString();
}

async function ensureAuditReady() {
  await fsp.mkdir(path.dirname(AUDIT_PATH), { recursive: true });
}

async function audit(req: any, entry: Record<string, unknown>) {
  await ensureAuditReady();
  const line =
    JSON.stringify({
      ts: nowIso(),
      ip: req.ip,
      method: req.method,
      url: req.originalUrl,
      ...entry,
    }) + "\n";
  await fsp.appendFile(AUDIT_PATH, line, "utf8");
}

function loadConfig(): FsAliasConfig {
  // Highest priority: env JSON override
  const envJson = (
    process.env.FS_ALIASES_JSON ||
    process.env.FS_ALIAS_JSON ||
    ""
  ).trim();
  if (envJson) {
    try {
      const parsed = JSON.parse(envJson) as Record<string, string>;
      return { aliases: parsed };
    } catch {
      // fall through
    }
  }

  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, "utf8");
      const parsed = JSON.parse(raw) as FsAliasConfig;
      if (parsed?.aliases && typeof parsed.aliases === "object") return parsed;
    }
  } catch {
    // fall through
  }

  return {
    aliases: DEFAULT_ALIASES,
    blockedPatterns: [
      ".env",
      ".ssh",
      ".git",
      "System32",
      "Windows",
      "Program Files",
      "node_modules",
    ],
  };
}

function getBlockedPatterns(config: FsAliasConfig): string[] {
  return (config.blockedPatterns || []).map((p) => String(p));
}

function isBlocked(fullPath: string, blockedPatterns: string[]): boolean {
  const lower = fullPath.toLowerCase();
  return blockedPatterns.some((p) => lower.includes(p.toLowerCase()));
}

function safeRelPath(input: unknown): string {
  const raw = String(input ?? "").replace(/\\/g, "/");
  const trimmed = raw.trim();
  if (!trimmed) return "";

  // block absolute paths, UNC, drive-qualified
  if (/^[a-zA-Z]:/.test(trimmed)) throw new Error("ABSOLUTE_PATH_FORBIDDEN");
  if (trimmed.startsWith("\\\\") || trimmed.startsWith("//"))
    throw new Error("UNC_PATH_FORBIDDEN");
  if (trimmed.startsWith("/") || trimmed.startsWith("\\"))
    throw new Error("ABSOLUTE_PATH_FORBIDDEN");

  const normalized = path.win32
    .normalize(trimmed.replace(/\//g, "\\"))
    .replace(/^\\+/, "");
  if (normalized === ".." || normalized.startsWith("..\\"))
    throw new Error("PATH_TRAVERSAL");
  return normalized;
}

function resolveWithin(
  root: string,
  rel: string,
): { rootResolved: string; fullPath: string } {
  const rootResolved = path.win32.resolve(root);
  const fullPath = path.win32.resolve(rootResolved, rel);
  const rootPrefix = rootResolved.endsWith("\\")
    ? rootResolved
    : rootResolved + "\\";
  const ok =
    fullPath.toLowerCase() === rootResolved.toLowerCase() ||
    fullPath.toLowerCase().startsWith(rootPrefix.toLowerCase());
  if (!ok) throw new Error("ACCESS_DENIED_OUTSIDE_ROOT");
  return { rootResolved, fullPath };
}

function contentTypeFor(name: string): string {
  const ext = (path.extname(name) || "").toLowerCase();
  if (ext === ".txt") return "text/plain; charset=utf-8";
  if (ext === ".md") return "text/markdown; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".ts") return "text/plain; charset=utf-8";
  if (ext === ".tsx" || ext === ".jsx") return "text/plain; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".webm") return "video/webm";
  if (ext === ".zip") return "application/zip";
  return "application/octet-stream";
}

function getAliasOrThrow(rootAlias: string, cfg: FsAliasConfig): string {
  const root = cfg.aliases[rootAlias];
  if (!root) throw new Error("UNKNOWN_ROOT_ALIAS");
  return root;
}

// ---- API ----

fsRouter.get("/drives", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  const aliases = Object.entries(cfg.aliases).map(([id, root]) => {
    const resolved = path.win32.resolve(String(root));
    let exists = false;
    try {
      exists = fs.existsSync(resolved);
    } catch {
      exists = false;
    }
    return {
      id,
      root: resolved,
      exists,
      blocked: isBlocked(resolved, blocked),
    };
  });

  await audit(req, { action: "FS_DRIVES", status: "SUCCESS" });
  // `drives` key for legacy test clients; `aliases` is canonical
  res.json({ aliases, drives: aliases });
});

/** Resolve a root alias + relative path. If rootAlias is empty but
 *  the rel path is an absolute Windows path, auto-detect the alias. */
function resolveRootAndPath(
  rootAlias: string,
  rawPathInput: unknown,
  cfg: FsAliasConfig,
): { root: string; rootAlias: string; rel: string } {
  const rawStr = String(rawPathInput ?? "")
    .replace(/\//g, "\\")
    .trim();
  const isAbsolute = /^[A-Za-z]:\\/.test(rawStr) || rawStr.startsWith("\\");

  // If we already have a valid alias, use safeRelPath normally
  if (rootAlias && cfg.aliases[rootAlias]) {
    return {
      root: getAliasOrThrow(rootAlias, cfg),
      rootAlias,
      rel: safeRelPath(rawPathInput),
    };
  }

  // If it looks like an absolute path, auto-resolve to the matching alias
  if (isAbsolute) {
    const sortedAliases = Object.entries(cfg.aliases).sort(
      ([, a], [, b]) => String(b).length - String(a).length, // longest match first
    );
    for (const [id, aliasRoot] of sortedAliases) {
      const resolved = path.win32.resolve(String(aliasRoot));
      const resolvedPrefix = resolved.endsWith("\\")
        ? resolved
        : resolved + "\\";
      if (
        rawStr.toLowerCase().startsWith(resolvedPrefix.toLowerCase()) ||
        rawStr.toLowerCase() === resolved.toLowerCase()
      ) {
        const relPart = rawStr.slice(resolved.length).replace(/^[\\\/]+/, "");
        return { root: resolved, rootAlias: id, rel: relPart };
      }
    }
    throw new Error("NO_ALIAS_COVERS_PATH");
  }

  // Fall through — let getAliasOrThrow throw UNKNOWN_ROOT_ALIAS
  return {
    root: getAliasOrThrow(rootAlias, cfg),
    rootAlias,
    rel: safeRelPath(rawPathInput),
  };
}

fsRouter.get("/list", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const rawAlias = String(req.query.root || req.query.drive || "").trim();
    const { root, rootAlias, rel } = resolveRootAndPath(
      rawAlias,
      req.query.path,
      cfg,
    );
    const { fullPath, rootResolved } = resolveWithin(root, rel);
    if (isBlocked(fullPath, blocked)) throw new Error("ACCESS_DENIED_BLOCKED");

    const entries = await fsp.readdir(fullPath, { withFileTypes: true });
    const mapped: FsEntry[] = [];
    for (const entry of entries) {
      const entryRel = safeRelPath(path.win32.join(rel, entry.name));
      const entryFull = resolveWithin(rootResolved, entryRel).fullPath;
      if (isBlocked(entryFull, blocked)) continue;
      let stat;
      try {
        stat = await fsp.stat(entryFull);
      } catch {
        continue;
      }
      mapped.push({
        name: entry.name,
        relPath: entryRel.replace(/\\/g, "/"),
        type: entry.isDirectory() ? "directory" : "file",
        sizeBytes: stat.size,
        modifiedMs: stat.mtimeMs,
      });
    }

    await audit(req, {
      action: "FS_LIST",
      status: "SUCCESS",
      root: rootAlias,
      path: rel.replace(/\\/g, "/"),
    });
    res.json({
      root: rootAlias,
      path: rel.replace(/\\/g, "/"),
      entries: mapped,
    });
  } catch (e: any) {
    await audit(req, {
      action: "FS_LIST",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});

fsRouter.get("/read", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const rawAlias = String(req.query.root || req.query.drive || "").trim();
    const { root, rootAlias, rel } = resolveRootAndPath(
      rawAlias,
      req.query.path,
      cfg,
    );
    const { fullPath } = resolveWithin(root, rel);
    if (isBlocked(fullPath, blocked)) throw new Error("ACCESS_DENIED_BLOCKED");

    const stat = await fsp.stat(fullPath);
    if (!stat.isFile()) throw new Error("NOT_A_FILE");

    res.setHeader("Content-Type", contentTypeFor(fullPath));
    res.setHeader("Content-Length", String(stat.size));
    res.setHeader("X-FS-Modified-Ms", String(stat.mtimeMs));
    res.setHeader("X-FS-Name", path.win32.basename(fullPath));
    res.setHeader("Cache-Control", "no-store");

    await audit(req, {
      action: "FS_READ",
      status: "SUCCESS",
      root: rootAlias,
      path: rel.replace(/\\/g, "/"),
      sizeBytes: stat.size,
    });
    fs.createReadStream(fullPath).pipe(res);
  } catch (e: any) {
    await audit(req, {
      action: "FS_READ",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});

fsRouter.post("/write", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const rootAlias = String(req.body?.root || "").trim();
    const rel = safeRelPath(req.body?.path);
    const content = req.body?.content;
    if (typeof content !== "string") throw new Error("CONTENT_MUST_BE_STRING");

    const root = getAliasOrThrow(rootAlias, cfg);
    const { fullPath } = resolveWithin(root, rel);
    if (isBlocked(fullPath, blocked)) throw new Error("ACCESS_DENIED_BLOCKED");

    await fsp.mkdir(path.win32.dirname(fullPath), { recursive: true });
    await fsp.writeFile(fullPath, content, "utf8");
    await audit(req, {
      action: "FS_WRITE",
      status: "SUCCESS",
      root: rootAlias,
      path: rel.replace(/\\/g, "/"),
    });
    res.json({ success: true });
  } catch (e: any) {
    await audit(req, {
      action: "FS_WRITE",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});

fsRouter.post("/upload", upload.single("file"), async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const uploaded = (req as any).file;
    if (!uploaded) throw new Error("NO_FILE_UPLOADED");
    const rootAlias = String(req.body?.root || "").trim();
    const rel = safeRelPath(req.body?.path);
    const root = getAliasOrThrow(rootAlias, cfg);
    const { fullPath } = resolveWithin(root, rel);
    if (isBlocked(fullPath, blocked)) throw new Error("ACCESS_DENIED_BLOCKED");

    await fsp.mkdir(path.win32.dirname(fullPath), { recursive: true });
    await fsp.rename(uploaded.path, fullPath);
    await audit(req, {
      action: "FS_UPLOAD",
      status: "SUCCESS",
      root: rootAlias,
      path: rel.replace(/\\/g, "/"),
      sizeBytes: uploaded.size,
    });
    res.json({ success: true, sizeBytes: uploaded.size });
  } catch (e: any) {
    try {
      if ((req as any).file?.path) await fsp.unlink((req as any).file.path);
    } catch {
      // ignore
    }
    await audit(req, {
      action: "FS_UPLOAD",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});

fsRouter.post("/mkdir", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const rootAlias = String(req.body?.root || "").trim();
    const rel = safeRelPath(req.body?.path);
    if (!rel) throw new Error("PATH_REQUIRED");
    const root = getAliasOrThrow(rootAlias, cfg);
    const { fullPath } = resolveWithin(root, rel);
    if (isBlocked(fullPath, blocked)) throw new Error("ACCESS_DENIED_BLOCKED");

    await fsp.mkdir(fullPath, { recursive: true });
    await audit(req, {
      action: "FS_MKDIR",
      status: "SUCCESS",
      root: rootAlias,
      path: rel.replace(/\\/g, "/"),
    });
    res.json({ success: true });
  } catch (e: any) {
    await audit(req, {
      action: "FS_MKDIR",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});

fsRouter.post("/move", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const rootAlias = String(req.body?.root || "").trim();
    const srcRel = safeRelPath(req.body?.src);
    const dstRel = safeRelPath(req.body?.dst);
    if (!srcRel || !dstRel) throw new Error("SRC_DST_REQUIRED");

    const root = getAliasOrThrow(rootAlias, cfg);
    const src = resolveWithin(root, srcRel).fullPath;
    const dst = resolveWithin(root, dstRel).fullPath;
    if (isBlocked(src, blocked) || isBlocked(dst, blocked))
      throw new Error("ACCESS_DENIED_BLOCKED");

    await fsp.mkdir(path.win32.dirname(dst), { recursive: true });
    await fsp.rename(src, dst);
    await audit(req, {
      action: "FS_MOVE",
      status: "SUCCESS",
      root: rootAlias,
      src: srcRel.replace(/\\/g, "/"),
      dst: dstRel.replace(/\\/g, "/"),
    });
    res.json({ success: true });
  } catch (e: any) {
    await audit(req, {
      action: "FS_MOVE",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});

fsRouter.post("/copy", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const rootAlias = String(req.body?.root || "").trim();
    const srcRel = safeRelPath(req.body?.src);
    const dstRel = safeRelPath(req.body?.dst);
    if (!srcRel || !dstRel) throw new Error("SRC_DST_REQUIRED");

    const root = getAliasOrThrow(rootAlias, cfg);
    const src = resolveWithin(root, srcRel).fullPath;
    const dst = resolveWithin(root, dstRel).fullPath;
    if (isBlocked(src, blocked) || isBlocked(dst, blocked))
      throw new Error("ACCESS_DENIED_BLOCKED");

    await fsp.mkdir(path.win32.dirname(dst), { recursive: true });
    // Node 20 supports fs.cp
    await fsp.cp(src, dst, { recursive: true, force: true });
    await audit(req, {
      action: "FS_COPY",
      status: "SUCCESS",
      root: rootAlias,
      src: srcRel.replace(/\\/g, "/"),
      dst: dstRel.replace(/\\/g, "/"),
    });
    res.json({ success: true });
  } catch (e: any) {
    await audit(req, {
      action: "FS_COPY",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});

fsRouter.delete("/delete", async (req, res) => {
  const cfg = loadConfig();
  const blocked = getBlockedPatterns(cfg);
  try {
    const rootAlias = String(req.query.root || req.query.drive || "").trim();
    const rel = safeRelPath(req.query.path);
    if (!rel) throw new Error("PATH_REQUIRED");

    const root = getAliasOrThrow(rootAlias, cfg);
    const { fullPath } = resolveWithin(root, rel);
    if (isBlocked(fullPath, blocked)) throw new Error("ACCESS_DENIED_BLOCKED");

    await fsp.rm(fullPath, { recursive: true, force: true });
    await audit(req, {
      action: "FS_DELETE",
      status: "SUCCESS",
      root: rootAlias,
      path: rel.replace(/\\/g, "/"),
    });
    res.json({ success: true });
  } catch (e: any) {
    await audit(req, {
      action: "FS_DELETE",
      status: "ERROR",
      error: String(e?.message || e),
    });
    res.status(400).json({ error: String(e?.message || e) });
  }
});
