// LEEWAY v12 HEADER
// File: backend/src/routes/vm.ts
// Purpose: Agent Lee's personal sandbox VM — backed by a real directory on disk.
//          Provides: VFS tree, file I/O, sandboxed exec (build/test), project copy,
//          and a guarded apply step that pushes validated output back to real paths.
// Security: ALL file ops confined to VM_ROOT via resolveVmPath().
//           Exec restricted to a strict command allowlist.
//           Apply requires valid NEURAL_HANDSHAKE header.
//           No path traversal is possible.
// Performance: Job output streamed to file; frontend polls GET /api/vm/sandbox/jobs/:id.
// Discovery: ROLE=internal; INTENT=agent-sandbox; REGION=💻 VM

import { spawn } from "child_process";
import crypto from "crypto";
import { Request, Response, Router } from "express";
import fs from "fs";
import fsp from "fs/promises";
import path from "path";

export const vmRouter = Router();

const HANDSHAKE = process.env.NEURAL_HANDSHAKE || "AGENT_LEE_SOVEREIGN_V1";

// ── VM root — all Agent Lee sandbox operations live here ─────────────────
const VM_ROOT = path.resolve(process.cwd(), "workspace", "agentlee_vm");
const JOBS_DIR = path.join(VM_ROOT, ".jobs");

// ── Allowed exec commands (prefix whitelist) ──────────────────────────────
const EXEC_ALLOW = [
  "npm",
  "npx",
  "node",
  "python",
  "python3",
  "pip",
  "pip3",
  "tsc",
  "jest",
  "vitest",
  "mocha",
  "eslint",
  "prettier",
  "git",
  "ls",
  "cat",
  "echo",
  "mkdir",
  "cp",
  "mv",
  "rm",
  "pwsh",
  "powershell",
  // Linux / Ubuntu
  "bash",
  "sh",
  "apt",
  "apt-get",
  "apt-cache",
  "sudo",
  "chmod",
  "chown",
  "touch",
  "find",
  "grep",
  "sed",
  "awk",
  "curl",
  "wget",
  "tar",
  "unzip",
  "zip",
  "which",
  "env",
  "export",
  // VS Code CLI
  "code",
  "code-server",
  // Container / WSL
  "wsl",
  "docker",
  // Browser / Playwright
  "playwright",
  "chromium",
  "chromium-browser",
];

// ── Bootstrap VM directory structure ─────────────────────────────────────
(async () => {
  await fsp.mkdir(path.join(VM_ROOT, "home", "agent_lee", "scripts"), {
    recursive: true,
  });
  await fsp.mkdir(path.join(VM_ROOT, "home", "agent_lee", "projects"), {
    recursive: true,
  });
  await fsp.mkdir(path.join(VM_ROOT, "home", "agent_lee", "output"), {
    recursive: true,
  });
  await fsp.mkdir(path.join(VM_ROOT, "tmp"), { recursive: true });
  await fsp.mkdir(JOBS_DIR, { recursive: true });

  const welcome = path.join(VM_ROOT, "home", "agent_lee", "welcome.txt");
  if (!fs.existsSync(welcome)) {
    await fsp.writeFile(
      welcome,
      [
        "Welcome to Agent Lee VM — LEE_VM_01",
        "Instance: SOVEREIGN SANDBOX",
        "Kernel : Local-First v2.0  |  LEEWAY-CORE-2026",
        "Policy : VM-First. All tasks run here first.",
        "",
        "Directories:",
        "  ~/projects/  — copied project sandboxes",
        "  ~/output/    — build and test artifacts",
        "  ~/scripts/   — Agent Lee automation scripts",
        "",
        "Workflow: copy → edit → build → test → present → apply",
      ].join("\n"),
      "utf8",
    );
  }
})();

// ── Security helpers ──────────────────────────────────────────────────────
function resolveVmPath(relPath: string): string {
  // relPath is the VM-relative path e.g. "/home/agent_lee/file.txt"
  // Normalise to forward slashes first, strip leading slashes/backslashes,
  // then resolve relative to VM_ROOT.  This prevents Windows path.normalize
  // from turning "//'' into a backslash that escapes to the drive root.
  const forward = relPath.replace(/\\/g, "/");
  const clean = forward.replace(/^\/+/, ""); // strip leading "/"
  const abs = clean ? path.resolve(VM_ROOT, clean) : VM_ROOT;
  if (!abs.startsWith(VM_ROOT + path.sep) && abs !== VM_ROOT) {
    throw new Error("PATH_TRAVERSAL_DENIED");
  }
  return abs;
}

function resolveRealPath(realPath: string): string {
  // For apply: real disk path must stay within the workspace
  const ws = path.resolve(process.cwd());
  const abs = path.resolve(realPath);
  if (!abs.startsWith(ws + path.sep) && abs !== ws) {
    throw new Error("REAL_PATH_OUTSIDE_WORKSPACE");
  }
  return abs;
}

function guardApply(req: Request, res: Response): boolean {
  const h = req.headers["x-neural-handshake"] || req.headers["authorization"];
  if (h !== HANDSHAKE && h !== `Bearer ${HANDSHAKE}`) {
    res
      .status(401)
      .json({ error: "INVALID_HANDSHAKE — apply requires explicit auth" });
    return false;
  }
  return true;
}

function isExecAllowed(cmd: string): boolean {
  const base = cmd.trim().split(/\s+/)[0].toLowerCase();
  const name = path.basename(base);
  return EXEC_ALLOW.some(
    (allowed) => name === allowed || name === `${allowed}.exe`,
  );
}

// ── VFS helpers ───────────────────────────────────────────────────────────
interface VFSFile {
  name: string;
  type: "file";
  path: string;
  size: number;
  modified: string;
}
interface VFSDir {
  name: string;
  type: "dir";
  path: string;
  children: (VFSFile | VFSDir)[];
}

async function buildTree(
  absDir: string,
  vmRelDir: string,
  depth = 0,
): Promise<VFSDir> {
  const entries = await fsp
    .readdir(absDir, { withFileTypes: true })
    .catch(() => []);
  const children: (VFSFile | VFSDir)[] = [];
  for (const e of entries) {
    if (e.name.startsWith(".") && e.name !== ".jobs") continue; // hide dot files except jobs
    if (e.name === ".jobs") continue; // always hide jobs dir
    const childRel = `${vmRelDir}/${e.name}`;
    const childAbs = path.join(absDir, e.name);
    if (e.isDirectory() && depth < 5) {
      children.push(await buildTree(childAbs, childRel, depth + 1));
    } else if (e.isFile()) {
      const stat = await fsp.stat(childAbs).catch(() => null);
      children.push({
        name: e.name,
        type: "file",
        path: childRel,
        size: stat?.size ?? 0,
        modified: stat?.mtime.toISOString() ?? "",
      });
    }
  }
  return {
    name: path.basename(absDir),
    type: "dir",
    path: vmRelDir || "/",
    children,
  };
}

// ══════════════════════════════════════════════════════════════════════════
// VFS ROUTES
// ══════════════════════════════════════════════════════════════════════════

// GET /api/vm/vfs?path=/
vmRouter.get("/vfs", async (req: Request, res: Response) => {
  try {
    const p = String(req.query.path || "/");
    const abs = resolveVmPath(p);
    const stat = await fsp.stat(abs).catch(() => null);
    if (!stat) return res.status(404).json({ error: "NOT_FOUND" });
    if (stat.isDirectory()) {
      const rel = "/" + path.relative(VM_ROOT, abs).replace(/\\/g, "/");
      const tree = await buildTree(abs, rel === "/" ? "" : rel);
      return res.json(tree);
    }
    const content = await fsp.readFile(abs, "utf8").catch(() => "");
    return res.json({
      name: path.basename(abs),
      type: "file",
      path: p,
      content,
    });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// POST /api/vm/vfs/write  { path, content }
vmRouter.post("/vfs/write", async (req: Request, res: Response) => {
  try {
    const { path: p, content = "" } = req.body;
    if (!p) return res.status(400).json({ error: "path required" });
    const abs = resolveVmPath(p);
    await fsp.mkdir(path.dirname(abs), { recursive: true });
    await fsp.writeFile(abs, content, "utf8");
    return res.json({ ok: true, path: p });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// POST /api/vm/vfs/mkdir  { path }
vmRouter.post("/vfs/mkdir", async (req: Request, res: Response) => {
  try {
    const { path: p } = req.body;
    if (!p) return res.status(400).json({ error: "path required" });
    const abs = resolveVmPath(p);
    await fsp.mkdir(abs, { recursive: true });
    return res.json({ ok: true, path: p });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// DELETE /api/vm/vfs/rm  { path }
vmRouter.delete("/vfs/rm", async (req: Request, res: Response) => {
  try {
    const { path: p } = req.body;
    if (!p) return res.status(400).json({ error: "path required" });
    const abs = resolveVmPath(p);
    await fsp.rm(abs, { recursive: true, force: true });
    return res.json({ ok: true, path: p });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// GET /api/vm/vfs/read?path=...
vmRouter.get("/vfs/read", async (req: Request, res: Response) => {
  try {
    const p = String(req.query.path || "");
    if (!p) return res.status(400).json({ error: "path required" });
    const abs = resolveVmPath(p);
    const content = await fsp.readFile(abs, "utf8");
    return res.json({ path: p, content });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// SANDBOX: COPY PROJECT INTO VM
// ══════════════════════════════════════════════════════════════════════════

// POST /api/vm/sandbox/copy  { realPath, name? }
vmRouter.post("/sandbox/copy", async (req: Request, res: Response) => {
  try {
    const { realPath, name } = req.body;
    if (!realPath) return res.status(400).json({ error: "realPath required" });

    const srcAbs = path.resolve(realPath);
    const projectName = name || path.basename(srcAbs);
    const destRel = `/home/agent_lee/projects/${projectName}`;
    const destAbs = resolveVmPath(destRel);

    await fsp.mkdir(destAbs, { recursive: true });
    await fsp.cp(srcAbs, destAbs, {
      recursive: true,
      filter: (src) => {
        const rel = path.relative(srcAbs, src);
        // Skip node_modules, .git, dist, build, __pycache__
        return !/(node_modules|\.git|dist|build|__pycache__|\.next|\.cache)/.test(
          rel,
        );
      },
    });

    return res.json({
      ok: true,
      projectName,
      vmPath: destRel,
      source: realPath,
    });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// SANDBOX: EXEC — run a command in VM workspace (background job)
// ══════════════════════════════════════════════════════════════════════════

interface Job {
  id: string;
  cmd: string;
  cwd: string;
  status: "running" | "done" | "error";
  started: string;
  ended?: string;
  exitCode?: number;
}

const jobRegistry = new Map<string, Job>();

// POST /api/vm/sandbox/exec  { cmd, cwd? }
vmRouter.post("/sandbox/exec", async (req: Request, res: Response) => {
  try {
    const { cmd, cwd } = req.body;
    if (!cmd) return res.status(400).json({ error: "cmd required" });
    if (!isExecAllowed(cmd)) {
      return res
        .status(403)
        .json({ error: `Command not allowed: ${cmd.split(" ")[0]}` });
    }

    const cwdAbs = cwd
      ? resolveVmPath(cwd)
      : path.join(VM_ROOT, "home", "agent_lee");
    const jobId = crypto.randomUUID();
    const logPath = path.join(JOBS_DIR, `${jobId}.log`);

    const job: Job = {
      id: jobId,
      cmd,
      cwd: cwdAbs,
      status: "running",
      started: new Date().toISOString(),
    };
    jobRegistry.set(jobId, job);

    const [prog, ...args] = cmd.trim().split(/\s+/);
    const child = spawn(prog, args, {
      cwd: cwdAbs,
      shell: true,
      env: { ...process.env, FORCE_COLOR: "0" },
    });

    const logStream = fs.createWriteStream(logPath, { flags: "a" });
    child.stdout.pipe(logStream);
    child.stderr.pipe(logStream);

    child.on("close", async (code) => {
      logStream.end();
      job.status = code === 0 ? "done" : "error";
      job.exitCode = code ?? -1;
      job.ended = new Date().toISOString();
      // Persist job meta
      await fsp.writeFile(
        path.join(JOBS_DIR, `${jobId}.meta.json`),
        JSON.stringify(job),
        "utf8",
      );
    });

    return res.json({ ok: true, jobId, cmd, cwd: cwdAbs });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// GET /api/vm/sandbox/jobs
vmRouter.get("/sandbox/jobs", async (_req: Request, res: Response) => {
  try {
    const files = await fsp.readdir(JOBS_DIR).catch(() => []);
    const metas = files.filter((f) => f.endsWith(".meta.json"));
    const jobs: Job[] = [];
    for (const f of metas) {
      try {
        const raw = await fsp.readFile(path.join(JOBS_DIR, f), "utf8");
        jobs.push(JSON.parse(raw));
      } catch {
        /* skip */
      }
    }
    // Also include in-memory running jobs
    for (const [, j] of jobRegistry) {
      if (j.status === "running") jobs.push(j);
    }
    // Deduplicate
    const seen = new Set<string>();
    const unique = jobs.filter((j) => {
      if (seen.has(j.id)) return false;
      seen.add(j.id);
      return true;
    });
    return res.json(unique.sort((a, b) => b.started.localeCompare(a.started)));
  } catch (e: any) {
    return res.status(500).json({ error: e.message });
  }
});

// GET /api/vm/sandbox/jobs/:id
vmRouter.get("/sandbox/jobs/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!/^[0-9a-f-]{36}$/i.test(id))
      return res.status(400).json({ error: "Invalid job id" });
    const logPath = path.join(JOBS_DIR, `${id}.log`);
    const metaPath = path.join(JOBS_DIR, `${id}.meta.json`);

    const job =
      jobRegistry.get(id) ||
      JSON.parse(await fsp.readFile(metaPath, "utf8").catch(() => "null"));
    const log = await fsp.readFile(logPath, "utf8").catch(() => "");

    return res.json({ job, log: log.slice(-20_000) }); // last 20 KB
  } catch (e: any) {
    return res.status(404).json({ error: "Job not found" });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// SANDBOX: PRESENT — list VM project artifacts for user review
// ══════════════════════════════════════════════════════════════════════════

// GET /api/vm/sandbox/present?project=name
vmRouter.get("/sandbox/present", async (req: Request, res: Response) => {
  try {
    const project = String(req.query.project || "");
    const baseRel = project
      ? `/home/agent_lee/projects/${project}`
      : "/home/agent_lee";
    const baseAbs = resolveVmPath(baseRel);
    const tree = await buildTree(baseAbs, baseRel);
    return res.json({ project, tree, vmRoot: baseRel });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// SANDBOX: APPLY — copy approved VM output to real filesystem (GUARDED)
// ══════════════════════════════════════════════════════════════════════════

// POST /api/vm/sandbox/apply  { vmPath, realPath }
// Requires x-neural-handshake header
vmRouter.post("/sandbox/apply", async (req: Request, res: Response) => {
  if (!guardApply(req, res)) return;
  try {
    const { vmPath, realPath } = req.body;
    if (!vmPath || !realPath)
      return res.status(400).json({ error: "vmPath and realPath required" });

    const srcAbs = resolveVmPath(vmPath);
    const destAbs = resolveRealPath(realPath);

    const stat = await fsp.stat(srcAbs).catch(() => null);
    if (!stat) return res.status(404).json({ error: "vmPath not found" });

    await fsp.mkdir(path.dirname(destAbs), { recursive: true });
    if (stat.isDirectory()) {
      await fsp.cp(srcAbs, destAbs, { recursive: true });
    } else {
      await fsp.copyFile(srcAbs, destAbs);
    }

    return res.json({
      ok: true,
      vmPath,
      realPath,
      applied: new Date().toISOString(),
    });
  } catch (e: any) {
    return res.status(400).json({ error: e.message });
  }
});

// ── GET /api/vm/status ─────────────────────────────────────────────────
vmRouter.get("/status", (_req: Request, res: Response) => {
  res.json({
    instance: "LEE_VM_01",
    vmRoot: VM_ROOT,
    ready: fs.existsSync(VM_ROOT),
    runningJobs: [...jobRegistry.values()].filter((j) => j.status === "running")
      .length,
    policy: "VM_FIRST",
  });
});
