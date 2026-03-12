/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.LEEVM.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = LeeVM module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\LeeVM.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// LEEWAY v12 HEADER
// File: .Agent_Lee_OS/components/LeeVM.tsx
// Purpose: Agent Lee's personal sandboxed computer — LEE_VM_01.
//          Full OS environment: windowed terminal, Monaco editor, multi-engine
//          web browser, VFS explorer backed by /api/vm/vfs, and a Sandbox panel
//          for copy → build → test → present → apply workflows.
//          VM-FIRST policy: all create/edit/build tasks happen here first.
// Security: All mutations go through /api/vm with NEURAL_HANDSHAKE header.
//           Apply step guarded. No direct host FS access from this component.
// Discovery: ROLE=ui; INTENT=agent-sandbox-os; REGION=💻 VM

import Editor from "@monaco-editor/react";
import { AnimatePresence, motion } from "framer-motion";
import {
    AlertCircle,
    ArrowLeft,
    CheckCircle,
    Clock,
    Code,
    Cpu,
    Download,
    FilePlus,
    FolderPlus,
    Globe,
    Layers,
    Maximize2,
    Minus,
    Monitor,
    PackageCheck,
    Play,
    Power,
    RotateCcw,
    Save,
    Search,
    Shield,
    Square,
    Terminal as TerminalIcon,
    Trash2,
    Upload,
    Wifi,
    X,
    Zap,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────
export interface VFSFile {
  name: string;
  content?: string;
  type: "file";
  path: string;
  size?: number;
  modified?: string;
}

export interface VFSDirectory {
  name: string;
  type: "dir";
  path: string;
  children: (VFSFile | VFSDirectory)[];
}

export type VFSItem = VFSFile | VFSDirectory;

export interface WindowState {
  id: string;
  type: "terminal" | "editor" | "web" | "explorer" | "sandbox";
  title: string;
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  position: { x: number; y: number };
  size: { width: number; height: number };
  data?: any;
}

interface OSState {
  windows: WindowState[];
  activeWindowId: string | null;
  vfs: VFSDirectory;
}

interface SandboxJob {
  id: string;
  cmd: string;
  cwd: string;
  status: "running" | "done" | "error";
  started: string;
  ended?: string;
  exitCode?: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────
const cn = (...args: any[]) => args.filter(Boolean).join(" ");

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

// ── Local VFS fallback (shown when backend is offline) ────────────────────
const INITIAL_VFS: VFSDirectory = {
  name: "root",
  type: "dir",
  path: "/",
  children: [
    {
      name: "home",
      type: "dir",
      path: "/home",
      children: [
        {
          name: "agent_lee",
          type: "dir",
          path: "/home/agent_lee",
          children: [
            {
              name: "welcome.txt",
              type: "file",
              path: "/home/agent_lee/welcome.txt",
              content:
                "Welcome to Agent Lee VM — LEE_VM_01\nPolicy: VM-First\nAll tasks run here before any real files are touched.",
            },
            {
              name: "scripts",
              type: "dir",
              path: "/home/agent_lee/scripts",
              children: [],
            },
            {
              name: "projects",
              type: "dir",
              path: "/home/agent_lee/projects",
              children: [],
            },
            {
              name: "output",
              type: "dir",
              path: "/home/agent_lee/output",
              children: [],
            },
          ],
        },
      ],
    },
    { name: "tmp", type: "dir", path: "/tmp", children: [] },
  ],
};

// ── Window Chrome ──────────────────────────────────────────────────────────
const VMWindow: React.FC<{
  id: string;
  title: string;
  active: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  onFocus: () => void;
  children: React.ReactNode;
  initialPosition: { x: number; y: number };
  initialSize: { width: number; height: number };
}> = ({
  title,
  active,
  isMinimized,
  isMaximized,
  zIndex,
  onClose,
  onMinimize,
  onMaximize,
  onFocus,
  children,
  initialPosition,
  initialSize,
}) => {
  if (isMinimized) return null;
  return (
    <motion.div
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        x: isMaximized ? 0 : initialPosition.x,
        y: isMaximized ? 0 : initialPosition.y,
        width: isMaximized ? "100%" : initialSize.width,
        height: isMaximized ? "100%" : initialSize.height,
      }}
      transition={{ duration: 0.9, ease: "easeInOut" }}
      style={{ zIndex }}
      onClick={onFocus}
      className={cn(
        "absolute bg-[#0c0c0c] flex flex-col overflow-hidden shadow-2xl transition-all duration-200",
        active
          ? "border-blue-500/50 shadow-blue-500/20"
          : "border-white/10 shadow-black",
        isMaximized ? "rounded-none border-0" : "rounded-xl border",
      )}
    >
      {/* Title bar */}
      <div
        className={cn(
          "h-10 px-4 flex items-center justify-between shrink-0 cursor-default select-none",
          active ? "bg-zinc-900" : "bg-zinc-950",
        )}
      >
        <div className="flex items-center gap-3 overflow-hidden">
          <div
            className={cn(
              "w-2 h-2 rounded-full shrink-0",
              active ? "bg-blue-500" : "bg-zinc-700",
            )}
          />
          <span
            className={cn(
              "text-[10px] font-bold uppercase tracking-widest truncate",
              active ? "text-zinc-200" : "text-zinc-500",
            )}
          >
            {title}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {!isMaximized && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onMinimize();
              }}
              title="Minimise"
              className="p-1.5 hover:bg-white/5 rounded text-zinc-500 transition-colors"
            >
              <Minus size={14} />
            </button>
          )}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onMaximize();
            }}
            title={isMaximized ? "Restore" : "Maximise"}
            className="p-1.5 hover:bg-white/5 rounded text-zinc-500 transition-colors"
          >
            {isMaximized ? <Square size={12} /> : <Maximize2 size={12} />}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Close"
            className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded text-zinc-500 transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>
      <div className="flex-grow overflow-hidden relative">{children}</div>
    </motion.div>
  );
};

// ── VM Terminal ────────────────────────────────────────────────────────────
const VMTerminal: React.FC = () => {
  const outputRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = useState(
    "Agent Lee VM Terminal — LEE_VM_01\nPolicy: VM-FIRST | All commands sandboxed\n\n$ ",
  );
  const [input, setInput] = useState("");

  const run = async (cmd: string) => {
    if (!cmd.trim()) return;
    setOutput((p) => p + cmd + "\n");
    setInput("");
    try {
      const res = await vmFetch("/api/vm/sandbox/exec", {
        method: "POST",
        body: JSON.stringify({ cmd, cwd: "/home/agent_lee" }),
      });
      const data = await res.json();
      if (data.jobId) {
        setOutput((p) => p + `[Job ${data.jobId.slice(0, 8)}…] started\n`);
        const poll = async () => {
          const r2 = await vmFetch(`/api/vm/sandbox/jobs/${data.jobId}`);
          const d2 = await r2.json();
          if (d2.log) setOutput((p) => p + d2.log);
          if (d2.job?.status === "running") {
            setTimeout(poll, 1000);
          } else {
            setOutput((p) => p + `\n[exit ${d2.job?.exitCode ?? "?"}]\n$ `);
          }
        };
        setTimeout(poll, 800);
      } else if (data.error) {
        setOutput((p) => p + `Error: ${data.error}\n$ `);
      } else {
        setOutput((p) => p + "$ ");
      }
    } catch {
      setOutput((p) => p + "Error: VM backend unreachable\n$ ");
    }
  };

  useEffect(() => {
    if (outputRef.current)
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output]);

  return (
    <div className="h-full flex flex-col bg-[#0c0c0c] font-mono">
      <div
        ref={outputRef}
        className="flex-grow overflow-y-auto p-4 text-green-300 text-[11px] leading-relaxed whitespace-pre-wrap"
      >
        {output}
      </div>
      <div className="h-10 border-t border-white/5 flex items-center px-4 gap-2 bg-zinc-950 shrink-0">
        <span className="text-green-500 text-[11px]">$ </span>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") run(input);
          }}
          placeholder="Type command and press Enter…"
          className="flex-grow bg-transparent outline-none text-green-300 text-[11px]"
          autoFocus
        />
      </div>
    </div>
  );
};

// ── Code Editor ────────────────────────────────────────────────────────────
const VMCodeEditor: React.FC<{
  vfs: VFSDirectory;
  filePath: string;
  onSave: () => void;
}> = ({ vfs, filePath, onSave }) => {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    vmFetch(`/api/vm/vfs/read?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.content != null) setContent(d.content);
      })
      .catch(() => {
        const find = (dir: VFSDirectory, p: string): VFSItem | null => {
          if (dir.path === p) return dir;
          for (const c of dir.children) {
            if (c.path === p) return c;
            if (c.type === "dir") {
              const r = find(c, p);
              if (r) return r;
            }
          }
          return null;
        };
        const item = find(vfs, filePath);
        if (item?.type === "file" && item.content != null)
          setContent(item.content);
      });
  }, [filePath]);

  const save = async () => {
    setSaving(true);
    try {
      await vmFetch("/api/vm/vfs/write", {
        method: "POST",
        body: JSON.stringify({ path: filePath, content }),
      });
      onSave();
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  const ext = filePath.split(".").pop() || "";
  const langMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    json: "json",
    md: "markdown",
    css: "css",
    html: "html",
    sh: "shell",
  };

  return (
    <div className="h-full flex flex-col bg-[#1e1e1e]">
      <div className="h-10 bg-zinc-900 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest truncate max-w-[240px]">
          {filePath}
        </span>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-[10px] font-bold rounded transition-all"
        >
          <Save size={12} />
          {saving ? "SAVING…" : "SAVE TO VM"}
        </button>
      </div>
      <div className="flex-grow">
        <Editor
          height="100%"
          language={langMap[ext] || "plaintext"}
          theme="vs-dark"
          value={content}
          onChange={(v: string | undefined) => setContent(v || "")}
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            padding: { top: 12 },
            fontFamily: "JetBrains Mono, Fira Code, monospace",
            lineNumbers: "on",
            wordWrap: "on",
            renderWhitespace: "boundary",
          }}
        />
      </div>
    </div>
  );
};

// ── File Explorer ──────────────────────────────────────────────────────────
const VMFileExplorer: React.FC<{
  vfs: VFSDirectory;
  onOpenFile: (path: string) => void;
  onRefresh: () => void;
}> = ({ vfs, onOpenFile, onRefresh }) => {
  const [currentPath, setCurrentPath] = useState("/");
  const [creating, setCreating] = useState<"file" | "dir" | null>(null);
  const [newName, setNewName] = useState("");

  const findDir = (dir: VFSDirectory, p: string): VFSDirectory | null => {
    if (dir.path === p || (p === "/" && dir.name === "root")) return dir;
    for (const c of dir.children) {
      if (c.type === "dir") {
        const r = findDir(c, p);
        if (r) return r;
      }
    }
    return null;
  };

  const current = findDir(vfs, currentPath) || vfs;

  const goUp = () => {
    if (currentPath === "/") return;
    const parts = currentPath.split("/").filter(Boolean);
    parts.pop();
    setCurrentPath(parts.length === 0 ? "/" : "/" + parts.join("/"));
  };

  const create = async () => {
    if (!newName.trim() || !creating) return;
    const p = `${currentPath === "/" ? "" : currentPath}/${newName.trim()}`;
    if (creating === "dir") {
      await vmFetch("/api/vm/vfs/mkdir", {
        method: "POST",
        body: JSON.stringify({ path: p }),
      });
    } else {
      await vmFetch("/api/vm/vfs/write", {
        method: "POST",
        body: JSON.stringify({ path: p, content: "" }),
      });
    }
    setCreating(null);
    setNewName("");
    onRefresh();
  };

  const del = async (item: VFSItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    await vmFetch("/api/vm/vfs/rm", {
      method: "DELETE",
      body: JSON.stringify({ path: item.path }),
    });
    onRefresh();
  };

  return (
    <div className="h-full flex flex-col bg-[#0c0c0c] text-zinc-300">
      {/* Toolbar */}
      <div className="h-12 bg-zinc-900/60 border-b border-white/5 flex items-center px-3 gap-2 shrink-0">
        <button
          onClick={goUp}
          disabled={currentPath === "/"}
          title="Go up"
          className="p-1.5 hover:bg-white/5 rounded disabled:opacity-30"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          onClick={onRefresh}
          title="Refresh"
          className="p-1.5 hover:bg-white/5 rounded text-blue-400"
        >
          <RotateCcw size={14} />
        </button>
        <div className="flex-grow px-2 py-1 bg-black/40 rounded border border-white/5 text-[10px] font-mono text-zinc-400 truncate">
          {currentPath}
        </div>
        <button
          onClick={() => setCreating("dir")}
          className="p-1.5 hover:bg-white/5 rounded text-yellow-400"
          title="New folder"
        >
          <FolderPlus size={14} />
        </button>
        <button
          onClick={() => setCreating("file")}
          className="p-1.5 hover:bg-white/5 rounded text-blue-400"
          title="New file"
        >
          <FilePlus size={14} />
        </button>
      </div>

      {creating && (
        <div className="px-4 py-2 bg-zinc-900 border-b border-white/5 flex items-center gap-2 shrink-0">
          <span className="text-[10px] text-zinc-400">
            {creating === "dir" ? "New folder:" : "New file:"}
          </span>
          <input
            autoFocus
            value={newName}
            title={creating === "dir" ? "New folder name" : "New file name"}
            placeholder={creating === "dir" ? "folder-name" : "file.txt"}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") create();
              if (e.key === "Escape") setCreating(null);
            }}
            className="flex-grow bg-black/60 border border-white/10 rounded px-2 py-1 text-xs text-white outline-none"
          />
          <button
            onClick={create}
            className="px-2 py-1 bg-blue-600 text-[10px] font-bold text-white rounded"
          >
            OK
          </button>
          <button
            onClick={() => setCreating(null)}
            aria-label="Cancel"
            title="Cancel"
            className="px-2 py-1 text-[10px] text-zinc-500"
          >
            ✕
          </button>
        </div>
      )}

      <div className="flex-grow overflow-y-auto p-4">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
          {current.children.map((item, i) => (
            <div key={i} className="group relative">
              <button
                onClick={() =>
                  item.type === "dir"
                    ? setCurrentPath(item.path)
                    : onOpenFile(item.path)
                }
                className="w-full flex flex-col items-center gap-2 p-3 rounded-xl hover:bg-white/5 transition-all"
              >
                <div
                  className={cn(
                    "w-11 h-11 flex items-center justify-center rounded-xl shadow-lg transition-transform group-hover:scale-105",
                    item.type === "dir"
                      ? "text-yellow-500 bg-yellow-500/10"
                      : "text-blue-400 bg-blue-400/10",
                  )}
                >
                  {item.type === "dir" ? (
                    <FolderPlus size={24} />
                  ) : (
                    <Code size={24} />
                  )}
                </div>
                <span className="text-[9px] font-bold truncate w-full text-center text-zinc-300">
                  {item.name}
                </span>
              </button>
              <button
                onClick={() => del(item)}
                title={`Delete ${item.name}`}
                className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-400 transition-all"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
          {current.children.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-16 text-zinc-700">
              <FolderPlus size={36} strokeWidth={1} />
              <p className="text-[10px] uppercase tracking-widest mt-3 opacity-50">
                Empty directory
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Web Browser — 7 Engines ────────────────────────────────────────────────
type SearchEngine =
  | "duckduckgo"
  | "wikipedia"
  | "brave"
  | "whoogle"
  | "bing"
  | "google"
  | "searxng";
const ENGINES: { id: SearchEngine; label: string }[] = [
  { id: "whoogle", label: "WHOOGLE" },
  { id: "duckduckgo", label: "DUCKDUCKGO" },
  { id: "wikipedia", label: "WIKIPEDIA" },
  { id: "brave", label: "BRAVE" },
  { id: "bing", label: "BING" },
  { id: "searxng", label: "SEARXNG" },
  { id: "google", label: "GOOGLE" },
];

const BOOKMARKS = [
  { n: "GitHub", u: "https://github.com" },
  { n: "Stack Overflow", u: "https://stackoverflow.com" },
  { n: "MDN Docs", u: "https://developer.mozilla.org" },
  { n: "NPM", u: "https://npmjs.com" },
  { n: "Ollama", u: "https://ollama.com" },
  { n: "Hugging Face", u: "https://huggingface.co" },
];

const VMBrowser: React.FC = () => {
  const [engine, setEngine] = useState<SearchEngine>("duckduckgo");
  const [url, setUrl] = useState("home");
  const [inputVal, setInputVal] = useState("");
  const [results, setResults] = useState<
    { title: string; link: string; snippet: string }[]
  >([]);
  const [loading, setLoading] = useState(false);

  const navigate = (val: string) => {
    const v = val.trim();
    if (!v) return;
    if (v.startsWith("http://") || v.startsWith("https://")) {
      setUrl(v);
      setResults([]);
      return;
    }
    if (v.includes(".") && !v.includes(" ")) {
      setUrl(`https://${v}`);
      setResults([]);
      return;
    }
    search(v);
  };

  const [searchError, setSearchError] = useState<string | null>(null);

  const search = async (q: string) => {
    setLoading(true);
    setSearchError(null);
    try {
      const res = await vmFetch(
        `/api/search?q=${encodeURIComponent(q)}&engine=${engine}`,
      );
      if (!res.ok) {
        const errMap: Record<number, string> = {
          401: "Auth failed — handshake missing or invalid.",
          403: "Access denied — Safe Mode or Guardian policy blocked this host.",
          429: "Rate limited — too many search requests. Wait a moment.",
          502: "Search proxy error — upstream engine unreachable.",
        };
        setSearchError(
          errMap[res.status] ||
            `Search failed (HTTP ${res.status}). Check backend logs.`,
        );
        setUrl(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
        return;
      }
      const data = await res.json();
      if (data.results?.length) setResults(data.results);
      setUrl(
        data.url ||
          `https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`,
      );
    } catch (err) {
      setSearchError("Network error — backend may be offline.");
      setUrl(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(q)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-zinc-50 text-zinc-900">
      {/* Engine tab bar */}
      <div className="h-8 bg-zinc-200/80 flex items-end px-2 gap-0.5 shrink-0 overflow-x-auto scrollbar-none">
        {ENGINES.map((e) => (
          <button
            key={e.id}
            onClick={() => setEngine(e.id)}
            className={cn(
              "h-7 px-3 rounded-t text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              engine === e.id
                ? "bg-white text-zinc-800 shadow-sm"
                : "text-zinc-500 hover:bg-white/50",
            )}
          >
            {e.label}
          </button>
        ))}
      </div>

      {/* Address bar */}
      <div className="h-10 bg-white border-b border-zinc-200 flex items-center px-3 gap-2 shrink-0">
        <button
          onClick={() => {
            setUrl("home");
            setResults([]);
          }}
          title="Home"
          className="p-1 text-zinc-400 hover:text-zinc-600"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          onClick={() => navigate(inputVal || url)}
          title="Reload"
          className="p-1 text-zinc-400 hover:text-zinc-600"
        >
          <RotateCcw size={14} />
        </button>
        <div className="flex-grow h-7 bg-zinc-100 border border-zinc-200 rounded-full flex items-center px-3 gap-1.5">
          <Search size={12} className="text-zinc-400 shrink-0" />
          <input
            value={inputVal}
            placeholder={
              loading
                ? "Searching…"
                : `Search ${engine.toUpperCase()} or enter URL`
            }
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                navigate(inputVal);
                setInputVal("");
              }
            }}
            className="flex-grow bg-transparent outline-none text-xs text-zinc-700"
          />
        </div>
        {url !== "home" && (
          <button
            onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
            className="p-1 text-zinc-400 hover:text-blue-500"
            title="Open in real browser"
          >
            <Maximize2 size={13} />
          </button>
        )}
      </div>

      {/* Search error banner */}
      {searchError && (
        <div className="bg-red-50 border-b border-red-200 px-3 py-1.5 flex items-center gap-2 shrink-0">
          <AlertCircle size={12} className="text-red-500 shrink-0" />
          <span className="text-[10px] text-red-700 flex-grow">
            {searchError}
          </span>
          <button
            onClick={() => setSearchError(null)}
            aria-label="Dismiss error"
            title="Dismiss error"
            className="text-red-400 hover:text-red-600"
          >
            <X size={11} />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-grow overflow-hidden flex min-h-0">
        {/* Sidebar results */}
        {results.length > 0 && (
          <div className="w-52 border-r border-zinc-200 bg-zinc-50 overflow-y-auto p-3 shrink-0 space-y-3 hidden lg:block">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-2">
              {engine.toUpperCase()} Results
            </p>
            {results.map((r, i) => (
              <div key={i}>
                <a
                  href={r.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] font-bold text-blue-600 hover:underline line-clamp-2 block"
                >
                  {r.title}
                </a>
                <p className="text-[9px] text-zinc-500 line-clamp-2 mt-0.5">
                  {r.snippet}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Main view */}
        {url === "home" ? (
          <div className="flex-grow flex flex-col items-center justify-center p-8 text-center">
            <div className="text-4xl font-black tracking-tight text-zinc-200 mb-1">
              LEE BROWSER
            </div>
            <p className="text-[10px] text-zinc-400 uppercase tracking-widest mb-8">
              7 Engines • Privacy-First • VM Policy Enforced
            </p>
            <div className="w-full max-w-md relative">
              <Search
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
                size={18}
              />
              <input
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter")
                    search((e.target as HTMLInputElement).value);
                }}
                className="w-full h-11 pl-11 pr-4 rounded-full border border-zinc-200 shadow-sm text-sm outline-none focus:border-blue-300 focus:shadow-md"
                placeholder={`Search with ${engine.toUpperCase()}…`}
              />
            </div>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              {BOOKMARKS.map((b) => (
                <button
                  key={b.n}
                  onClick={() => setUrl(b.u)}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-full text-xs font-medium text-zinc-600 transition-colors"
                >
                  {b.n}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-grow flex flex-col overflow-hidden min-h-0">
            <iframe
              src={url}
              className="flex-grow border-none w-full"
              title="Lee VM Browser"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
            />
            <div className="h-7 bg-zinc-100 border-t border-zinc-200 flex items-center justify-between px-3 shrink-0">
              <p className="text-[9px] text-zinc-400 font-mono truncate">
                {url}
              </p>
              <button
                aria-label="Open externally"
                title="Open externally"
                onClick={() =>
                  window.open(url, "_blank", "noopener,noreferrer")
                }
                className="text-[9px] text-blue-500 hover:underline font-bold whitespace-nowrap"
              >
                Open externally
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Sandbox Control Panel ──────────────────────────────────────────────────
const SandboxPanel: React.FC<{ onRefreshVFS: () => void }> = ({
  onRefreshVFS,
}) => {
  const [activeTab, setActiveTab] = useState<"copy" | "run" | "jobs" | "apply">(
    "copy",
  );
  const [jobs, setJobs] = useState<SandboxJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<SandboxJob | null>(null);
  const [jobLog, setJobLog] = useState("");
  const [copyForm, setCopyForm] = useState({ realPath: "", name: "" });
  const [execForm, setExecForm] = useState({ cmd: "", cwd: "/home/agent_lee" });
  const [applyForm, setApplyForm] = useState({ vmPath: "", realPath: "" });
  const [status, setStatus] = useState("");

  const refreshJobs = useCallback(async () => {
    try {
      const r = await vmFetch("/api/vm/sandbox/jobs");
      if (r.ok) setJobs(await r.json());
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    refreshJobs();
    const id = setInterval(refreshJobs, 3000);
    return () => clearInterval(id);
  }, [refreshJobs]);

  const loadJobLog = async (job: SandboxJob) => {
    setSelectedJob(job);
    const r = await vmFetch(`/api/vm/sandbox/jobs/${job.id}`);
    const d = await r.json();
    setJobLog(d.log || "(no output yet)");
  };

  const copyProject = async () => {
    if (!copyForm.realPath.trim()) return;
    setStatus("Copying project into VM…");
    try {
      const r = await vmFetch("/api/vm/sandbox/copy", {
        method: "POST",
        body: JSON.stringify(copyForm),
      });
      const d = await r.json();
      setStatus(d.ok ? `✓ Copied to ${d.vmPath}` : `✗ ${d.error}`);
      if (d.ok) onRefreshVFS();
    } catch {
      setStatus("✗ Backend unreachable");
    }
  };

  const execCmd = async () => {
    if (!execForm.cmd.trim()) return;
    setStatus("Launching job…");
    try {
      const r = await vmFetch("/api/vm/sandbox/exec", {
        method: "POST",
        body: JSON.stringify(execForm),
      });
      const d = await r.json();
      setStatus(
        d.jobId ? `✓ Job ${d.jobId.slice(0, 8)} running` : `✗ ${d.error}`,
      );
      if (d.jobId) {
        refreshJobs();
        setActiveTab("jobs");
      }
    } catch {
      setStatus("✗ Backend unreachable");
    }
  };

  const applyToReal = async () => {
    if (!applyForm.vmPath.trim() || !applyForm.realPath.trim()) return;
    setStatus("Applying to real filesystem…");
    try {
      const r = await vmFetch("/api/vm/sandbox/apply", {
        method: "POST",
        body: JSON.stringify(applyForm),
      });
      const d = await r.json();
      setStatus(d.ok ? `✓ Applied → ${d.realPath}` : `✗ ${d.error}`);
    } catch {
      setStatus("✗ Backend unreachable");
    }
  };

  const QUICK_CMDS = [
    "npm install",
    "npm run build",
    "npm test",
    "npm run lint",
    "python --version",
  ];

  const tabBtn = (
    id: typeof activeTab,
    label: string,
    ico: React.ReactNode,
  ) => (
    <button
      onClick={() => setActiveTab(id)}
      className={cn(
        "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all",
        activeTab === id
          ? "bg-blue-600 text-white"
          : "text-zinc-500 hover:bg-white/5",
      )}
    >
      {ico}
      {label}
    </button>
  );

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a] text-zinc-300">
      {/* Header */}
      <div className="h-12 bg-zinc-900 border-b border-white/5 flex items-center gap-2.5 px-4 shrink-0">
        <Layers size={16} className="text-blue-400" />
        <span className="text-xs font-black uppercase tracking-widest text-zinc-100">
          Sandbox Control
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          {jobs.filter((j) => j.status === "running").length > 0 && (
            <span className="animate-pulse text-[9px] text-yellow-400 font-bold uppercase">
              {jobs.filter((j) => j.status === "running").length} running
            </span>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-white/5 shrink-0 overflow-x-auto">
        {tabBtn("copy", "Copy Project", <Download size={10} />)}
        {tabBtn("run", "Run", <Play size={10} />)}
        {tabBtn("jobs", "Jobs", <Clock size={10} />)}
        {tabBtn("apply", "Apply", <PackageCheck size={10} />)}
      </div>

      {/* Status */}
      {status && (
        <div
          className={`px-4 py-1.5 bg-zinc-900/80 border-b border-white/5 text-[10px] font-mono truncate shrink-0 ${
            status.startsWith("✓")
              ? "text-emerald-400"
              : status.startsWith("✗")
                ? "text-red-400"
                : "text-neutral-400"
          }`}
        >
          {status}
        </div>
      )}

      {/* Content */}
      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        {activeTab === "copy" && (
          <>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
              Copy a real project into the VM sandbox before touching any files.
            </p>
            <label className="block space-y-1">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                Host Path
              </span>
              <input
                value={copyForm.realPath}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, realPath: e.target.value }))
                }
                placeholder="C:\Tools\MyProject or ./backend"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500 font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                Project Name (auto if empty)
              </span>
              <input
                value={copyForm.name}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, name: e.target.value }))
                }
                placeholder="my-project"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500 font-mono"
              />
            </label>
            <button
              onClick={copyProject}
              className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              <Download size={13} /> Copy to VM Sandbox
            </button>
          </>
        )}

        {activeTab === "run" && (
          <>
            <p className="text-[10px] text-zinc-500 uppercase tracking-widest leading-relaxed">
              Run build, test or install commands inside the VM sandbox.
            </p>
            <label className="block space-y-1">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                Command
              </span>
              <input
                value={execForm.cmd}
                onChange={(e) =>
                  setExecForm((f) => ({ ...f, cmd: e.target.value }))
                }
                placeholder="npm run build"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500 font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                Working Directory
              </span>
              <input
                value={execForm.cwd}
                onChange={(e) =>
                  setExecForm((f) => ({ ...f, cwd: e.target.value }))
                }
                placeholder="/home/agent_lee/projects/my-project"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-blue-500 font-mono"
              />
            </label>
            <div className="flex flex-wrap gap-2">
              {QUICK_CMDS.map((cmd) => (
                <button
                  key={cmd}
                  onClick={() => setExecForm((f) => ({ ...f, cmd }))}
                  className="px-2 py-1 bg-zinc-800 hover:bg-zinc-700 rounded text-[9px] font-mono text-zinc-400 transition-all"
                >
                  {cmd}
                </button>
              ))}
            </div>
            <button
              onClick={execCmd}
              className="w-full flex items-center justify-center gap-2 py-3 bg-green-700 hover:bg-green-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              <Play size={13} /> Run in VM
            </button>
          </>
        )}

        {activeTab === "jobs" && (
          <>
            <button
              onClick={refreshJobs}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[9px] text-zinc-500 hover:text-zinc-300 hover:bg-white/5 rounded-lg transition-all"
            >
              <RotateCcw size={11} /> Refresh
            </button>
            {jobs.length === 0 && (
              <p className="text-center text-[10px] text-zinc-700 py-8 uppercase tracking-widest">
                No jobs yet
              </p>
            )}
            {jobs.map((job) => (
              <div key={job.id}>
                <button
                  onClick={() => loadJobLog(job)}
                  className={cn(
                    "w-full text-left p-3 rounded-xl border transition-all",
                    selectedJob?.id === job.id
                      ? "border-blue-500/40 bg-blue-500/5"
                      : "border-white/5 hover:border-white/10 bg-zinc-900",
                  )}
                >
                  <div className="flex items-center gap-2">
                    {job.status === "running" && (
                      <Clock
                        size={11}
                        className="text-yellow-400 animate-spin shrink-0"
                      />
                    )}
                    {job.status === "done" && (
                      <CheckCircle
                        size={11}
                        className="text-green-400 shrink-0"
                      />
                    )}
                    {job.status === "error" && (
                      <AlertCircle
                        size={11}
                        className="text-red-400 shrink-0"
                      />
                    )}
                    <span className="text-[10px] font-mono text-zinc-200 truncate flex-grow">
                      {job.cmd}
                    </span>
                    <span
                      className={cn(
                        "text-[9px] font-black uppercase shrink-0",
                        job.status === "running"
                          ? "text-yellow-400"
                          : job.status === "done"
                            ? "text-green-400"
                            : "text-red-400",
                      )}
                    >
                      {job.status}
                    </span>
                  </div>
                  <p className="text-[9px] text-zinc-600 mt-1 font-mono">
                    {job.id.slice(0, 8)} •{" "}
                    {new Date(job.started).toLocaleTimeString()}
                  </p>
                </button>
                {selectedJob?.id === job.id && jobLog && (
                  <div className="mt-1 p-3 bg-zinc-950 rounded-xl border border-white/5">
                    <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-2">
                      Output
                    </p>
                    <pre className="text-[10px] text-green-300 font-mono whitespace-pre-wrap overflow-auto max-h-48">
                      {jobLog}
                    </pre>
                  </div>
                )}
              </div>
            ))}
          </>
        )}

        {activeTab === "apply" && (
          <>
            <div className="p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
              <p className="text-[10px] text-yellow-400 font-black uppercase tracking-wider">
                ⚠ Guarded Operation
              </p>
              <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
                Copies files from VM to the real filesystem. Only run this after
                reviewing and approving all changes.
              </p>
            </div>
            <label className="block space-y-1">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                VM Source Path
              </span>
              <input
                value={applyForm.vmPath}
                onChange={(e) =>
                  setApplyForm((f) => ({ ...f, vmPath: e.target.value }))
                }
                placeholder="/home/agent_lee/projects/my-project"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-orange-500 font-mono"
              />
            </label>
            <label className="block space-y-1">
              <span className="text-[9px] text-zinc-400 uppercase tracking-widest">
                Real Destination
              </span>
              <input
                value={applyForm.realPath}
                onChange={(e) =>
                  setApplyForm((f) => ({ ...f, realPath: e.target.value }))
                }
                placeholder="./src/new-feature"
                className="w-full bg-zinc-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-zinc-100 outline-none focus:border-orange-500 font-mono"
              />
            </label>
            <button
              onClick={applyToReal}
              className="w-full flex items-center justify-center gap-2 py-3 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all"
            >
              <Upload size={13} /> Apply to Real Filesystem
            </button>
          </>
        )}
      </div>
    </div>
  );
};

// ── Desktop Icon ───────────────────────────────────────────────────────────
const VMIcon: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
}> = ({ icon, label, onClick }) => (
  <button
    onClick={onClick}
    className="group flex flex-col items-center gap-1.5 p-2 rounded-xl hover:bg-white/5 active:scale-95 transition-all w-16"
  >
    <div className="w-10 h-10 bg-zinc-800/80 border border-white/10 rounded-xl flex items-center justify-center text-zinc-300 group-hover:text-white group-hover:bg-zinc-700 transition-all shadow-lg">
      {icon}
    </div>
    <span className="text-[8px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-300 truncate w-full text-center">
      {label}
    </span>
  </button>
);

// ── Main LeeVM Component ───────────────────────────────────────────────────
export const LeeVM: React.FC = () => {
  const [os, setOs] = useState<OSState>({
    windows: [],
    activeWindowId: null,
    vfs: INITIAL_VFS,
  });
  const [time, setTime] = useState(new Date());
  const [isPowerOn, setIsPowerOn] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [vmStatus, setVmStatus] = useState({ runningJobs: 0, ready: false });
  const bootedRef = useRef(false);

  const fetchVFS = useCallback(async () => {
    try {
      const r = await vmFetch("/api/vm/vfs?path=/");
      if (r.ok) {
        const vfs = await r.json();
        setOs((p) => ({ ...p, vfs }));
      }
    } catch {
      /* use local fallback */
    }
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const r = await vmFetch("/api/vm/status");
      if (r.ok) setVmStatus(await r.json());
    } catch {
      /* offline */
    }
  }, []);

  useEffect(() => {
    fetchVFS();
    fetchStatus();
  }, []);
  useEffect(() => {
    const id = setInterval(fetchStatus, 5000);
    return () => clearInterval(id);
  }, [fetchStatus]);
  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const openWindow = useCallback(
    (type: WindowState["type"], title: string, data?: any) => {
      const id = `${type}_${Date.now()}`;
      const offset = os.windows.length;
      setOs((prev) => ({
        ...prev,
        activeWindowId: id,
        windows: [
          ...prev.windows,
          {
            id,
            type,
            title,
            data,
            isOpen: true,
            isMinimized: false,
            isMaximized: isMobile,
            zIndex: offset + 10,
            position: isMobile
              ? { x: 0, y: 0 }
              : { x: 50 + offset * 20, y: 50 + offset * 20 },
            size: isMobile
              ? { width: window.innerWidth, height: window.innerHeight - 80 }
              : type === "sandbox"
                ? { width: 520, height: 640 }
                : { width: 820, height: 560 },
          },
        ],
      }));
    },
    [os.windows.length, isMobile],
  );

  // Auto-open terminal on first boot
  useEffect(() => {
    if (isPowerOn && !bootedRef.current) {
      bootedRef.current = true;
      openWindow("terminal", "Agent Lee Terminal");
    }
  }, [isPowerOn]);

  const closeWindow = (id: string) =>
    setOs((p) => ({
      ...p,
      windows: p.windows.filter((w) => w.id !== id),
      activeWindowId:
        p.activeWindowId === id
          ? p.windows.find((w) => w.id !== id)?.id || null
          : p.activeWindowId,
    }));

  const focusWindow = (id: string) =>
    setOs((p) => {
      const maxZ = Math.max(...p.windows.map((w) => w.zIndex), 9);
      return {
        ...p,
        activeWindowId: id,
        windows: p.windows.map((w) =>
          w.id === id ? { ...w, zIndex: maxZ + 1, isMinimized: false } : w,
        ),
      };
    });

  const toggleMin = (id: string) =>
    setOs((p) => ({
      ...p,
      windows: p.windows.map((w) =>
        w.id === id ? { ...w, isMinimized: !w.isMinimized } : w,
      ),
    }));

  const toggleMax = (id: string) =>
    setOs((p) => ({
      ...p,
      windows: p.windows.map((w) =>
        w.id === id ? { ...w, isMaximized: !w.isMaximized } : w,
      ),
    }));

  const handleOpenFile = (path: string) =>
    openWindow("editor", `Editor — ${path.split("/").pop()}`, {
      filePath: path,
    });

  const TASKBAR_ICONS: Record<WindowState["type"], React.ReactNode> = {
    terminal: <TerminalIcon size={15} />,
    explorer: <FolderPlus size={15} />,
    editor: <Code size={15} />,
    web: <Globe size={15} />,
    sandbox: <Layers size={15} />,
  };

  return (
    <div className="h-full w-full bg-black overflow-hidden flex items-center justify-center font-sans">
      <AnimatePresence mode="wait">
        {isCollapsed ? (
          <motion.button
            key="orb"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            onClick={() => setIsCollapsed(false)}
            className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full shadow-[0_0_48px_rgba(99,102,241,0.5)] flex items-center justify-center text-white"
          >
            <Monitor size={28} />
          </motion.button>
        ) : (
          <motion.div
            key="vm"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 1.4, ease: "easeInOut" }}
            className={cn(
              "w-full h-full bg-[#080808] flex flex-col overflow-hidden relative",
              isMobile
                ? "rounded-none"
                : "max-w-[1440px] max-h-[920px] rounded-2xl border border-white/10 shadow-[0_0_100px_rgba(0,0,0,0.95)]",
            )}
          >
            {/* ── Header ── */}
            <div className="h-11 bg-zinc-900 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full bg-red-500/80" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
                  <div className="w-3 h-3 rounded-full bg-green-500/80" />
                </div>
                <Shield size={13} className="text-blue-400 ml-2" />
                <span className="text-[11px] font-black tracking-[0.2em] uppercase text-zinc-100">
                  LEE VM-01
                </span>
                {!isMobile && (
                  <div className="ml-2 flex items-center gap-4 text-[8px] font-mono text-zinc-600 uppercase tracking-widest">
                    <span className="flex items-center gap-1">
                      <Cpu size={9} /> SANDBOX
                    </span>
                    <span
                      className={cn(
                        "flex items-center gap-1",
                        vmStatus.runningJobs > 0 ? "text-yellow-600" : "",
                      )}
                    >
                      <Zap size={9} /> {vmStatus.runningJobs} JOBS
                    </span>
                    <span className="flex items-center gap-1">
                      <Wifi size={9} /> CONNECTED
                    </span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-zinc-600">
                  {time.toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <button
                  onClick={() => setIsCollapsed(true)}
                  title="Collapse taskbar"
                  className="p-1.5 rounded hover:bg-white/5 text-zinc-500 hover:text-yellow-400 transition-all"
                >
                  <Minus size={13} />
                </button>
                <button
                  onClick={() => setIsPowerOn((v) => !v)}
                  title={isPowerOn ? "Power off" : "Power on"}
                  className={cn(
                    "p-1.5 rounded transition-all",
                    isPowerOn
                      ? "text-red-500 hover:bg-red-500/10"
                      : "text-green-500 hover:bg-green-500/10",
                  )}
                >
                  <Power size={14} />
                </button>
              </div>
            </div>

            {/* ── Desktop ── */}
            <div className="flex-grow relative overflow-hidden">
              {isPowerOn ? (
                <>
                  {/* Background */}
                  <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 via-black to-zinc-950 pointer-events-none" />
                  <div className="absolute inset-0 bg-[linear-gradient(rgba(99,102,241,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(99,102,241,0.015)_1px,transparent_1px)] bg-[size:48px_48px] pointer-events-none" />

                  {/* Desktop icons */}
                  <div
                    className={cn(
                      "absolute z-10 flex",
                      isMobile
                        ? "bottom-16 left-0 right-0 justify-around px-4 flex-row"
                        : "top-4 left-4 flex-col gap-1",
                    )}
                  >
                    <VMIcon
                      icon={<TerminalIcon size={20} />}
                      label="Terminal"
                      onClick={() =>
                        openWindow("terminal", "Agent Lee Terminal")
                      }
                    />
                    <VMIcon
                      icon={<FolderPlus size={20} />}
                      label="Files"
                      onClick={() => openWindow("explorer", "VM Files")}
                    />
                    <VMIcon
                      icon={<Code size={20} />}
                      label="Editor"
                      onClick={() =>
                        openWindow("editor", "Code Editor", {
                          filePath: "/home/agent_lee/welcome.txt",
                        })
                      }
                    />
                    <VMIcon
                      icon={<Globe size={20} />}
                      label="Browser"
                      onClick={() => openWindow("web", "Lee Browser")}
                    />
                    <VMIcon
                      icon={<Layers size={20} />}
                      label="Sandbox"
                      onClick={() => openWindow("sandbox", "Sandbox Control")}
                    />
                  </div>

                  {/* Windows layer */}
                  <div className="absolute inset-0 pointer-events-none z-20">
                    <AnimatePresence>
                      {os.windows.map((win) => (
                        <div key={win.id} className="pointer-events-auto">
                          <VMWindow
                            id={win.id}
                            title={win.title}
                            active={os.activeWindowId === win.id}
                            isMinimized={win.isMinimized}
                            isMaximized={isMobile || win.isMaximized}
                            zIndex={win.zIndex}
                            onClose={() => closeWindow(win.id)}
                            onMinimize={() => toggleMin(win.id)}
                            onMaximize={() => toggleMax(win.id)}
                            onFocus={() => focusWindow(win.id)}
                            initialPosition={win.position}
                            initialSize={win.size}
                          >
                            {win.type === "terminal" && <VMTerminal />}
                            {win.type === "explorer" && (
                              <VMFileExplorer
                                vfs={os.vfs}
                                onOpenFile={handleOpenFile}
                                onRefresh={fetchVFS}
                              />
                            )}
                            {win.type === "editor" && (
                              <VMCodeEditor
                                vfs={os.vfs}
                                filePath={
                                  win.data?.filePath ||
                                  "/home/agent_lee/welcome.txt"
                                }
                                onSave={fetchVFS}
                              />
                            )}
                            {win.type === "web" && <VMBrowser />}
                            {win.type === "sandbox" && (
                              <SandboxPanel onRefreshVFS={fetchVFS} />
                            )}
                          </VMWindow>
                        </div>
                      ))}
                    </AnimatePresence>
                  </div>

                  {/* Taskbar */}
                  <div
                    className={cn(
                      "absolute bg-zinc-900/90 backdrop-blur-xl border border-white/10 flex items-center gap-1 z-50",
                      isMobile
                        ? "bottom-0 left-0 right-0 h-14 px-6 justify-center rounded-t-2xl"
                        : "bottom-3 left-1/2 -translate-x-1/2 h-11 px-3 rounded-2xl",
                    )}
                  >
                    {os.windows.map((win) => (
                      <button
                        key={win.id}
                        onClick={() => focusWindow(win.id)}
                        title={win.title}
                        className={cn(
                          "w-9 h-9 rounded-xl flex items-center justify-center transition-all relative",
                          os.activeWindowId === win.id
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                            : "bg-white/5 text-zinc-400 hover:bg-white/10",
                        )}
                      >
                        {TASKBAR_ICONS[win.type]}
                        {win.isMinimized && (
                          <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-blue-400" />
                        )}
                      </button>
                    ))}
                    {os.windows.length === 0 && (
                      <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest px-4">
                        Open an app to start
                      </span>
                    )}
                  </div>
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center bg-black">
                  <motion.div
                    animate={{ opacity: [0.1, 0.3, 0.1] }}
                    transition={{ duration: 3, repeat: Infinity }}
                  >
                    <Power size={48} className="text-zinc-800" />
                  </motion.div>
                </div>
              )}
            </div>

            {/* ── Status footer ── */}
            {!isMobile && (
              <div className="h-6 bg-zinc-900 border-t border-white/5 flex items-center justify-between px-5 shrink-0">
                <span className="text-[8px] font-mono text-zinc-700 uppercase tracking-widest">
                  Instance: LEE_VM_01 • Policy: VM_FIRST • Root:
                  backend/workspace/agentlee_vm
                </span>
                <span
                  className={cn(
                    "text-[8px] font-mono uppercase tracking-widest",
                    vmStatus.runningJobs > 0
                      ? "text-yellow-700"
                      : "text-zinc-800",
                  )}
                >
                  {vmStatus.runningJobs > 0
                    ? `${vmStatus.runningJobs} job(s) running`
                    : "Idle"}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default LeeVM;
