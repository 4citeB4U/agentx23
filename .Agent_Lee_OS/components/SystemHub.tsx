import {
    Box,
    CheckCircle,
    Cpu,
    Database,
    Globe,
    Grid,
    Layers,
    Network,
    Radio,
    RotateCw,
    ShieldCheck,
    Smartphone,
    Sun,
    Timer,
    X,
    Zap,
} from "lucide-react";
import React, { useEffect, useRef, useState } from "react";
import { CoreConfig, CoreShape, SystemMode } from "../types";
import { DeploymentNexus } from "./DeploymentNexus";
import { TunnelPanel } from "./TunnelPanel";
import { HUDFrame, MetricCard } from "./UIModules";

// --- INVENTORY TYPES & DATA ---
type VisualType = "WAVE" | "GAUGE" | "BARS";

interface ServiceNode {
  id: string;
  name: string;
  role: string;
  port?: number;
  type: "CORE" | "MCP" | "WORKER";
  visualType: VisualType;
  status: "ONLINE" | "DEGRADED" | "OFFLINE";
  icon: React.ReactNode;
  description: string;
}

const INVENTORY: ServiceNode[] = [
  {
    id: "core-studio",
    name: "Agent Lee Studio",
    role: "Frontend Host",
    port: 3002,
    type: "CORE",
    visualType: "WAVE",
    status: "ONLINE",
    icon: <Smartphone size={18} />,
    description: "Main React application container and UI thread host.",
  },
  {
    id: "core-orch",
    name: "Orchestrator",
    role: "System Logic",
    port: 3001,
    type: "CORE",
    visualType: "WAVE",
    status: "ONLINE",
    icon: <Cpu size={18} />,
    description: "Central decision engine routing intents to specific MCPs.",
  },
  {
    id: "core-brain",
    name: "Neural Brain",
    role: "LLM Inference",
    port: 8001,
    type: "CORE",
    visualType: "GAUGE",
    status: "ONLINE",
    icon: <Zap size={18} />,
    description: "Local quantization engine running Llama-3-8b via Ollama.",
  },
  {
    id: "core-mesh",
    name: "Neural Mesh",
    role: "WebSockets",
    port: 3003,
    type: "CORE",
    visualType: "WAVE",
    status: "ONLINE",
    icon: <Network size={18} />,
    description: "Real-time event bus handling duplex communication.",
  },
  {
    id: "mcp-stitch",
    name: "Stitch",
    role: "The Architect",
    type: "MCP",
    visualType: "BARS",
    status: "ONLINE",
    icon: <Layers size={18} />,
    description: "Generative UI component builder and layout engine.",
  },
  {
    id: "mcp-test",
    name: "TestSprite",
    role: "The Auditor",
    type: "MCP",
    visualType: "BARS",
    status: "ONLINE",
    icon: <ShieldCheck size={18} />,
    description: "Autonomous integration testing and DOM verification.",
  },
  {
    id: "mcp-play",
    name: "Playwright",
    role: "The Ghost",
    type: "MCP",
    visualType: "BARS",
    status: "ONLINE",
    icon: <Globe size={18} />,
    description: "Headless browser automation for external web interaction.",
  },
  {
    id: "mcp-ins",
    name: "InsForge",
    role: "The Scribe",
    type: "MCP",
    visualType: "BARS",
    status: "ONLINE",
    icon: <Database size={18} />,
    description: "Structured SQL/NoSQL database management layer.",
  },
  {
    id: "wkr-desktop",
    name: "AA Desktop",
    role: "BG Worker",
    type: "WORKER",
    visualType: "WAVE",
    status: "ONLINE",
    icon: <Box size={18} />,
    description: "Background service worker for push notifications and sync.",
  },
];

type McpName = "testsprite" | "playwright" | "insforge" | "stitch";
type McpModuleStatus = {
  running: boolean;
  pid?: number | null;
  startedAt?: string | null;
  stoppedAt?: string | null;
  lastExitCode?: number | null;
  lastSignal?: string | null;
  lastError?: string | null;
};

const MCP_ID_TO_NAME: Record<string, McpName> = {
  "mcp-test": "testsprite",
  "mcp-play": "playwright",
  "mcp-ins": "insforge",
  "mcp-stitch": "stitch",
};

function getHandshake(): string | undefined {
  return (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined;
}

async function fetchJson(path: string) {
  const handshake = getHandshake();
  const res = await fetch(path, {
    headers: {
      ...(handshake ? { "x-neural-handshake": handshake } : {}),
    },
  });
  const data = await res.json().catch(() => null);
  return { ok: res.ok, status: res.status, data };
}

// --- METRIC TYPES ---
interface NodeMetrics {
  lat: number[]; // Latency history
  tpt: number[]; // Throughput history
  load: number; // Current Load % (0-100)
  activity: { s: number; e: number }[]; // Success/Error history
}

// --- VISUALIZATION COMPONENTS ---

const RadialGauge: React.FC<{
  value: number;
  label: string;
  color: string;
}> = ({ value, label, color }) => {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;
  const glowClass =
    color === "#10b981"
      ? "bg-[radial-gradient(circle,#10b981_0%,transparent_70%)]"
      : color === "#f59e0b"
        ? "bg-[radial-gradient(circle,#f59e0b_0%,transparent_70%)]"
        : "bg-[radial-gradient(circle,#ef4444_0%,transparent_70%)]";

  return (
    <div className="relative flex items-center justify-center w-full h-24">
      <svg className="w-24 h-24 transform -rotate-90">
        {/* Background Circle */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke="#1e293b"
          strokeWidth="6"
          fill="transparent"
        />
        {/* Foreground Circle */}
        <circle
          cx="48"
          cy="48"
          r={radius}
          stroke={color}
          strokeWidth="6"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-white tracking-tighter">
          {value.toFixed(0)}%
        </span>
        <span className="text-[9px] text-gray-500 uppercase font-mono tracking-widest">
          {label}
        </span>
      </div>
      {/* Glow effect */}
      <div
        className={`absolute inset-0 rounded-full blur-xl opacity-20 pointer-events-none ${glowClass}`}
      ></div>
    </div>
  );
};

const ActivityBars: React.FC<{ data: { s: number; e: number }[] }> = ({
  data,
}) => {
  // Take last 12 data points
  const recent = data.slice(-12);
  const maxTasks = 10;

  return (
    <div className="h-20 w-full px-2 py-2">
      <svg viewBox="0 0 120 80" className="w-full h-full">
        {recent.map((d, i) => {
          const total = d.s + d.e + 0.1;
          const heightPct = Math.min(100, (total / maxTasks) * 100);

          const sH = (d.s / total) * 100;
          const eH = (d.e / total) * 100;
          const barH = Math.max(15, heightPct) * 0.8;
          const x = i * 10;
          const y = 80 - barH;
          const successH = (sH / 100) * barH;
          const errorH = (eH / 100) * barH;

          return (
            <g key={i}>
              <rect
                x={x}
                y={y}
                width="8"
                height={barH}
                rx="1"
                fill="rgba(51,65,85,0.3)"
              />
              <rect
                x={x}
                y={80 - successH}
                width="8"
                height={successH}
                rx="1"
                fill="rgba(16,185,129,0.8)"
              />
              <rect
                x={x}
                y={80 - successH - errorH}
                width="8"
                height={errorH}
                rx="1"
                fill="rgba(239,68,68,0.8)"
              />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

const AreaSparkline: React.FC<{
  data: number[];
  color: string;
  height?: number;
}> = ({ data, color, height = 40 }) => {
  if (data.length < 2) return null;
  const max = Math.max(...data, 100);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const width = 100;

  const points = data
    .map((val, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((val - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-full overflow-visible opacity-80"
      preserveAspectRatio="none"
    >
      <defs>
        <linearGradient
          id={`grad-${color.replace("#", "")}`}
          x1="0"
          x2="0"
          y1="0"
          y2="1"
        >
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={`M ${points} L 100,${height} L 0,${height} Z`}
        fill={`url(#grad-${color.replace("#", "")})`}
        stroke="none"
      />
      <path
        d={`M ${points}`}
        fill="none"
        stroke={color}
        strokeWidth="2"
        vectorEffect="non-scaling-stroke"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="100"
        cy={height - ((data[data.length - 1] - min) / range) * height}
        r="2"
        fill={color}
        className="animate-pulse"
      />
    </svg>
  );
};

// --- SERVICE CARD ---

const ServiceCard: React.FC<{
  node: ServiceNode;
  metrics: NodeMetrics;
  onClick: () => void;
}> = ({ node, metrics, onClick }) => {
  const currentLat = metrics.lat[metrics.lat.length - 1] || 0;
  const currentTpt = metrics.tpt[metrics.tpt.length - 1] || 0;

  const statusColor =
    node.status === "ONLINE"
      ? "#10b981"
      : node.status === "DEGRADED"
        ? "#f59e0b"
        : "#ef4444";
  const statusText =
    node.status === "ONLINE"
      ? "text-emerald-500"
      : node.status === "DEGRADED"
        ? "text-amber-500"
        : "text-red-500";
  const statusBg =
    node.status === "ONLINE"
      ? "bg-emerald-500/10 border-emerald-500/30"
      : node.status === "DEGRADED"
        ? "bg-amber-500/10 border-amber-500/30"
        : "bg-red-500/10 border-red-500/30";

  return (
    <div
      onClick={onClick}
      className={`relative group bg-slate-900/40 border border-slate-800 hover:border-slate-600 rounded-xl p-4 cursor-pointer transition-all hover:bg-slate-800/60 overflow-hidden min-h-[180px] flex flex-col`}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${statusBg} ${statusText}`}>
            {node.icon}
          </div>
          <div>
            <div className="text-xs font-bold text-slate-200">{node.name}</div>
            <div className="text-[10px] text-slate-500 font-mono">
              {node.role}
            </div>
          </div>
        </div>
        <div
          className={`w-2 h-2 rounded-full ${node.status === "ONLINE" ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-red-500"}`}
        ></div>
      </div>

      <div className="flex-1 flex items-center justify-center w-full mb-2">
        {node.visualType === "WAVE" && (
          <div className="w-full h-16">
            <AreaSparkline data={metrics.lat} color={statusColor} />
          </div>
        )}
        {node.visualType === "GAUGE" && (
          <RadialGauge
            value={metrics.load}
            label="COG LOAD"
            color={statusColor}
          />
        )}
        {node.visualType === "BARS" && <ActivityBars data={metrics.activity} />}
      </div>

      <div className="flex justify-between items-end border-t border-slate-800 pt-2 mt-auto">
        <div>
          <div className="text-[9px] text-slate-500 uppercase">
            {node.visualType === "BARS" ? "Success Rate" : "Latency"}
          </div>
          <div className={`text-xs font-mono font-bold ${statusText}`}>
            {node.visualType === "BARS"
              ? `${((metrics.activity[metrics.activity.length - 1]?.s / (metrics.activity[metrics.activity.length - 1]?.s + metrics.activity[metrics.activity.length - 1]?.e + 0.001)) * 100).toFixed(0)}%`
              : `${currentLat.toFixed(0)}ms`}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-slate-500 uppercase">
            {node.visualType === "GAUGE" ? "Tokens/s" : "Throughput"}
          </div>
          <div className="text-xs font-mono font-bold text-slate-300">
            {currentTpt.toFixed(1)} /s
          </div>
        </div>
      </div>

      {/* Hover Glow */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
    </div>
  );
};

// --- HELPER CONTROLS ---

const CoreControl: React.FC<{
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (val: number) => void;
  icon: React.ReactNode;
}> = ({ label, value, min, max, step, onChange, icon }) => (
  <div className="flex flex-col gap-2">
    <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold tracking-widest uppercase">
      <span className="flex items-center gap-2">
        {icon} {label}
      </span>
      <span className="text-cyan-400 font-mono">{value}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      title={label}
      aria-label={label}
      className="w-full h-1 bg-gray-800 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-cyan-500 [&::-webkit-slider-thumb]:rounded-full hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
    />
  </div>
);

const ShapeSelector: React.FC<{
  current: CoreShape;
  onSelect: (s: CoreShape) => void;
}> = ({ current, onSelect }) => {
  // Only include valid CoreShape values. Adjust as per CoreShape definition.
  const shapes: CoreShape[] = ["sphere", "heart"];
  return (
    <div className="grid grid-cols-4 gap-2">
      {shapes.map((s) => (
        <button
          key={s}
          onClick={() => onSelect(s)}
          className={`aspect-square rounded-lg border flex flex-col items-center justify-center gap-1 transition-all ${current === s ? "bg-cyan-900/40 border-cyan-500 text-white shadow-[0_0_15px_rgba(6,182,212,0.3)]" : "border-gray-800 bg-gray-900/20 text-gray-600 hover:border-gray-600 hover:text-gray-300"}`}
        >
          <div
            className={`w-3 h-3 rounded-sm ${current === s ? "bg-cyan-400" : "bg-gray-600"}`}
          ></div>
          <span className="text-[8px] uppercase font-bold tracking-wider">
            {s}
          </span>
        </button>
      ))}
    </div>
  );
};

const ServiceDetailModal: React.FC<{
  node: ServiceNode;
  metrics: NodeMetrics;
  onClose: () => void;
  mcpStatus?: McpModuleStatus | null;
  onMcpAction?: (action: "start" | "stop" | "logs") => void;
  mcpLogs?: string[];
}> = ({ node, metrics, onClose, mcpStatus, onMcpAction, mcpLogs }) => {
  return (
    <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fade-in_0.2s_ease-out]">
      <div className="bg-[#0a0a0a] border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl relative">
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-slate-800 rounded-xl border border-slate-700 text-slate-200">
              {node.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{node.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                  {node.type}
                </span>
                {node.port && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-blue-900/30 text-blue-400 border border-blue-500/30">
                    PORT {node.port}
                  </span>
                )}
              </div>
            </div>
          </div>
          <button
            title="Close details"
            aria-label="Close details"
            onClick={onClose}
            className="p-2 hover:bg-slate-800 rounded-full transition-colors text-slate-500 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800">
              <div className="text-xs text-slate-500 mb-1">HEALTH STATUS</div>
              <div className="text-lg font-bold text-emerald-500 flex items-center gap-2">
                <CheckCircle size={18} /> OPERATIONAL
              </div>
              <div className="text-[10px] text-slate-600 mt-2">
                Uptime: 99.98% • Last Restart: 4d ago
              </div>
            </div>
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800">
              <div className="text-xs text-slate-500 mb-1">DESCRIPTION</div>
              <p className="text-sm text-slate-300 leading-relaxed">
                {node.description}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-xs font-bold text-slate-400">
                  REAL-TIME LATENCY (ms)
                </h3>
                <span className="text-xs font-mono text-emerald-500">
                  {metrics.lat[metrics.lat.length - 1]?.toFixed(0)} ms
                </span>
              </div>
              <div className="h-32 bg-slate-900/50 rounded-lg border border-slate-800 p-2">
                <AreaSparkline
                  data={metrics.lat}
                  color="#10b981"
                  height={100}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 font-mono text-[10px] text-slate-400">
            <div className="flex gap-2 mb-1">
              <span className="text-slate-600">&gt;&gt;&gt;</span> Initializing
              handshake protocol... OK
            </div>
            <div className="flex gap-2 mb-1">
              <span className="text-slate-600">&gt;&gt;&gt;</span>{" "}
              Authenticating security token... OK
            </div>
            <div className="flex gap-2">
              <span className="text-slate-600">&gt;&gt;&gt;</span> Stream
              active. Listening on {node.port || "IPC Channel"}...
            </div>
          </div>

          {node.type === "MCP" && (
            <div className="p-4 rounded-xl bg-slate-900/30 border border-slate-800 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs text-slate-500">MCP MODULE</div>
                  <div className="text-sm font-bold text-slate-200">
                    {mcpStatus?.running ? "RUNNING" : "STOPPED"}
                    {mcpStatus?.pid ? (
                      <span className="text-slate-500 font-mono text-xs">
                        {" "}
                        (pid {mcpStatus.pid})
                      </span>
                    ) : null}
                  </div>
                  {mcpStatus?.lastError ? (
                    <div className="text-[10px] text-red-400 font-mono mt-1">
                      {mcpStatus.lastError}
                    </div>
                  ) : null}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => onMcpAction?.("start")}
                    title="Start MCP"
                    aria-label="Start MCP"
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30"
                  >
                    START
                  </button>
                  <button
                    onClick={() => onMcpAction?.("stop")}
                    title="Stop MCP"
                    aria-label="Stop MCP"
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-red-600/10 text-red-300 border border-red-500/30 hover:bg-red-600/20"
                  >
                    STOP
                  </button>
                  <button
                    onClick={() => onMcpAction?.("logs")}
                    title="Fetch MCP logs"
                    aria-label="Fetch MCP logs"
                    className="px-3 py-1.5 rounded-lg text-[10px] font-bold bg-slate-800 text-slate-200 border border-slate-700 hover:bg-slate-700"
                  >
                    LOGS
                  </button>
                </div>
              </div>

              {Array.isArray(mcpLogs) && mcpLogs.length > 0 && (
                <div className="bg-black/30 border border-slate-800 rounded-lg p-3 font-mono text-[10px] text-slate-300 max-h-40 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
                  {mcpLogs.slice(-60).join("\n")}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// --- MAIN SYSTEM HUB ---

interface SystemHubProps {
  currentMode: SystemMode;
  setMode: (m: SystemMode) => void;
  coreConfig: CoreConfig;
  setCoreConfig: React.Dispatch<React.SetStateAction<CoreConfig>>;
}

// Agent Lee — SystemHub UI/Controls/Behavior Update
// Implementation Ready: Acceptance checklist referenced in PR
export const SystemHub: React.FC<SystemHubProps> = ({
  currentMode,
  setMode,
  coreConfig,
  setCoreConfig,
}) => {
  // Metric Simulation State
  const [metrics, setMetrics] = useState<Record<string, NodeMetrics>>({});
  const [selectedService, setSelectedService] = useState<ServiceNode | null>(
    null,
  );
  const [mcpModules, setMcpModules] = useState<Record<
    string,
    McpModuleStatus
  > | null>(null);
  const [mcpLogs, setMcpLogs] = useState<string[]>([]);

  // Settings validation and save/reset logic
  // Acceptance checklist: shape selector, footer layout, avatar mode logic
  const [pendingConfig, setPendingConfig] = useState<CoreConfig>(coreConfig);
  const [errors, setErrors] = useState<{ [k: string]: string }>({});
  const [dirty, setDirty] = useState(false);
  const initialConfigRef = useRef(coreConfig);

  // Voice profile selector state
  const [voiceProfiles, setVoiceProfiles] = useState<any[]>([]);
  const [activeVoiceProfile, setActiveVoiceProfile] = useState<string>("");
  const [voiceLoading, setVoiceLoading] = useState(false);

  // Fetch voice profiles on mount
  useEffect(() => {
    fetch(
      "/api/files/content?path=c:/Tools/Portable-VSCode-MCP-Kit/voice_profiles.json",
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data && Array.isArray(data.content)) {
          setVoiceProfiles(data.content);
          const active = data.content.find((p: any) => p.active);
          setActiveVoiceProfile(active ? active.id : "");
        }
      });
  }, []);

  // Handle voice profile change
  const handleVoiceProfileChange = async (id: string) => {
    setVoiceLoading(true);
    // Update active profile in local state
    setActiveVoiceProfile(id);
    // Update voice_profiles.json backend
    const updated = voiceProfiles.map((p) => ({ ...p, active: p.id === id }));
    await fetch("/api/files/content", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: "c:/Tools/Portable-VSCode-MCP-Kit/voice_profiles.json",
        content: JSON.stringify(updated, null, 2),
      }),
    });
    setVoiceProfiles(updated);
    // Optionally trigger backend refresh (e.g. POST /api/chat/tts with profile id)
    await fetch("/api/chat/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Voice profile updated.",
        voiceProfile: id,
      }),
    });
    setVoiceLoading(false);
  };

  // Sync pendingConfig with coreConfig if not dirty
  useEffect(() => {
    if (!dirty) {
      setPendingConfig(coreConfig);
      initialConfigRef.current = coreConfig;
    }
  }, [coreConfig]);
  // Stepwise review: UI structure and controls

  // Validation logic
  // Two-way UI↔️Core state binding: all controls update pendingConfig and validate
  const validate = (cfg: CoreConfig) => {
    const e: { [k: string]: string } = {};
    if (cfg.morphSpeed < 1.0 || cfg.morphSpeed > 10.0)
      e.morphSpeed = "Speed must be 1.0–10.0";
    if (cfg.density < 1000 || cfg.density > 20000)
      e.density = "Density must be 1000–20000";
    if (cfg.brightness < 0.2 || cfg.brightness > 2.0)
      e.brightness = "Luminosity must be 0.2–2.0";
    // Add more validation as needed for new controls
    return e;
  };

  // Live update handler with validation
  // UI controls: shape selector, particle controls, footer, avatar modes
  const updateConfig = (patch: Partial<CoreConfig>) => {
    setPendingConfig((prev) => {
      const next = { ...prev, ...patch };
      setErrors(validate(next));
      setDirty(true);
      return next;
    });
  };

  // Save and Reset handlers
  const handleSave = () => {
    const e = validate(pendingConfig);
    setErrors(e);
    if (Object.keys(e).length === 0) {
      setCoreConfig(pendingConfig);
      setDirty(false);
    }
  };
  const handleReset = () => {
    setPendingConfig(initialConfigRef.current);
    setErrors({});
    setDirty(false);
  };

  // Initialize metrics
  useEffect(() => {
    const initialMetrics: Record<string, NodeMetrics> = {};
    INVENTORY.forEach((node) => {
      initialMetrics[node.id] = {
        lat: Array(20)
          .fill(0)
          .map(() => 20 + Math.random() * 30),
        tpt: Array(20)
          .fill(0)
          .map(() => Math.random() * 10),
        load: Math.random() * 100,
        activity: Array(20)
          .fill(0)
          .map(() => ({
            s: Math.floor(Math.random() * 8),
            e: Math.floor(Math.random() * 2),
          })),
      };
    });
    setMetrics(initialMetrics);

    const interval = setInterval(() => {
      setMetrics((prev) => {
        const next = { ...prev };
        INVENTORY.forEach((node) => {
          const prevM = prev[node.id] || {
            lat: [],
            tpt: [],
            load: 0,
            activity: [],
          };

          // Random Walk Logic
          const lastLat = prevM.lat[prevM.lat.length - 1] || 30;
          const newLat = Math.max(
            10,
            Math.min(200, lastLat + (Math.random() - 0.5) * 20),
          );

          const lastTpt = prevM.tpt[prevM.tpt.length - 1] || 5;
          const newTpt = Math.max(
            0,
            Math.min(50, lastTpt + (Math.random() - 0.5) * 5),
          );

          const newLoad = Math.max(
            0,
            Math.min(100, prevM.load + (Math.random() - 0.5) * 10),
          );
          const newActivity = {
            s: Math.floor(Math.random() * 8),
            e: Math.random() > 0.8 ? 1 : 0,
          };

          next[node.id] = {
            lat: [...prevM.lat.slice(1), newLat],
            tpt: [...prevM.tpt.slice(1), newTpt],
            load: newLoad,
            activity: [...prevM.activity.slice(1), newActivity],
          };
        });
        return next;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Live MCP status (from backend -> MCP bridge). Keeps SystemHub truthful.
  useEffect(() => {
    let cancelled = false;

    const tick = async () => {
      const result = await fetchJson("/api/mcp/status");
      if (cancelled) return;
      const modules = result?.data?.modules;
      if (modules && typeof modules === "object") {
        setMcpModules(modules as Record<string, McpModuleStatus>);
      }
    };

    tick();
    const id = window.setInterval(tick, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const getEffectiveStatus = (node: ServiceNode): ServiceNode["status"] => {
    if (node.type !== "MCP") return node.status;
    const name = MCP_ID_TO_NAME[node.id];
    const live = name ? mcpModules?.[name] : undefined;
    if (!live) return "DEGRADED";
    return live.running ? "ONLINE" : "OFFLINE";
  };

  const inventoryWithLiveStatus: ServiceNode[] = INVENTORY.map((n) => ({
    ...n,
    status: getEffectiveStatus(n),
  }));

  const selectedMcpName =
    selectedService?.type === "MCP" ? MCP_ID_TO_NAME[selectedService.id] : null;
  const selectedMcpStatus = selectedMcpName
    ? mcpModules?.[selectedMcpName] || null
    : null;

  const runMcpAction = async (action: "start" | "stop" | "logs") => {
    if (!selectedMcpName) return;
    setMcpLogs([]);

    if (action === "logs") {
      const r = await fetchJson(`/api/mcp/logs/${selectedMcpName}?tail=160`);
      const logs = Array.isArray(r?.data?.logs) ? r.data.logs : [];
      setMcpLogs(logs);
      return;
    }

    await fetch(`/api/mcp/${action}/${selectedMcpName}`, {
      method: "POST",
      headers: {
        ...(getHandshake() ? { "x-neural-handshake": getHandshake()! } : {}),
      },
    }).catch(() => null);

    const next = await fetchJson("/api/mcp/status");
    const modules = next?.data?.modules;
    if (modules && typeof modules === "object") {
      setMcpModules(modules as Record<string, McpModuleStatus>);
    }
  };

  const [activeSubTab, setActiveSubTab] = useState<
    "OVERVIEW" | "NETWORKING" | "DEPLOYMENT"
  >("OVERVIEW");

  return (
    <div className="h-full overflow-y-auto p-4 md:p-8 space-y-8 bg-black/40 custom-scrollbar animate-[fade-in_0.4s_ease-out] pb-32">
      {/* --- SYSTEM HEADER --- */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 px-2">
        <div>
          <h2 className="text-3xl font-bold text-white tracking-widest uppercase flex items-center gap-4">
            <Cpu className="text-blue-500" size={32} />
            Agent Lee OS{" "}
            <span className="text-blue-500/50 text-base font-light">
              CORE v4.0
            </span>
          </h2>
          <p className="text-gray-400 text-sm mt-2 font-mono tracking-tight uppercase">
            Sovereign Orchestration Layer • Hardened Kernel • 884-AX
          </p>
        </div>

        <div className="flex bg-gray-900/60 p-1.5 rounded-xl border border-gray-800 backdrop-blur-md">
          {["OVERVIEW", "NETWORKING", "DEPLOYMENT"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveSubTab(tab as any)}
              className={`px-6 py-2.5 text-xs font-bold rounded-lg transition-all duration-300 ${activeSubTab === tab ? "bg-blue-600 text-white shadow-[0_0_20px_rgba(37,99,235,0.4)]" : "text-gray-500 hover:text-gray-300 hover:bg-white/5"}`}
            >
              {tab}
            </button>
          ))}
        </div>
      </header>

      {activeSubTab === "OVERVIEW" && (
        <div className="space-y-10">
          {/* --- SYSTEM METRICS (HUD) --- */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              icon={<Cpu className="text-blue-400" size={20} />}
              label="Neural Load"
              value="32.8 %"
              color="cyan"
              progress={33}
            />
            <MetricCard
              icon={<Database className="text-purple-400" size={20} />}
              label="Memory Lake"
              value="4.2 GB"
              color="purple"
              progress={62}
            />
            <MetricCard
              icon={<Zap className="text-yellow-400" size={20} />}
              label="Energy State"
              value="Balanced"
              color="amber"
              progress={85}
            />
            <MetricCard
              icon={<ShieldCheck className="text-emerald-400" size={20} />}
              label="Sec Status"
              value="Hardened"
              color="emerald"
              progress={100}
            />
          </div>

          {/* --- CORE CONFIGURATION (MATRIX) --- */}
          <HUDFrame
            title="Vortex Core Matrix"
            icon={<Grid size={14} className="text-cyan-400" />}
          >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-2">
              <div className="space-y-8">
                <ShapeSelector
                  current={pendingConfig.shape}
                  onSelect={(s) =>
                    updateConfig({ shape: s, autoMorphEnabled: false })
                  }
                />
                <div className="flex items-center justify-between p-5 bg-gray-900/40 rounded-xl border border-gray-800 hover:border-blue-500/30 transition-all">
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${pendingConfig.autoMorphEnabled ? "bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.4)]" : "bg-gray-800 text-gray-500"}`}
                    >
                      <RotateCw
                        size={22}
                        className={
                          pendingConfig.autoMorphEnabled ? "animate-spin" : ""
                        }
                      />
                    </div>
                    <div>
                      <span className="text-sm font-bold text-gray-200 block">
                        Auto-Sequence
                      </span>
                      <span className="text-xs text-gray-500 block mt-0.5">
                        Autonomous shape shifting
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() =>
                      updateConfig({
                        autoMorphEnabled: !pendingConfig.autoMorphEnabled,
                      })
                    }
                    className={`w-14 h-7 rounded-full relative transition-all duration-300 ${pendingConfig.autoMorphEnabled ? "bg-green-600" : "bg-gray-700"}`}
                    aria-label="Toggle auto sequence"
                  >
                    <div
                      className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-sm transition-all duration-300 ${pendingConfig.autoMorphEnabled ? "left-8" : "left-1"}`}
                    ></div>
                  </button>
                </div>
                {/* Voice Profile Selector */}
                <div className="mt-8">
                  <label
                    htmlFor="voice-profile-select"
                    className="block text-xs font-bold text-gray-400 mb-2"
                  >
                    Agent Lee Voice Profile
                  </label>
                  <select
                    id="voice-profile-select"
                    title="Agent Lee Voice Profile"
                    className="w-full p-2 rounded-lg border border-gray-700 bg-gray-900 text-gray-200 font-mono text-sm"
                    value={activeVoiceProfile}
                    onChange={(e) => handleVoiceProfileChange(e.target.value)}
                    disabled={voiceLoading}
                  >
                    <option value="">Select a profile...</option>
                    {voiceProfiles.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.id}
                      </option>
                    ))}
                  </select>
                  {voiceLoading && (
                    <div className="text-xs text-blue-400 mt-2">
                      Updating voice profile...
                    </div>
                  )}
                  {activeVoiceProfile && (
                    <div className="text-xs text-emerald-400 mt-2">
                      Active:{" "}
                      {voiceProfiles.find((p) => p.id === activeVoiceProfile)
                        ?.label || activeVoiceProfile}
                    </div>
                  )}
                </div>
              </div>
              <div className="space-y-6 pt-2">
                <CoreControl
                  label="Sequence Speed (sec)"
                  icon={<Timer size={14} className="text-blue-400" />}
                  value={pendingConfig.morphSpeed}
                  min={1.0}
                  max={10.0}
                  step={0.5}
                  onChange={(v) => updateConfig({ morphSpeed: v })}
                />
                {errors.morphSpeed && (
                  <div className="text-xs text-red-400 font-mono">
                    {errors.morphSpeed}
                  </div>
                )}
                <CoreControl
                  label="Particle Density"
                  icon={<Grid size={14} className="text-purple-400" />}
                  value={pendingConfig.density}
                  min={1000}
                  max={20000}
                  step={500}
                  onChange={(v) => updateConfig({ density: v })}
                />
                {errors.density && (
                  <div className="text-xs text-red-400 font-mono">
                    {errors.density}
                  </div>
                )}
                <CoreControl
                  label="Luminosity"
                  icon={<Sun size={14} className="text-yellow-400" />}
                  value={pendingConfig.brightness}
                  min={0.2}
                  max={2.0}
                  step={0.1}
                  onChange={(v) => updateConfig({ brightness: v })}
                />
                {errors.brightness && (
                  <div className="text-xs text-red-400 font-mono">
                    {errors.brightness}
                  </div>
                )}
                <div className="flex gap-3 pt-2">
                  <button
                    className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${dirty && Object.keys(errors).length === 0 ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-700 text-gray-400 cursor-not-allowed"}`}
                    onClick={handleSave}
                    disabled={!dirty || Object.keys(errors).length > 0}
                  >
                    Save
                  </button>
                  <button
                    className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${dirty ? "bg-gray-800 text-gray-200 hover:bg-gray-700" : "bg-gray-700 text-gray-400 cursor-not-allowed"}`}
                    onClick={handleReset}
                    disabled={!dirty}
                  >
                    Reset
                  </button>
                  {dirty && Object.keys(errors).length === 0 && (
                    <span className="text-xs text-emerald-400 font-mono pt-2">
                      Live preview active
                    </span>
                  )}
                </div>
              </div>
            </div>
          </HUDFrame>

          {/* --- SERVICE INVENTORY --- */}
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-base font-bold text-gray-300 uppercase tracking-[0.2em] flex items-center gap-3">
                <Box size={20} className="text-blue-500" />
                Inventory of Sovereignty
              </h3>
              <button className="text-[11px] font-bold text-gray-500 hover:text-blue-400 uppercase tracking-widest flex items-center gap-2 transition-all">
                <RotateCw size={12} /> Sync Nodes
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {inventoryWithLiveStatus.map((node) => (
                <ServiceCard
                  key={node.id}
                  node={node}
                  metrics={
                    metrics[node.id] || {
                      lat: [],
                      tpt: [],
                      load: 0,
                      activity: [],
                    }
                  }
                  onClick={() => setSelectedService(node)}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {activeSubTab === "NETWORKING" && (
        <div className="space-y-8 max-w-5xl mx-auto">
          <HUDFrame
            title="REMOTE ACCESS & TUNNELS"
            icon={<Radio size={16} className="text-orange-500" />}
          >
            <div className="bg-black/30 rounded-2xl overflow-hidden border border-gray-800 shadow-2xl">
              <TunnelPanel />
            </div>
          </HUDFrame>

          <HUDFrame
            title="NETWORK DIAGNOSTICS"
            icon={<Network size={16} className="text-blue-500" />}
          >
            <div className="bg-gray-900/40 p-8 rounded-2xl border border-gray-800 text-gray-400 text-sm font-mono leading-relaxed space-y-4">
              <div className="flex items-center gap-4">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-white font-bold w-32">API Gateway:</span>
                <span className="text-gray-500">
                  127.0.0.1:8001 (LISTENING)
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-white font-bold w-32">
                  Neural Router:
                </span>
                <span className="text-gray-500">127.0.0.1:8004 (ACTIVE)</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse"></span>
                <span className="text-white font-bold w-32">
                  CerebralDaemon:
                </span>
                <span className="text-gray-500">
                  127.0.0.1:8787 (READY, delegated)
                </span>
              </div>
              <div className="mt-8 pt-8 border-t border-gray-800/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600 uppercase tracking-widest font-bold">
                    Encrypted via RSA-4096 / SHA-256
                  </span>
                  <span className="text-emerald-500 text-xs font-mono uppercase">
                    Secure Link Active
                  </span>
                </div>
              </div>
            </div>
          </HUDFrame>
        </div>
      )}

      {activeSubTab === "DEPLOYMENT" && (
        <div className="max-w-5xl mx-auto">
          <DeploymentNexus />
        </div>
      )}

      {/* DETAIL MODAL */}
      {selectedService && (
        <ServiceDetailModal
          node={selectedService}
          metrics={
            metrics[selectedService.id] || {
              lat: [],
              tpt: [],
              load: 0,
              activity: [],
            }
          }
          onClose={() => {
            setSelectedService(null);
            setMcpLogs([]);
          }}
          mcpStatus={selectedMcpStatus}
          onMcpAction={runMcpAction}
          mcpLogs={mcpLogs}
        />
      )}
    </div>
  );
};
