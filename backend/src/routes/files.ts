import { Router } from "express";
import fs from "fs/promises";
import multer from "multer";
import path from "path";

export const fileRouter = Router();

// Configure multer for file uploads
const upload = multer({ dest: "uploads/" });

// FORT KNOX: Absolute Root Jail
const ALLOWED_ROOT = path.resolve("c:\\Tools\\Portable-VSCode-MCP-Kit");
const BLOCKED_PATTERNS = [
  ".env",
  "node_modules",
  "package-lock.json",
  "system32",
  "Program Files",
  "Windows",
  ".ssh",
  ".git",
];

function isPathSafe(p: string): boolean {
  const resolved = path.resolve(p);
  return resolved.startsWith(ALLOWED_ROOT);
}

function isBlockedPath(p: string): boolean {
  const lowerP = p.toLowerCase();
  return BLOCKED_PATTERNS.some((pattern) =>
    lowerP.includes(pattern.toLowerCase()),
  );
}

// List files in a directory
fileRouter.get("/", async (req, res) => {
  try {
    const queryPath = (req.query.path as string) || ALLOWED_ROOT;
    const dirPath = path.resolve(queryPath);

    if (!isPathSafe(dirPath) || isBlockedPath(dirPath)) {
      console.warn(`[security] Jailbreak attempt detected: ${dirPath}`);
      return res.status(403).json({ error: "ACCESS_DENIED_OUTSIDE_ROOT" });
    }

    const entries = await fs.readdir(dirPath, { withFileTypes: true });

    const files = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        const stats = await fs.stat(fullPath);

        return {
          name: entry.name,
          path: fullPath,
          type: entry.isDirectory() ? "directory" : "file",
          size: stats.size,
          modified: stats.mtime.toISOString(),
        };
      }),
    );

    res.json({
      path: dirPath,
      files,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Read file content
fileRouter.get("/content", async (req, res) => {
  try {
    const filePath = req.query.path as string;

    if (!filePath) {
      return res.status(400).json({ error: "Path parameter required" });
    }

    const resolvedPath = path.resolve(filePath);

    if (!isPathSafe(resolvedPath) || isBlockedPath(resolvedPath)) {
      return res.status(403).json({ error: "ACCESS_DENIED" });
    }

    const content = await fs.readFile(resolvedPath, "utf-8");

    res.json({
      path: filePath,
      content,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Write file content
fileRouter.put("/content", async (req, res) => {
  try {
    const { path: filePath, content } = req.body;

    if (!filePath || content === undefined) {
      return res.status(400).json({ error: "Path and content required" });
    }

    const resolvedPath = path.resolve(filePath);

    if (!isPathSafe(resolvedPath) || isBlockedPath(resolvedPath)) {
      return res.status(403).json({ error: "ACCESS_DENIED" });
    }

    await fs.writeFile(resolvedPath, content, "utf-8");

    res.json({
      success: true,
      path: filePath,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Upload file
fileRouter.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const uploaded = (req as any).file;
    if (!uploaded) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    const targetPath = req.body.targetPath || uploaded.originalname;
    const resolvedTarget = path.resolve(targetPath);

    if (!isPathSafe(resolvedTarget) || isBlockedPath(resolvedTarget)) {
      await fs.unlink(uploaded.path); // Clean up temp file
      return res.status(403).json({ error: "ACCESS_DENIED" });
    }

    await fs.rename(uploaded.path, resolvedTarget);

    res.json({
      success: true,
      path: targetPath,
      filename: uploaded.originalname,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});
