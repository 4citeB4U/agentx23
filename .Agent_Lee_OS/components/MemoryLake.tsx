// LEEWAY v12 HEADER
// File: MemoryLake.tsx
// Purpose: Omega Mandate Intelligence Pipeline — Multi-Select, 4-file sync, NotebookLM
import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import JSZip from "jszip";
import React, {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useMemo,
    useRef,
    useState,
} from "react";

interface FileMeta {
  name: string;
  path: string;
  size: number;
}

const LegacyMemoryLake: React.FC = () => {
  const [files, setFiles] = useState<FileMeta[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch file list from host
    fetch("http://localhost:6001/api/fs/list")
      .then((res) => res.json())
      .then(setFiles)
      .catch(() => setError("Failed to load file list."));
  }, []);

  const toggleSelect = (path: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const syncToNotebookLM = async () => {
    if (selectedFiles.size !== 4) return;
    setSyncing(true);
    setError(null);
    try {
      const selected = files.filter((f) => selectedFiles.has(f.path));
      // 1. POST metadata to /api/memory/index (Port 6001)
      await fetch("http://localhost:6001/api/memory/index", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: selected.map((f) => ({
            name: f.name,
            path: f.path,
            size: f.size,
          })),
        }),
      });
      // 2. POST file contents to /api/brain/contextualize (Port 6004)
      for (const file of selected) {
        const contentRes = await fetch(
          `http://localhost:6001/api/fs/read?path=${encodeURIComponent(file.path)}`,
        );
        const content = await contentRes.text();
        await fetch("http://localhost:6004/api/brain/contextualize", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: file.path, content }),
        });
      }
      // 3. Log event to agent_notebook.json (Port 6001)
      await fetch("http://localhost:6001/api/notebook/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "LEARN.DOMAIN_SYNC",
          files: Array.from(selectedFiles),
        }),
      });
      setSelectedFiles(new Set());
    } catch (e) {
      setError("Sync failed.");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="memory-lake">
      <h2>Memory Lake</h2>
      {error && <div className="error">{error}</div>}
      <ul>
        {files.map((file) => (
          <li key={file.path}>
            <label>
              <input
                type="checkbox"
                checked={selectedFiles.has(file.path)}
                onChange={() => toggleSelect(file.path)}
                disabled={syncing}
              />
              {file.name}{" "}
              <span style={{ color: "#888", fontSize: "0.9em" }}>
                ({file.size} bytes)
              </span>
            </label>
          </li>
        ))}
      </ul>
      <button
        onClick={syncToNotebookLM}
        disabled={selectedFiles.size !== 4 || syncing}
        style={{ marginTop: 12 }}
      >
        Sync to Brain
      </button>
    </div>
  );
};

// ==========================================
// 0. SYSTEM CONSTANTS & TYPES
// ==========================================

const DB_NAME_CORE = "agent-lee-neural-core";
const DB_VERSION_CORE = 3;
const DB_NAME_COLD = "agent-lee-cold-store";
const DB_VERSION_COLD = 1;

export type DriveId = "C" | "L" | "E" | "O" | "N" | "A" | "R" | "D" | "LEE";
export type CorruptionStatus = "safe" | "suspect" | "corrupt" | "offloaded";
export type FileCategory =
  | "code"
  | "data"
  | "doc"
  | "media"
  | "sys"
  | "archive";

const DRIVE_COLORS: Record<DriveId, string> = {
  C: "#60a5fa",
  LEE: "#ffffff",
  N: "#d8b4fe",
  A: "#f472b6",
  R: "#fb923c",
  O: "#fbbf24",
  L: "#22d3ee",
  E: "#facc15",
  D: "#4ade80",
};

const DRIVE_BG_CLASS: Record<DriveId, string> = {
  C: "bg-[#60a5fa]",
  LEE: "bg-[#ffffff]",
  N: "bg-[#d8b4fe]",
  A: "bg-[#f472b6]",
  R: "bg-[#fb923c]",
  O: "bg-[#fbbf24]",
  L: "bg-[#22d3ee]",
  E: "bg-[#facc15]",
  D: "bg-[#4ade80]",
};

const DRIVE_TEXT_CLASS: Record<DriveId, string> = {
  C: "text-[#60a5fa]",
  LEE: "text-[#ffffff]",
  N: "text-[#d8b4fe]",
  A: "text-[#f472b6]",
  R: "text-[#fb923c]",
  O: "text-[#fbbf24]",
  L: "text-[#22d3ee]",
  E: "text-[#facc15]",
  D: "text-[#4ade80]",
};

const DRIVE_BORDER_CLASS: Record<DriveId, string> = {
  C: "border-[#60a5fa]",
  LEE: "border-[#ffffff]",
  N: "border-[#d8b4fe]",
  A: "border-[#f472b6]",
  R: "border-[#fb923c]",
  O: "border-[#fbbf24]",
  L: "border-[#22d3ee]",
  E: "border-[#facc15]",
  D: "border-[#4ade80]",
};

export interface ExternalRef {
  type: "opfs" | "handle";
  path: string;
  archiveId?: string;
}

export interface NeuralFile {
  id: string;
  driveId: DriveId;
  slotId: number;
  name: string;
  path: string; // Relative path inside the slot
  extension: string;
  sizeBytes: number;
  content: string | Blob | null;
  category: FileCategory;
  status: CorruptionStatus;
  lastModified: number;
  signature: string;
  annotations: { id: string; text: string; timestamp: string }[];
  externalRef?: ExternalRef;
}

export interface ColdArchiveEntry {
  id: string;
  name: string;
  sizeBytes: number;
  createdAt: number;
  path: string; // OPFS path
  mimeType: string;
  originalDriveId?: string;
  originalSlotId?: number;
}

// ==========================================
// 1. UTILITIES: OPFS (Origin Private File System)
// ==========================================

function normalizePath(path: string): string {
  return path.replace(/^opfs:\//, "").replace(/^\/+/, "");
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
  return await navigator.storage.getDirectory();
}

async function opfsWriteFile(path: string, blob: Blob): Promise<void> {
  const rel = normalizePath(path);
  const parts = rel.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Invalid OPFS path: ${path}`);

  let dir = await getOpfsRoot();
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: true });
  }

  const fh = await dir.getFileHandle(fileName, { create: true });
  const w = await fh.createWritable();
  await w.write(blob);
  await w.close();
}

async function opfsReadFile(path: string): Promise<File> {
  const rel = normalizePath(path);
  const parts = rel.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) throw new Error(`Invalid OPFS path: ${path}`);

  let dir = await getOpfsRoot();
  for (const part of parts) {
    dir = await dir.getDirectoryHandle(part, { create: false });
  }

  const fh = await dir.getFileHandle(fileName, { create: false });
  return await fh.getFile();
}

async function opfsDeleteFile(path: string): Promise<void> {
  const rel = normalizePath(path);
  const parts = rel.split("/").filter(Boolean);
  const fileName = parts.pop();
  if (!fileName) return;

  try {
    let dir = await getOpfsRoot();
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: false });
    }
    await dir.removeEntry(fileName);
  } catch (e) {
    console.warn("Failed to delete OPFS file:", path, e);
  }
}

// ==========================================
// 2. LOGIC: COLD STORE (Singleton)
// ==========================================

interface ColdDB extends DBSchema {
  archives: { key: string; value: ColdArchiveEntry };
}

class ColdStorageLink {
  private dbPromise = openDB<ColdDB>(DB_NAME_COLD, DB_VERSION_COLD, {
    upgrade(db) {
      db.createObjectStore("archives", { keyPath: "id" });
    },
  });

  async addArchive(
    blob: Blob,
    meta: Omit<ColdArchiveEntry, "path" | "sizeBytes" | "createdAt">,
  ): Promise<ColdArchiveEntry> {
    const path = `archives/${meta.id}_${meta.name}`;
    await opfsWriteFile(path, blob);

    const entry: ColdArchiveEntry = {
      ...meta,
      path,
      sizeBytes: blob.size,
      createdAt: Date.now(),
    };

    const db = await this.dbPromise;
    await db.put("archives", entry);
    return entry;
  }

  async getArchiveBlob(id: string): Promise<Blob | null> {
    const db = await this.dbPromise;
    const entry = await db.get("archives", id);
    if (!entry) return null;
    try {
      return await opfsReadFile(entry.path);
    } catch (e) {
      console.error("Failed to read cold archive:", e);
      return null;
    }
  }

  async removeArchive(id: string) {
    const db = await this.dbPromise;
    const entry = await db.get("archives", id);
    if (entry) {
      await opfsDeleteFile(entry.path);
      await db.delete("archives", id);
    }
  }

  async listArchives(): Promise<ColdArchiveEntry[]> {
    const db = await this.dbPromise;
    return db.getAll("archives");
  }
}
const coldStore = new ColdStorageLink();

// ==========================================
// 3. LOGIC: NEURAL DB (Singleton)
// ==========================================

interface NeuralDB extends DBSchema {
  files: {
    key: string;
    value: NeuralFile;
    indexes: { "by-slot": [string, number]; "by-signature": string };
  };
  meta: { key: string; value: { initialized: boolean } };
}

class NeuralLink {
  private dbPromise: Promise<IDBPDatabase<NeuralDB>>;

  // Explorer Mirror Mode: remote filesystem gateway (source of truth)
  private slotRootsCache = new Map<DriveId, { ts: number; roots: string[] }>();
  private handshake = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as
    | string
    | undefined;

  constructor() {
    this.dbPromise = openDB<NeuralDB>(DB_NAME_CORE, DB_VERSION_CORE, {
      upgrade(db, oldVersion) {
        if (oldVersion < 2) {
          if (db.objectStoreNames.contains("files"))
            db.deleteObjectStore("files");
          if (db.objectStoreNames.contains("meta"))
            db.deleteObjectStore("meta");
        }
        if (!db.objectStoreNames.contains("files")) {
          const fileStore = db.createObjectStore("files", { keyPath: "id" });
          fileStore.createIndex("by-slot", ["driveId", "slotId"]);
          fileStore.createIndex("by-signature", "signature");
        }
        if (!db.objectStoreNames.contains("meta")) {
          db.createObjectStore("meta");
        }
      },
    });
    // In Explorer Mirror Mode, the browser DB is not the source of truth.
    // Keep the DB only for cold-store snapshots and future caching/offline queue work.
    this.initializeCore();
  }

  private async initializeCore() {
    const db = await this.dbPromise;
    const meta = await db.get("meta", "init");
    if (!meta) {
      console.log(
        "Agent Lee: Initializing Memory Lake (Explorer Mirror Mode)...",
      );
      await db.put("meta", { initialized: true }, "init");
    }
  }

  private async fsFetch(url: string, init?: RequestInit) {
    const headers: Record<string, string> = {
      ...(init?.headers as any),
      ...(this.handshake ? { "x-neural-handshake": this.handshake } : {}),
      "ngrok-skip-browser-warning": "1",
    };
    return fetch(url, { ...init, headers });
  }

  private async getSlotRoots(driveId: DriveId): Promise<string[]> {
    const cached = this.slotRootsCache.get(driveId);
    if (cached && Date.now() - cached.ts < 15_000) return cached.roots;

    const r = await this.fsFetch(
      `/api/fs/list?root=${encodeURIComponent(driveId)}&path=`,
    );
    if (!r.ok) throw new Error(`FS_LIST_HTTP_${r.status}`);
    const data = await r.json();
    const dirs = (Array.isArray(data?.entries) ? data.entries : [])
      .filter(
        (e: any) => e?.type === "directory" && typeof e?.name === "string",
      )
      .map((e: any) => String(e.name))
      .sort((a: string, b: string) => a.localeCompare(b));

    const roots = dirs.slice(0, 8);
    while (roots.length < 8) roots.push("");
    this.slotRootsCache.set(driveId, { ts: Date.now(), roots });
    return roots;
  }

  private inferCategory(name: string): FileCategory {
    const lower = name.toLowerCase();
    if (
      /(\.ts|\.tsx|\.js|\.jsx|\.json|\.py|\.cs|\.java|\.md|\.yml|\.yaml|\.toml|\.ini)$/i.test(
        lower,
      )
    )
      return "code";
    if (
      /(\.png|\.jpg|\.jpeg|\.gif|\.webp|\.svg|\.mp3|\.wav|\.mp4|\.webm|\.mov)$/i.test(
        lower,
      )
    )
      return "media";
    if (/(\.zip|\.7z|\.rar|\.tar|\.gz)$/i.test(lower)) return "archive";
    return "data";
  }

  private joinRel(...parts: string[]) {
    const cleaned = parts
      .filter(Boolean)
      .join("/")
      .replace(/\\/g, "/")
      .replace(/\/+/g, "/")
      .replace(/^\//, "");
    return cleaned;
  }

  async getFiles(driveId: DriveId, slotId: number): Promise<NeuralFile[]> {
    const slotRoots = await this.getSlotRoots(driveId);
    const bucket = slotRoots[Math.max(0, Math.min(7, slotId - 1))];
    if (!bucket) return [];

    const r = await this.fsFetch(
      `/api/fs/list?root=${encodeURIComponent(driveId)}&path=${encodeURIComponent(bucket)}`,
    );
    if (!r.ok) return [];
    const data = await r.json();
    const entries = Array.isArray(data?.entries) ? data.entries : [];

    const files: NeuralFile[] = entries
      .filter((e: any) => e?.type === "file" && typeof e?.name === "string")
      .map((e: any) => {
        const name = String(e.name);
        const relWithinDrive = this.joinRel(bucket, name);
        return {
          id: `${driveId}:${relWithinDrive}`,
          driveId,
          slotId,
          name,
          path: "",
          extension: name.split(".").pop() || "dat",
          sizeBytes: Number(e.sizeBytes || 0),
          content: null,
          category: this.inferCategory(name),
          status: "safe",
          lastModified: Number(e.modifiedMs || Date.now()),
          signature: "",
          annotations: [],
          externalRef: { type: "handle", path: relWithinDrive },
        };
      });

    return files;
  }

  async getFilesByDrive(driveId: DriveId): Promise<NeuralFile[]> {
    // Used primarily for slot counts and bulk exports. Keep this non-recursive and bounded.
    const slotRoots = await this.getSlotRoots(driveId);
    const all: NeuralFile[] = [];
    for (let slotId = 1; slotId <= 8; slotId++) {
      const bucket = slotRoots[slotId - 1];
      if (!bucket) continue;
      try {
        const slotFiles = await this.getFiles(driveId, slotId);
        all.push(...slotFiles);
      } catch {
        // ignore per-slot failures
      }
    }
    return all;
  }

  async getAllFiles(): Promise<NeuralFile[]> {
    // Mirror mode: source of truth is the gateway; enumerating everything is potentially huge.
    // Provide a bounded best-effort view across the known drive aliases.
    const drives: DriveId[] = ["L", "E", "O", "N", "A", "R", "D", "LEE"];
    const out: NeuralFile[] = [];
    for (const d of drives) {
      try {
        const f = await this.getFilesByDrive(d);
        out.push(...f);
      } catch {
        // ignore
      }
    }
    return out;
  }

  async getCopies(signature: string): Promise<NeuralFile[]> {
    // Mirror mode: signatures are not computed. Return empty.
    return [];
  }

  async addFile(file: NeuralFile) {
    const slotRoots = await this.getSlotRoots(file.driveId);
    const bucket = slotRoots[Math.max(0, Math.min(7, file.slotId - 1))];
    if (!bucket) throw new Error("SLOT_BUCKET_NOT_AVAILABLE");

    // Upload expects a full rel path including file name
    const relWithinDrive = this.joinRel(bucket, file.path || "", file.name);
    const body = new FormData();
    body.append("root", file.driveId);
    body.append("path", relWithinDrive);

    if (file.content instanceof Blob) {
      body.append("file", file.content, file.name);
    } else if (typeof file.content === "string") {
      body.append(
        "file",
        new Blob([file.content], { type: "text/plain" }),
        file.name,
      );
    } else {
      throw new Error("FILE_CONTENT_REQUIRED");
    }

    const r = await this.fsFetch("/api/fs/upload", { method: "POST", body });
    if (!r.ok) {
      const t = await r.text().catch(() => "");
      throw new Error(`UPLOAD_FAILED_${r.status}:${t.slice(0, 120)}`);
    }
  }

  async renameFile(id: string, newName: string) {
    // id is driveId:relPath
    const parts = String(id).split(":");
    const driveId = (parts[0] || "") as DriveId;
    const rel = parts.slice(1).join(":");
    if (!driveId || !rel) return;
    const dir = rel.replace(/\\/g, "/").split("/").slice(0, -1).join("/");
    const dst = this.joinRel(dir, newName);

    const r = await this.fsFetch("/api/fs/move", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ root: driveId, src: rel, dst }),
    });
    if (!r.ok) throw new Error(`MOVE_FAILED_${r.status}`);
  }

  async deleteFile(id: string) {
    const parts = String(id).split(":");
    const driveId = (parts[0] || "") as DriveId;
    const rel = parts.slice(1).join(":");
    if (!driveId || !rel) return;
    const r = await this.fsFetch(
      `/api/fs/delete?root=${encodeURIComponent(driveId)}&path=${encodeURIComponent(rel)}`,
      { method: "DELETE" },
    );
    if (!r.ok) throw new Error(`DELETE_FAILED_${r.status}`);
  }

  async updateStatus(id: string, status: CorruptionStatus) {
    // Mirror mode: no-op
    return;
  }

  async offload(id: string, ref: ExternalRef) {
    // Mirror mode: offload remains a local cold-store concept, not a remote filesystem mutation.
    // Keep DB write for cold-store linking only.
    const db = await this.dbPromise;
    const existing = await db.get("files", id);
    if (existing) {
      existing.content = null;
      existing.status = "offloaded";
      existing.externalRef = ref;
      existing.lastModified = Date.now();
      await db.put("files", existing);
    }
  }
}
export const neuralDB = new NeuralLink();

// ==========================================
// 4. SUB-COMPONENTS
// ==========================================

interface LayoutNode {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  type: "drive" | "slot" | "file";
  status?: CorruptionStatus;
  relatedDrives?: DriveId[];
}

const ConnectionLayer: React.FC<{
  nodes: LayoutNode[];
  w: number;
  h: number;
  activeDrive: DriveId;
  activeSlot: number | null;
}> = ({ nodes, w, h, activeDrive, activeSlot }) => {
  const getNode = (id: string) => nodes.find((n) => n.id === id);
  const driveColor = DRIVE_COLORS[activeDrive];
  const paths: React.ReactNode[] = [];

  const driveNode = getNode(`drive_${activeDrive}`);
  if (driveNode) {
    nodes
      .filter((n) => n.type === "slot")
      .forEach((slot) => {
        const start = {
          x: driveNode.x + driveNode.w / 2,
          y: driveNode.y + driveNode.h,
        };
        const end = { x: slot.x + slot.w, y: slot.y + slot.h / 2 };
        const cp1 = { x: start.x, y: start.y + 100 };
        const cp2 = { x: end.x + 50, y: end.y };
        const d = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

        const isActive =
          activeSlot && `slot_${activeDrive}-${activeSlot}` === slot.id;
        paths.push(
          <path
            key={`d-s-${slot.id}`}
            d={d}
            stroke={driveColor}
            strokeWidth={isActive ? 2.5 : 1.5}
            fill="none"
            opacity={isActive ? 0.9 : 0.4}
          />,
        );
        if (isActive)
          paths.push(
            <path
              key={`d-s-anim-${slot.id}`}
              d={d}
              stroke={driveColor}
              strokeWidth={4}
              fill="none"
              className="animate-flow"
              strokeDasharray="10 100"
              strokeLinecap="round"
              filter="url(#glow)"
            />,
          );
      });
  }

  if (activeSlot && driveNode) {
    const slotNode = getNode(`slot_${activeDrive}-${activeSlot}`);
    if (slotNode) {
      nodes
        .filter((n) => n.type === "file")
        .forEach((file) => {
          if (file.status === "corrupt") return;

          const start = {
            x: slotNode.x + slotNode.w,
            y: slotNode.y + slotNode.h / 2,
          };
          const end = { x: file.x, y: file.y + file.h / 2 };
          const cp1 = { x: start.x + 80, y: start.y };
          const cp2 = { x: end.x - 80, y: end.y };
          const d = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

          const isOffloaded = file.status === "offloaded";
          const dash = isOffloaded ? "4 4" : "";

          paths.push(
            <path
              key={`s-f-${file.id}`}
              d={d}
              stroke={driveColor}
              strokeWidth={1.5}
              fill="none"
              opacity={0.5}
              strokeDasharray={dash}
            />,
          );
          const animClass = isOffloaded ? "animate-pulse" : "animate-flow-fast";
          if (!isOffloaded) {
            paths.push(
              <path
                key={`s-f-anim-${file.id}`}
                d={d}
                stroke={driveColor}
                strokeWidth={2.5}
                fill="none"
                className={animClass}
                strokeDasharray="5 50"
                strokeLinecap="round"
                filter="url(#glow)"
              />,
            );
          }

          file.relatedDrives?.forEach((rId) => {
            const rNode = getNode(`drive_${rId}`);
            if (rNode) {
              const rColor = DRIVE_COLORS[rId];
              const fStart = { x: file.x + file.w / 2, y: file.y };
              const dEnd = { x: rNode.x + rNode.w / 2, y: rNode.y + rNode.h };
              const rCp1 = { x: fStart.x, y: fStart.y - 100 };
              const rCp2 = { x: dEnd.x, y: dEnd.y + 100 };
              const rD = `M ${fStart.x} ${fStart.y} C ${rCp1.x} ${rCp1.y}, ${rCp2.x} ${rCp2.y}, ${dEnd.x} ${dEnd.y}`;
              paths.push(
                <path
                  key={`f-d-${file.id}-${rId}`}
                  d={rD}
                  stroke={rColor}
                  strokeWidth={1}
                  fill="none"
                  opacity={0.7}
                />,
              );
              paths.push(
                <path
                  key={`f-d-a-${file.id}-${rId}`}
                  d={rD}
                  stroke={rColor}
                  strokeWidth={3}
                  fill="none"
                  className="animate-reverse-flow"
                  strokeDasharray="5 80"
                  strokeLinecap="round"
                  filter="url(#glow)"
                  opacity={1}
                />,
              );
            }
          });
        });
    }
  }

  return (
    <svg
      width={w}
      height={h}
      className="absolute inset-0 pointer-events-none z-10 overflow-visible"
    >
      <defs>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {paths}
    </svg>
  );
};

const FileCard: React.FC<{
  file: NeuralFile;
  activeDriveId: DriveId;
  fileRelations: Record<string, DriveId[]>;
  onOpen: (f: NeuralFile) => void;
  onRename: (id: string, name: string) => void;
  isSelected: boolean;
  selectionMode: boolean;
  toggleSelection: (id: string) => void;
  setRef: (id: string) => (el: HTMLDivElement | null) => void;
}> = React.memo(
  ({
    file,
    activeDriveId,
    fileRelations,
    onOpen,
    onRename,
    isSelected,
    selectionMode,
    toggleSelection,
    setRef,
  }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(file.name);
    const inputRef = useRef<HTMLInputElement>(null);

    const isCorrupt = file.status === "corrupt";
    const isOffloaded = file.status === "offloaded";

    useEffect(() => {
      setEditName(file.name);
    }, [file.name]);
    useEffect(() => {
      if (isEditing && inputRef.current) inputRef.current.focus();
    }, [isEditing]);

    const handleRenameSubmit = () => {
      if (editName.trim() && editName !== file.name)
        onRename(file.id, editName);
      setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter") handleRenameSubmit();
      if (e.key === "Escape") {
        setEditName(file.name);
        setIsEditing(false);
      }
      e.stopPropagation();
    };

    let borderColor = "border-slate-800";
    let bgColor = "bg-slate-900/20";
    let hoverClass = isCorrupt
      ? "hover:bg-red-900/20 hover:border-red-500 hover:scale-105 shadow-[0_0_10px_rgba(220,38,38,0.2)] cursor-help"
      : "hover:bg-white/5 hover:border-white/20 hover:scale-105 cursor-pointer cursor-grab active:cursor-grabbing";

    if (isCorrupt) {
      borderColor = "border-red-600/50";
      bgColor = "bg-red-950/10";
    } else if (isOffloaded) {
      borderColor = "border-dashed border-slate-600";
      bgColor = "bg-transparent";
      hoverClass = "hover:bg-slate-900/40 cursor-alias";
    }

    if (isSelected) {
      borderColor =
        "border-cyan-400 border-2 shadow-[0_0_15px_rgba(34,211,238,0.3)]";
      bgColor = "bg-cyan-900/20";
    } else if (selectionMode) {
      hoverClass =
        "hover:bg-cyan-900/10 hover:border-cyan-500/50 cursor-crosshair";
    }

    const handleClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (selectionMode || e.ctrlKey || e.metaKey) toggleSelection(file.id);
      else if (!isEditing) onOpen(file);
    };

    return (
      <div
        ref={setRef(`file_${file.id}`)}
        onClick={handleClick}
        draggable={!isEditing}
        onDragStart={(e) => {
          if (!isEditing) {
            e.dataTransfer.setData("agent-lee-file-id", file.id);
            e.dataTransfer.effectAllowed = "copy";
          } else e.preventDefault();
        }}
        className={`relative p-3 border rounded-lg backdrop-blur-sm transition-all duration-300 flex flex-col justify-between min-h-[90px] group overflow-hidden ${borderColor} ${bgColor} ${hoverClass}`}
      >
        <div className="flex justify-between items-start">
          <div
            className={`w-2 h-2 rounded-full ${isOffloaded ? "bg-slate-600 animate-pulse" : ""} ${isCorrupt ? "bg-red-500 animate-ping" : ""} ${!isOffloaded && !isCorrupt ? DRIVE_BG_CLASS[activeDriveId] : ""}`}
          />
          {selectionMode && (
            <div
              className={`w-3 h-3 rounded border ${isSelected ? "bg-cyan-400 border-cyan-400" : "border-slate-600 bg-transparent"}`}
            ></div>
          )}
          {isOffloaded && !selectionMode && (
            <span className="text-[10px] text-slate-500 font-mono tracking-tighter border border-slate-700 px-1 rounded">
              EXT. LINK
            </span>
          )}
          {isCorrupt && !selectionMode && (
            <span className="text-[9px] text-red-500 font-black tracking-widest border border-red-900 bg-red-950 px-1 rounded animate-pulse">
              CORRUPT
            </span>
          )}
          {!isOffloaded &&
            !isCorrupt &&
            !selectionMode &&
            fileRelations[file.id] && (
              <div className="flex gap-1.5 bg-black/50 rounded-full px-1.5 py-0.5 border border-white/10">
                {fileRelations[file.id].map((r) => (
                  <div
                    key={r}
                    className={`w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] animate-pulse ${DRIVE_BG_CLASS[r]} ${DRIVE_TEXT_CLASS[r]}`}
                  />
                ))}
              </div>
            )}
        </div>

        <div className="mt-2 z-10 relative">
          {isEditing ? (
            <input
              ref={inputRef}
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleRenameSubmit}
              onKeyDown={handleKeyDown}
              onClick={(e) => e.stopPropagation()}
              title="Rename file"
              aria-label="Rename file"
              placeholder="Rename file"
              className="w-full bg-black/50 border border-emerald-500/50 text-xs font-bold text-white px-1 rounded outline-none font-mono"
            />
          ) : (
            <div className="group/name flex items-center justify-between gap-1 w-full">
              <div
                className={`text-xs font-bold truncate ${isOffloaded ? "text-slate-500 italic" : ""} ${isCorrupt ? "text-red-400 font-mono" : "text-slate-300 group-hover:text-white"}`}
              >
                {file.name}
              </div>
              {!isOffloaded && !isCorrupt && !selectionMode && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsEditing(true);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 hover:text-emerald-400 px-1"
                >
                  ✎
                </button>
              )}
            </div>
          )}
          <div className="flex justify-between items-center mt-1">
            <div className="text-[9px] font-mono text-slate-600 uppercase">
              {file.category}
            </div>
            {isOffloaded && (
              <div className="text-[10px] text-emerald-500 font-bold animate-pulse">
                » CONNECTED
              </div>
            )}
          </div>
        </div>
      </div>
    );
  },
);

const MediaPreview: React.FC<{ file: NeuralFile }> = ({ file }) => {
  const [url, setUrl] = useState<string | null>(null);
  const [mimeType, setMimeType] = useState<string>("");
  const handshake = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as
    | string
    | undefined;

  useEffect(() => {
    let activeUrl: string | null = null;
    let isMounted = true;
    const load = async () => {
      let blob: Blob | null = null;
      if (file.content instanceof Blob) blob = file.content;
      else if (
        file.status === "offloaded" &&
        file.externalRef?.type === "opfs"
      ) {
        try {
          blob = await coldStore.getArchiveBlob(
            file.externalRef.archiveId || file.id,
          );
        } catch (e) {
          console.error(e);
        }
      } else if (file.externalRef?.type === "handle") {
        // Explorer Mirror Mode: fetch the real file from the gateway
        try {
          const r = await fetch(
            `/api/fs/read?root=${encodeURIComponent(file.driveId)}&path=${encodeURIComponent(file.externalRef.path)}&ts=${Date.now()}`,
            {
              headers: {
                ...(handshake ? { "x-neural-handshake": handshake } : {}),
                "ngrok-skip-browser-warning": "1",
              },
            },
          );
          if (r.ok) blob = await r.blob();
        } catch (e) {
          console.error(e);
        }
      }
      if (isMounted && blob) {
        setMimeType(blob.type);
        activeUrl = URL.createObjectURL(blob);
        setUrl(activeUrl);
      }
    };
    load();
    return () => {
      isMounted = false;
      if (activeUrl) URL.revokeObjectURL(activeUrl);
    };
  }, [
    file.id,
    file.status,
    file.externalRef?.archiveId,
    file.externalRef?.path,
    file.driveId,
  ]);

  if (!url) return null;
  const type = mimeType || "";
  const name = file.name || "";
  const isImg =
    type.startsWith("image/") ||
    /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name) ||
    name.endsWith(".png");
  const isAudio =
    type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a)$/i.test(name);
  const isVideo =
    type.startsWith("video/") || /\.(mp4|webm|mov|mkv)$/i.test(name);

  return (
    <div className="w-full h-32 bg-black border border-slate-800 rounded mb-4 flex items-center justify-center overflow-hidden relative">
      {isImg && (
        <img
          src={url}
          alt="Preview"
          className="max-h-full max-w-full object-contain"
        />
      )}
      {isAudio && <audio controls src={url} className="w-full px-4" />}
      {isVideo && (
        <video controls src={url} className="max-h-full max-w-full" />
      )}
      {!isImg && !isAudio && !isVideo && (
        <div className="text-[10px] text-slate-500">
          BINARY PREVIEW NOT AVAILABLE
        </div>
      )}
    </div>
  );
};

// ==========================================
// 5. MAIN APPLICATION COMPONENT
// ==========================================

export interface AgentLeeRef {
  speak: (message: string) => void;
  focusDrive: (driveId: DriveId) => void;
}

const MemoryLakeCore = forwardRef<AgentLeeRef, { onExit?: () => void }>(
  ({ onExit }, ref) => {
    const isIOS = /iPad|iPhone|iPod/i.test(navigator.userAgent);
    const handshake = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as
      | string
      | undefined;
    const [activeDriveId, setActiveDriveId] = useState<DriveId>("LEE");
    const [activeSlotId, setActiveSlotId] = useState<number | null>(null);
    const [activeFile, setActiveFile] = useState<NeuralFile | null>(null);
    const [viewSafeMode, setViewSafeMode] = useState(false);
    const [files, setFiles] = useState<NeuralFile[]>([]);
    const [fileRelations, setFileRelations] = useState<
      Record<string, DriveId[]>
    >({});
    const [slotCounts, setSlotCounts] = useState<Record<number, number>>({});
    const [coldArchives, setColdArchives] = useState<ColdArchiveEntry[]>([]);
    const [dragOverDrive, setDragOverDrive] = useState<DriveId | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const containerRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [dim, setDim] = useState({ w: 0, h: 0 });
    const [tick, setTick] = useState(0);

    useEffect(() => {
      refreshSlotCounts();
      refreshColdArchives();
    }, [activeDriveId]);

    const refreshSlotCounts = async () => {
      const f = await neuralDB.getFilesByDrive(activeDriveId);
      const counts: Record<number, number> = {};
      f.forEach((file) => {
        counts[file.slotId] = (counts[file.slotId] || 0) + 1;
      });
      setSlotCounts(counts);
    };

    const refreshColdArchives = async () => {
      const archives = await coldStore.listArchives();
      setColdArchives(archives);
    };

    const loadFiles = async () => {
      if (!activeSlotId) {
        setFiles([]);
        return;
      }
      const fs = (await neuralDB.getFiles(
        activeDriveId,
        activeSlotId,
      )) as unknown as NeuralFile[];
      setFiles(fs);
      const rels: Record<string, DriveId[]> = {};
      for (const f of fs) {
        if (f.signature) {
          try {
            const copies = await neuralDB.getCopies(f.signature);
            const driveIds = copies
              .map((c) => c.driveId)
              .filter((d) => d !== activeDriveId);
            const others = Array.from(new Set<DriveId>(driveIds));
            if (others.length > 0) rels[f.id] = others;
          } catch (e) {
            /* ignore */
          }
        }
      }
      setFileRelations(rels);
    };

    useEffect(() => {
      loadFiles();
      setSelectedIds(new Set());
      setSelectionMode(false);
    }, [activeDriveId, activeSlotId]);

    useEffect(() => {
      if (!containerRef.current) return;
      const ro = new ResizeObserver((e) =>
        setDim({ w: e[0].contentRect.width, h: e[0].contentRect.height }),
      );
      ro.observe(containerRef.current);
      return () => ro.disconnect();
    }, []);

    useEffect(() => {
      const interval = setInterval(() => setTick((t) => t + 1), 50);
      return () => clearInterval(interval);
    }, [files, activeSlotId]);

    const toggleSelection = (id: string) => {
      const next = new Set(selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      setSelectedIds(next);
      if (next.size > 0 && !selectionMode) setSelectionMode(true);
      if (next.size === 0) setSelectionMode(false);
    };

    const selectAll = () => {
      if (selectedIds.size === files.length) setSelectedIds(new Set());
      else setSelectedIds(new Set(files.map((f) => f.id)));
    };

    const handleRename = async (id: string, newName: string) => {
      await neuralDB.renameFile(id, newName);
      loadFiles();
    };

    const handleExport = async (
      scope: "file" | "slot" | "drive" | "system" | "selected",
      targetFile?: NeuralFile,
    ) => {
      const zip = new JSZip();
      let targets: NeuralFile[] = [];
      let filename = "export.zip";

      if (scope === "file" && targetFile) {
        targets = [targetFile];
        filename = `${targetFile.name}.zip`;
      } else if (scope === "selected" && selectedIds.size > 0) {
        targets = files.filter((f) => selectedIds.has(f.id));
        filename = `BATCH_EXPORT_${selectedIds.size}_FILES.zip`;
      } else if (scope === "slot" && activeSlotId) {
        targets = (await neuralDB.getFiles(
          activeDriveId,
          activeSlotId,
        )) as unknown as NeuralFile[];
        filename = `DRIVE-${activeDriveId}_SLOT-${activeSlotId}.zip`;
      } else if (scope === "drive") {
        targets = (await neuralDB.getFilesByDrive(
          activeDriveId,
        )) as unknown as NeuralFile[];
        filename = `DRIVE-${activeDriveId}_FULL.zip`;
      } else if (scope === "system") {
        targets = (await neuralDB.getAllFiles()) as unknown as NeuralFile[];
        filename = `AGENT_LEE_CORE_SYSTEM.zip`;
      }

      for (const f of targets) {
        const folderPrefix = f.path ? f.path : "";
        const entryName = folderPrefix + f.name;
        if (f.status === "offloaded") {
          zip.file(
            `${entryName}.link`,
            `EXTERNAL_LINK_REF: ${f.id}\nORIGINAL_SIZE: ${f.sizeBytes}`,
          );
          continue;
        }
        if (f.content) {
          zip.file(entryName, f.content);
          continue;
        }
        if (f.externalRef?.type === "handle") {
          try {
            const r = await fetch(
              `/api/fs/read?root=${encodeURIComponent(f.driveId)}&path=${encodeURIComponent(f.externalRef.path)}&ts=${Date.now()}`,
              {
                headers: {
                  ...(handshake ? { "x-neural-handshake": handshake } : {}),
                  "ngrok-skip-browser-warning": "1",
                },
              },
            );
            if (r.ok) {
              const blob = await r.blob();
              zip.file(entryName, blob);
            } else {
              zip.file(
                `${entryName}.error.txt`,
                `FAILED_TO_READ_REMOTE_FILE: HTTP ${r.status}`,
              );
            }
          } catch (e) {
            zip.file(
              `${entryName}.error.txt`,
              `FAILED_TO_READ_REMOTE_FILE: ${String(e).slice(0, 200)}`,
            );
          }
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      if (blob.size > 1024 * 1024 * 1024) {
        alert("SYSTEM ALERT: Archive exceeds 1GB logical segment limit.");
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
    };

    const handleBatchDelete = async () => {
      if (!confirm(`Permanently delete ${selectedIds.size} neural nodes?`))
        return;
      for (const id of selectedIds) await neuralDB.deleteFile(id);
      await loadFiles();
      refreshSlotCounts();
      setSelectedIds(new Set());
      setSelectionMode(false);
    };

    const handleBatchOffload = async () => {
      const targets = files.filter(
        (f) => selectedIds.has(f.id) && f.status !== "offloaded" && f.content,
      );
      for (const f of targets) {
        let blob: Blob;
        if (f.content instanceof Blob) blob = f.content;
        else if (typeof f.content === "string")
          blob = new Blob([f.content], { type: "text/plain" });
        else continue;

        const archive = await coldStore.addArchive(blob, {
          id: f.id,
          name: f.name,
          mimeType: blob.type || "application/octet-stream",
          originalDriveId: f.driveId,
          originalSlotId: f.slotId,
        });
        await neuralDB.offload(f.id, {
          type: "opfs",
          path: archive.path,
          archiveId: archive.id,
        });
      }
      await loadFiles();
      refreshColdArchives();
      setSelectedIds(new Set());
    };

    const handleOffload = async () => {
      if (!activeFile) return;
      if (activeFile.externalRef?.type === "handle") return;
      let blob: Blob;
      if (activeFile.content instanceof Blob) blob = activeFile.content;
      else if (typeof activeFile.content === "string")
        blob = new Blob([activeFile.content], { type: "text/plain" });
      else return;

      const archive = await coldStore.addArchive(blob, {
        id: activeFile.id,
        name: activeFile.name,
        mimeType: blob.type || "application/octet-stream",
        originalDriveId: activeFile.driveId,
        originalSlotId: activeFile.slotId,
      });
      await neuralDB.offload(activeFile.id, {
        type: "opfs",
        path: archive.path,
        archiveId: archive.id,
      });
      await loadFiles();
      refreshColdArchives();
      setActiveFile(null);
    };

    const handleDelete = async () => {
      if (!activeFile) return;
      await neuralDB.deleteFile(activeFile.id);
      await loadFiles();
      refreshSlotCounts();
      setActiveFile(null);
      setViewSafeMode(false);
    };

    const handleRepair = async () => {
      if (!activeFile) return;
      await neuralDB.updateStatus(activeFile.id, "safe");
      const updated = { ...activeFile, status: "safe" as CorruptionStatus };
      await loadFiles();
      setActiveFile(updated);
      setViewSafeMode(false);
    };

    const processUpload = async (fileList: FileList) => {
      if (!activeSlotId) return;
      for (const file of Array.from(fileList)) {
        let relPath = file.webkitRelativePath || "";
        if (relPath) {
          const parts = relPath.split("/");
          parts.pop();
          relPath = parts.join("/") + "/";
          if (relPath === "/") relPath = "";
        }
        const nf: NeuralFile = {
          id: `${activeDriveId}-${activeSlotId}-${Date.now()}-${Math.random()}`,
          driveId: activeDriveId,
          slotId: activeSlotId,
          name: file.name,
          path: relPath,
          extension: file.name.split(".").pop() || "dat",
          sizeBytes: file.size,
          content: file,
          category: "data",
          status: "safe",
          lastModified: file.lastModified,
          signature: `SIG_${Math.random()}`,
          annotations: [],
        };
        if (file.type.startsWith("image/")) nf.category = "media";
        if (file.type.startsWith("audio/") || file.type.startsWith("video/"))
          nf.category = "media";
        if (
          file.name.endsWith(".js") ||
          file.name.endsWith(".ts") ||
          file.name.endsWith(".json")
        )
          nf.category = "code";
        await neuralDB.addFile(nf);
      }
      await loadFiles();
      refreshSlotCounts();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      if (!e.target.files) return;
      await processUpload(e.target.files);
    };

    const handleDriveDrop = async (
      e: React.DragEvent,
      targetDriveId: DriveId,
    ) => {
      e.preventDefault();
      setDragOverDrive(null);
      const fileId = e.dataTransfer.getData("agent-lee-file-id");
      if (fileId) {
        const sourceFile = files.find((f) => f.id === fileId);
        if (!sourceFile || sourceFile.driveId === targetDriveId) return;
        if (!sourceFile.content) return;
        const targetSlot = Math.floor(Math.random() * 8) + 1;
        const newFile: NeuralFile = {
          ...sourceFile,
          id: `${targetDriveId}-${targetSlot}-${Date.now()}-${Math.random()}`,
          driveId: targetDriveId,
          slotId: targetSlot,
          lastModified: Date.now(),
        };
        await neuralDB.addFile(newFile);
        await loadFiles();
      }
    };

    const handleSlotDrop = async (e: React.DragEvent) => {
      e.preventDefault();
      if (!activeSlotId) return;
      const items = e.dataTransfer.items;
      if (items) {
        const scanFiles = async (item: any, path = "") => {
          if (item.isFile) {
            const file = await new Promise<File>((res) => item.file(res));
            Object.defineProperty(file, "webkitRelativePath", {
              value: path + file.name,
            });
            await processUpload([file] as unknown as FileList);
          } else if (item.isDirectory) {
            const reader = item.createReader();
            const readEntries = async () => {
              const entries = await new Promise<any[]>((res) =>
                reader.readEntries(res),
              );
              if (entries.length > 0) {
                for (const entry of entries)
                  await scanFiles(entry, path + item.name + "/");
                await readEntries();
              }
            };
            await readEntries();
          }
        };
        for (let i = 0; i < items.length; i++) {
          const item = items[i].webkitGetAsEntry?.() ?? null;
          if (item) await scanFiles(item);
        }
      } else if (e.dataTransfer.files) {
        await processUpload(e.dataTransfer.files);
      }
    };

    const openFile = (file: NeuralFile) => {
      if (selectionMode) return;
      setActiveFile(file);
      setViewSafeMode(false);
    };

    const openColdArchive = async (archive: ColdArchiveEntry) => {
      const blob = await coldStore.getArchiveBlob(archive.id);
      if (blob) {
        setActiveFile({
          id: archive.id,
          driveId: (archive.originalDriveId || "LEE") as DriveId,
          slotId: archive.originalSlotId || 1,
          name: archive.name,
          path: "",
          extension: archive.name.split(".").pop() || "dat",
          sizeBytes: archive.sizeBytes,
          content: blob,
          category: "archive",
          status: "offloaded",
          lastModified: archive.createdAt,
          signature: "COLD_READ",
          annotations: [],
          externalRef: {
            type: "opfs",
            path: archive.path,
            archiveId: archive.id,
          },
        });
      }
    };

    const deleteColdArchive = async (id: string) => {
      await coldStore.removeArchive(id);
      refreshColdArchives();
    };

    const layoutNodes = useMemo(() => {
      if (!containerRef.current) return [];
      const nodes: LayoutNode[] = [];
      const rect = containerRef.current.getBoundingClientRect();
      const add = (
        id: string,
        type: "drive" | "slot" | "file",
        color: string,
        related?: DriveId[],
        status?: CorruptionStatus,
      ) => {
        const el = nodeRefs.current.get(id);
        if (el) {
          const r = el.getBoundingClientRect();
          nodes.push({
            id,
            type,
            color,
            x: r.left - rect.left,
            y: r.top - rect.top,
            w: r.width,
            h: r.height,
            relatedDrives: related,
            status,
          });
        }
      };
      (Object.keys(DRIVE_COLORS) as unknown as DriveId[]).forEach((d) =>
        add(`drive_${d}`, "drive", DRIVE_COLORS[d]),
      );
      for (let i = 1; i <= 8; i++)
        add(`slot_${activeDriveId}-${i}`, "slot", DRIVE_COLORS[activeDriveId]);
      files.forEach((f) =>
        add(
          `file_${f.id}`,
          "file",
          DRIVE_COLORS[activeDriveId],
          fileRelations[f.id],
          f.status,
        ),
      );
      return nodes;
    }, [dim, tick, files, activeDriveId, activeSlotId, fileRelations]);

    const setRef = (id: string) => (el: HTMLDivElement | null) => {
      if (el) nodeRefs.current.set(id, el);
      else nodeRefs.current.delete(id);
    };

    useImperativeHandle(ref, () => ({
      speak: console.log,
      focusDrive: setActiveDriveId,
    }));

    // --- RENDER MODAL ---
    const renderModalContent = () => {
      if (!activeFile) return null;
      if (activeFile.status === "corrupt") {
        return (
          <div className="w-full max-w-lg bg-black border-2 border-red-600 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.4)] overflow-hidden animate-[fade-in_0.1s_ease-out] relative z-[60]">
            <div className="absolute inset-0 bg-red-900/10 pointer-events-none" />
            <div className="p-6 border-b border-red-900 bg-red-950/30 flex justify-between items-center relative z-10">
              <h3 className="text-xl font-black text-red-500 tracking-widest flex items-center gap-2">
                {" "}
                <span className="animate-pulse">⚠</span> CORRUPTION
                DETECTED{" "}
              </h3>
            </div>
            <div className="p-8 flex flex-col items-center text-center relative z-10">
              <button
                onClick={handleRepair}
                className="py-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all"
              >
                MAKE SAFE (RESTORE)
              </button>
              <button
                onClick={handleDelete}
                className="mt-2 py-3 bg-red-900 hover:bg-red-800 text-white text-xs font-bold rounded tracking-wider transition-colors"
              >
                DELETE FRAGMENT
              </button>
            </div>
            <div className="p-3 bg-red-950/50 border-t border-red-900 flex justify-end">
              <button
                onClick={() => setActiveFile(null)}
                className="text-[10px] text-red-400 hover:text-white uppercase"
              >
                Cancel
              </button>
            </div>
          </div>
        );
      }
      return (
        <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-[fade-in_0.2s_ease-out] z-[60]">
          <div className="p-6 border-b border-slate-900 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <div
                className={`w-3 h-3 rounded-full ${DRIVE_BG_CLASS[activeDriveId]}`}
              />
              <h3 className="text-lg font-bold text-white truncate max-w-[200px]">
                {activeFile.name}
              </h3>
            </div>
          </div>
          <div className="p-8 flex flex-col items-center justify-center min-h-[150px] bg-slate-900/30">
            <MediaPreview file={activeFile} />
            <p className="text-xs text-slate-400 font-mono mb-6">
              {(activeFile.sizeBytes / 1024).toFixed(2)} KB •{" "}
              {activeFile.category.toUpperCase()}
            </p>
            <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
              <button
                onClick={() => handleExport("file", activeFile)}
                className="py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded"
              >
                DOWNLOAD
              </button>
              {activeFile.externalRef?.type !== "handle" ? (
                <button
                  onClick={handleOffload}
                  className="py-3 bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs font-bold rounded"
                >
                  OFFLOAD (LINK)
                </button>
              ) : (
                <div className="py-3 border border-slate-800 text-slate-600 text-xs font-bold rounded flex items-center justify-center">
                  REMOTE FILE
                </div>
              )}
            </div>
          </div>
          <div className="p-4 bg-slate-900/80 border-t border-slate-900 flex justify-between">
            <button
              onClick={handleDelete}
              className="text-[10px] text-red-500 hover:text-red-400 font-bold tracking-widest"
            >
              DELETE NODE
            </button>
            <button
              onClick={() => setActiveFile(null)}
              className="text-[10px] text-slate-500 hover:text-slate-300"
            >
              CLOSE
            </button>
          </div>
        </div>
      );
    };

    return (
      <div
        ref={containerRef}
        className="relative w-full h-[100dvh] bg-black overflow-hidden flex flex-col text-slate-200 select-none font-sans"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleSlotDrop}
      >
        <label
          id="memorylake-upload-files-label"
          htmlFor="memorylake-upload-files"
          className="sr-only"
        >
          Upload files
        </label>
        <input
          id="memorylake-upload-files"
          name="memorylake-upload-files"
          type="file"
          ref={fileInputRef}
          multiple
          className="hidden"
          onChange={handleUpload}
          title="Upload files"
          aria-label="Upload files"
          aria-labelledby="memorylake-upload-files-label"
        />
        <label
          id="memorylake-upload-folder-label"
          htmlFor="memorylake-upload-folder"
          className="sr-only"
        >
          Upload folder
        </label>
        <input
          id="memorylake-upload-folder"
          name="memorylake-upload-folder"
          type="file"
          ref={folderInputRef}
          multiple
          className="hidden"
          onChange={handleUpload}
          title="Upload folder"
          aria-label="Upload folder"
          aria-labelledby="memorylake-upload-folder-label"
          {...({ webkitdirectory: "", directory: "" } as any)}
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900/20 via-black to-black pointer-events-none" />
        <ConnectionLayer
          nodes={layoutNodes}
          w={dim.w}
          h={dim.h}
          activeDrive={activeDriveId}
          activeSlot={activeSlotId}
        />
        <div className="z-30 min-h-16 py-2 flex flex-col md:flex-row items-center justify-between px-2 md:px-6 bg-gradient-to-b from-black via-black/95 to-transparent gap-2 md:gap-0">
          <div className="w-full md:w-auto flex justify-between items-center">
            <div className="flex flex-col">
              <h1 className="text-xs md:text-sm font-black tracking-[0.3em] uppercase text-slate-400">
                Agent Lee
              </h1>
              <div className="text-[9px] text-emerald-500 font-mono">
                NEURAL MEMORY V8.4 (MONOLITH)
              </div>
            </div>
            {/* New Back Button */}
            {onExit && (
              <button
                onClick={onExit}
                className="ml-4 px-3 py-1 border border-slate-700 bg-slate-900/50 text-slate-400 text-[10px] font-bold rounded hover:bg-slate-800 hover:text-white transition-colors flex items-center gap-2"
              >
                <span>←</span> BACK
              </button>
            )}
            <div className="flex gap-2 md:hidden">
              <button
                onClick={() => handleExport("drive")}
                className="px-2 py-1 rounded border border-slate-700 bg-slate-900/50 text-[9px] hover:bg-slate-800 text-slate-400"
              >
                DRIVE
              </button>
            </div>
          </div>
          <div className="w-full md:w-auto flex items-center justify-between md:justify-center gap-1 md:gap-2">
            {(Object.keys(DRIVE_COLORS) as unknown as DriveId[]).map((d) => (
              <div
                key={d}
                ref={setRef(`drive_${d}`)}
                onClick={() => {
                  setActiveDriveId(d);
                  setActiveSlotId(null);
                  setActiveFile(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverDrive(d);
                }}
                onDragLeave={() => setDragOverDrive(null)}
                onDrop={(e) => handleDriveDrop(e, d)}
                className={`w-9 h-9 md:w-12 md:h-12 flex items-center justify-center rounded-lg border cursor-pointer transition-all hover:scale-110 backdrop-blur-md shrink-0 ${DRIVE_TEXT_CLASS[d]} ${activeDriveId === d ? `bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.15)] ${DRIVE_BORDER_CLASS[d]}` : "border-slate-800 bg-black/40 opacity-60 hover:opacity-100"} ${dragOverDrive === d ? `scale-125 shadow-[0_0_30px_rgba(255,255,255,0.5)] z-50 ring-2 ring-white/50 ${DRIVE_BORDER_CLASS[d]}` : ""}`}
              >
                <span className="font-black text-[10px] md:text-xs">{d}</span>
              </div>
            ))}
          </div>
          <div className="hidden md:flex gap-2">
            <button
              onClick={() => handleExport("system")}
              className="px-3 py-1.5 rounded border border-slate-700 bg-slate-900/50 text-[10px] hover:bg-slate-800 text-slate-400"
            >
              EXPORT CORE
            </button>
          </div>
        </div>
        <div className="flex-1 flex min-h-0 relative z-20">
          <div className="w-24 md:w-48 py-4 md:py-8 flex flex-col items-center overflow-y-auto no-scrollbar">
            {Array.from({ length: 8 }, (_, i) => i + 1).map((id) => (
              <div
                key={id}
                ref={setRef(`slot_${activeDriveId}-${id}`)}
                onClick={() => {
                  setActiveSlotId(id);
                  setActiveFile(null);
                }}
                className={`relative w-20 h-14 md:w-32 md:h-20 mb-3 md:mb-4 cursor-pointer transition-all duration-300 group ${id % 2 === 0 ? "translate-x-2 md:translate-x-4" : "-translate-x-1 md:-translate-x-2"}`}
              >
                <div
                  className={`absolute inset-0 skew-x-[-12deg] border-l-4 flex items-center justify-between px-2 md:px-4 backdrop-blur-sm transition-all ${activeSlotId === id ? `bg-white/5 shadow-[0_0_20px_rgba(0,0,0,0.5)] ${DRIVE_TEXT_CLASS[activeDriveId]} ${DRIVE_BORDER_CLASS[activeDriveId]}` : "bg-slate-900/40 border-l-slate-700 hover:bg-slate-800/60 text-[#64748b]"}`}
                >
                  <div>
                    <span className="text-[8px] md:text-[9px] font-mono opacity-50 block">
                      SEC
                    </span>
                    <span className="text-lg md:text-xl font-black italic">
                      0{id}
                    </span>
                  </div>
                  <span className="text-[9px] md:text-[10px] font-mono opacity-70">
                    {slotCounts[id] || 0}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex-1 m-2 md:m-4 p-4 md:p-6 bg-gradient-to-br from-slate-900/10 to-transparent rounded-tl-3xl border-t border-l border-white/5 backdrop-blur-sm flex flex-col relative overflow-hidden">
            {activeSlotId ? (
              <>
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-white/5 pb-4 mb-4 gap-4">
                  <div>
                    <h2
                      className={`text-2xl md:text-3xl font-black tracking-tighter ${DRIVE_TEXT_CLASS[activeDriveId]}`}
                    >
                      SECTOR 0{activeSlotId}
                    </h2>
                    <p className="text-[10px] md:text-xs text-slate-500 font-mono mt-1">
                      {files.length} NODES •{" "}
                      {files.filter((f) => f.status === "offloaded").length}{" "}
                      EXTERNAL •{" "}
                      {files.filter((f) => f.status === "corrupt").length}{" "}
                      CORRUPT
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setSelectionMode(!selectionMode)}
                      className={`px-3 py-1 md:px-4 md:py-2 border rounded-full text-[10px] md:text-xs font-bold transition-all ${selectionMode ? "bg-cyan-900/40 border-cyan-400 text-cyan-400" : "bg-slate-800/50 border-slate-700 text-slate-400"}`}
                    >
                      {selectionMode ? "DONE" : "SELECT MODE"}
                    </button>
                    {!isIOS && (
                      <button
                        onClick={() => folderInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1 md:px-4 md:py-2 bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] md:text-xs font-bold hover:bg-emerald-500/20"
                      >
                        <span>+</span> FOLDER
                      </button>
                    )}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-3 py-1 md:px-4 md:py-2 bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 rounded-full text-[10px] md:text-xs font-bold hover:bg-emerald-500/20"
                    >
                      <span>+</span> FILE
                    </button>
                    <button
                      onClick={() => handleExport("slot")}
                      className="px-2 py-1 md:px-3 md:py-2 bg-slate-800/50 border border-slate-700 text-slate-300 rounded text-[10px] md:text-xs font-bold hover:bg-slate-700"
                    >
                      EXP SLOT
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 content-start pb-20">
                  {files.map((f) => (
                    <FileCard
                      key={f.id}
                      file={f}
                      activeDriveId={activeDriveId}
                      fileRelations={fileRelations}
                      onOpen={openFile}
                      onRename={handleRename}
                      setRef={setRef}
                      isSelected={selectedIds.has(f.id)}
                      selectionMode={selectionMode}
                      toggleSelection={toggleSelection}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none">
                <div className="w-32 h-32 md:w-40 md:h-40 border border-slate-700 rounded-full flex items-center justify-center animate-[spin_10s_linear_infinite]">
                  <div className="w-24 h-24 md:w-32 md:h-32 border border-slate-600 rounded-full border-t-transparent" />
                </div>
                <p className="mt-8 font-mono tracking-[0.2em] text-slate-500 text-xs md:text-base">
                  AWAITING SECTOR LINK
                </p>
              </div>
            )}
            {selectedIds.size > 0 && (
              <div className="absolute bottom-4 left-4 right-4 bg-slate-900/90 border border-cyan-500/30 backdrop-blur-md rounded-xl p-3 flex items-center justify-between z-40 shadow-2xl animate-[fade-in_0.2s_ease-out]">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-500/20 flex items-center justify-center border border-cyan-500/50 text-cyan-400 font-bold text-xs">
                    {selectedIds.size}
                  </div>
                  <div className="text-xs text-slate-300 font-mono hidden md:block">
                    NODES SELECTED
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={selectAll}
                    className="px-3 py-2 bg-slate-800 hover:bg-slate-700 rounded text-[10px] font-bold text-slate-300"
                  >
                    ALL
                  </button>
                  <button
                    onClick={() => handleExport("selected")}
                    className="px-3 py-2 bg-emerald-900/30 border border-emerald-500/30 hover:bg-emerald-500/20 rounded text-[10px] font-bold text-emerald-400"
                  >
                    EXPORT ZIP
                  </button>
                  <button
                    onClick={handleBatchOffload}
                    className="px-3 py-2 bg-indigo-900/30 border border-indigo-500/30 hover:bg-indigo-500/20 rounded text-[10px] font-bold text-indigo-400"
                  >
                    OFFLOAD
                  </button>
                  <button
                    onClick={handleBatchDelete}
                    className="px-3 py-2 bg-red-900/30 border border-red-500/30 hover:bg-red-500/20 rounded text-[10px] font-bold text-red-400"
                  >
                    DELETE
                  </button>
                </div>
              </div>
            )}
            {coldArchives.length > 0 && !selectedIds.size && (
              <div className="mt-4 border-t border-slate-800 pt-2 shrink-0">
                <div className="text-[9px] font-mono text-slate-500 mb-2 uppercase tracking-widest">
                  Cold Archive Registry ({coldArchives.length})
                </div>
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {coldArchives.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 rounded px-2 py-1 shrink-0 group hover:border-emerald-500/30 transition-colors cursor-pointer"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-900 group-hover:bg-emerald-500 transition-colors" />
                      <span className="text-[10px] text-slate-400 font-mono truncate max-w-[100px]">
                        {a.name}
                      </span>
                      <span className="text-[9px] text-slate-600">
                        {(a.sizeBytes / 1024).toFixed(0)}K
                      </span>
                      <button
                        onClick={() => openColdArchive(a)}
                        className="text-[9px] text-cyan-500 hover:text-white ml-1 px-1"
                      >
                        OPEN
                      </button>
                      <button
                        onClick={() => deleteColdArchive(a.id)}
                        className="text-[9px] text-red-900 hover:text-red-500 ml-1 px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
        {activeFile && (
          <div
            className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-default"
            onClick={(e) => e.target === e.currentTarget && setActiveFile(null)}
          >
            {renderModalContent()}
          </div>
        )}
      </div>
    );
  },
);

export const MemoryLake: React.FC = () => <MemoryLakeCore />;

export default MemoryLake;
