/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.TOOLPANEL
LICENSE: MIT
*/

import Editor from "@monaco-editor/react";
import {
  ArrowLeft,
  Code,
  FilePlus,
  FolderPlus,
  RotateCcw,
  Save,
  Search,
  Terminal,
  Trash2,
  X,
} from "lucide-react";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActiveTool, VFSDirectory, VFSItem } from "./types";

// ── API Helper ─────────────────────────────────────────────────────────────
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

// ── Terminal Panel ─────────────────────────────────────────────────────────
const TerminalPanel: React.FC<{
  onRunCommand: (cmd: string, reason?: string) => void;
}> = ({ onRunCommand }) => {
  const outputRef = useRef<HTMLDivElement>(null);
  const [output, setOutput] = useState(
    "Agent Lee Workspace Terminal\nPolicy: Workspace-First · All commands sandboxed\n\n$ ",
  );
  const [input, setInput] = useState("");

  const run = async (cmd: string) => {
    if (!cmd.trim()) return;
    setOutput((p) => p + cmd + "\n");
    setInput("");
    // Also emit as thread event via parent
    onRunCommand(cmd, "Manual terminal command");

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
      setOutput((p) => p + "Error: Backend unreachable\n$ ");
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

// ── Editor Panel ───────────────────────────────────────────────────────────
const EditorPanel: React.FC<{
  filePath: string | null;
  vfs: VFSDirectory;
}> = ({ filePath, vfs }) => {
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!filePath) return;
    vmFetch(`/api/vm/vfs/read?path=${encodeURIComponent(filePath)}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.content != null) setContent(d.content);
      })
      .catch(() => {
        /* fallback */
      });
  }, [filePath]);

  const save = async () => {
    if (!filePath) return;
    setSaving(true);
    try {
      await vmFetch("/api/vm/vfs/write", {
        method: "POST",
        body: JSON.stringify({ path: filePath, content }),
      });
    } finally {
      setTimeout(() => setSaving(false), 500);
    }
  };

  if (!filePath) {
    return (
      <div className="h-full flex items-center justify-center text-zinc-600 text-[11px]">
        No file open. Select a file from the Files panel.
      </div>
    );
  }

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
        <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest truncate max-w-[200px]">
          {filePath}
        </span>
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-800 text-white text-[10px] font-bold rounded transition-all"
        >
          <Save size={12} />
          {saving ? "SAVING…" : "SAVE"}
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

// ── Files Panel ────────────────────────────────────────────────────────────
const FilesPanel: React.FC<{
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
      <div className="h-10 bg-zinc-900/60 border-b border-white/5 flex items-center px-3 gap-2 shrink-0">
        <button
          onClick={goUp}
          disabled={currentPath === "/"}
          title="Go up"
          className="p-1 hover:bg-white/5 rounded disabled:opacity-30"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          onClick={onRefresh}
          title="Refresh"
          className="p-1 hover:bg-white/5 rounded text-blue-400"
        >
          <RotateCcw size={14} />
        </button>
        <div className="flex-grow px-2 py-1 bg-black/40 rounded border border-white/5 text-[10px] font-mono text-zinc-500 truncate">
          {currentPath}
        </div>
        <button
          onClick={() => setCreating("dir")}
          className="p-1 hover:bg-white/5 rounded text-yellow-400"
          title="New folder"
        >
          <FolderPlus size={14} />
        </button>
        <button
          onClick={() => setCreating("file")}
          className="p-1 hover:bg-white/5 rounded text-blue-400"
          title="New file"
        >
          <FilePlus size={14} />
        </button>
      </div>

      {creating && (
        <div className="px-3 py-2 bg-zinc-900 border-b border-white/5 flex items-center gap-2 shrink-0">
          <span className="text-[9px] text-zinc-400">
            {creating === "dir" ? "New folder:" : "New file:"}
          </span>
          <input
            autoFocus
            value={newName}
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
            className="px-1 text-zinc-500"
          >
            <X size={12} />
          </button>
        </div>
      )}

      <div className="flex-grow overflow-y-auto p-3">
        <div className="space-y-0.5">
          {current.children.map((item, i) => (
            <button
              key={i}
              onClick={() =>
                item.type === "dir"
                  ? setCurrentPath(item.path)
                  : onOpenFile(item.path)
              }
              className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-white/5 transition-all group text-left"
            >
              <div
                className={`w-6 h-6 flex items-center justify-center rounded shrink-0 ${
                  item.type === "dir"
                    ? "text-yellow-500"
                    : "text-blue-400"
                }`}
              >
                {item.type === "dir" ? (
                  <FolderPlus size={14} />
                ) : (
                  <Code size={14} />
                )}
              </div>
              <span className="text-[11px] text-zinc-300 truncate flex-grow">
                {item.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  del(item);
                }}
                title={`Delete ${item.name}`}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-500/20 rounded text-red-500 transition-all"
              >
                <Trash2 size={10} />
              </button>
            </button>
          ))}
          {current.children.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-700">
              <FolderPlus size={24} strokeWidth={1} />
              <p className="text-[9px] uppercase tracking-widest mt-2 opacity-50">
                Empty directory
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Browser / Research Panel ───────────────────────────────────────────────
const BrowserPanel: React.FC = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<
    { title: string; link: string; snippet: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const res = await vmFetch(
        `/api/search?q=${encodeURIComponent(q)}&engine=duckduckgo`,
      );
      if (!res.ok) {
        setError(`Search failed (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      if (data.results?.length) setResults(data.results);
    } catch {
      setError("Network error — backend may be offline.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0c0c0c]">
      {/* Search bar */}
      <div className="h-12 bg-zinc-900 border-b border-white/5 flex items-center px-3 gap-2 shrink-0">
        <Search size={14} className="text-zinc-500 shrink-0" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") search(query);
          }}
          placeholder={loading ? "Searching…" : "Search the web…"}
          className="flex-grow bg-transparent outline-none text-[12px] text-zinc-200 placeholder-zinc-600"
        />
      </div>

      {/* Results */}
      <div className="flex-grow overflow-y-auto p-3 space-y-2">
        {error && (
          <div className="text-[11px] text-red-400 p-2 bg-red-500/5 border border-red-500/20 rounded-lg">
            {error}
          </div>
        )}
        {results.map((r, i) => (
          <div
            key={i}
            className="p-3 border border-white/5 rounded-xl hover:bg-white/3 transition-all"
          >
            <a
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] font-bold text-blue-400 hover:text-blue-300"
            >
              {r.title}
            </a>
            <div className="text-[9px] text-zinc-600 mt-0.5 truncate">
              {r.link}
            </div>
            <p className="text-[10px] text-zinc-400 mt-1 leading-relaxed">
              {r.snippet}
            </p>
          </div>
        ))}
        {results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center h-full text-zinc-600">
            <Search size={24} strokeWidth={1} />
            <p className="text-[10px] mt-2 uppercase tracking-widest">
              Agent Lee's Research Panel
            </p>
            <p className="text-[9px] mt-1 text-zinc-700">
              Search results appear here as structured cards.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// ── Main Tool Panel Container ──────────────────────────────────────────────
interface AgentToolPanelProps {
  activeTool: ActiveTool;
  editorFile: string | null;
  vfs: VFSDirectory;
  onClose: () => void;
  onOpenFile: (path: string) => void;
  onRefreshVFS: () => void;
  onRunCommand: (cmd: string, reason?: string) => void;
}

const TOOL_LABELS: Record<ActiveTool, string> = {
  none: "",
  terminal: "Terminal",
  editor: "Editor",
  browser: "Research",
  files: "Files",
  preview: "Preview",
};

export const AgentToolPanel: React.FC<AgentToolPanelProps> = ({
  activeTool,
  editorFile,
  vfs,
  onClose,
  onOpenFile,
  onRefreshVFS,
  onRunCommand,
}) => {
  return (
    <div className="w-[420px] xl:w-[520px] border-l border-white/5 flex flex-col shrink-0 bg-zinc-950">
      {/* Header */}
      <div className="h-8 bg-zinc-900 border-b border-white/5 flex items-center justify-between px-3 shrink-0">
        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
          {TOOL_LABELS[activeTool]}
        </span>
        <button
          onClick={onClose}
          title="Close panel"
          className="p-1 hover:bg-white/5 rounded text-zinc-600 hover:text-zinc-400 transition-colors"
        >
          <X size={12} />
        </button>
      </div>

      {/* Tool content */}
      <div className="flex-grow overflow-hidden">
        {activeTool === "terminal" && (
          <TerminalPanel onRunCommand={onRunCommand} />
        )}
        {activeTool === "editor" && (
          <EditorPanel filePath={editorFile} vfs={vfs} />
        )}
        {activeTool === "files" && (
          <FilesPanel
            vfs={vfs}
            onOpenFile={onOpenFile}
            onRefresh={onRefreshVFS}
          />
        )}
        {activeTool === "browser" && <BrowserPanel />}
        {activeTool === "preview" && (
          <div className="h-full flex items-center justify-center text-zinc-600 text-[11px]">
            Preview panel — build results and rendered outputs appear here.
          </div>
        )}
      </div>
    </div>
  );
};
