/*
LEEWAY HEADER — DO NOT REMOVE
REGION: UI
TAG: UI.ORCHESTRATION.AGENTWORKSPACE.SIDEBAR
LICENSE: MIT
*/

import {
  BookOpen,
  Brain,
  ChevronLeft,
  ChevronRight,
  FileText,
  Globe,
  Layers,
  ListChecks,
  Package,
  Settings,
  Target,
  Terminal,
  Wrench,
} from "lucide-react";
import React from "react";
import { SidebarSection } from "./types";

const SECTIONS: {
  id: SidebarSection;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "task", label: "Task", icon: <Target size={16} /> },
  { id: "plan", label: "Plan", icon: <ListChecks size={16} /> },
  { id: "tools", label: "Tools", icon: <Wrench size={16} /> },
  { id: "files", label: "Files", icon: <FileText size={16} /> },
  { id: "browser", label: "Browser", icon: <Globe size={16} /> },
  { id: "terminal", label: "Terminal", icon: <Terminal size={16} /> },
  { id: "artifacts", label: "Artifacts", icon: <Package size={16} /> },
  { id: "memory", label: "Memory", icon: <Brain size={16} /> },
  { id: "settings", label: "Settings", icon: <Settings size={16} /> },
];

interface AgentSidebarProps {
  activeSection: SidebarSection;
  onSetSection: (section: SidebarSection) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  artifactCount: number;
  approvalCount: number;
}

export const AgentSidebar: React.FC<AgentSidebarProps> = ({
  activeSection,
  onSetSection,
  collapsed,
  onToggleCollapse,
  artifactCount,
  approvalCount,
}) => {
  return (
    <div
      className={`${
        collapsed ? "w-14" : "w-48"
      } bg-zinc-950 border-r border-white/5 flex flex-col shrink-0 transition-all duration-200`}
    >
      {/* Header */}
      <div className="h-8 flex items-center justify-between px-2 shrink-0 border-b border-white/5">
        {!collapsed && (
          <span className="text-[8px] font-black uppercase tracking-widest text-zinc-600 ml-1">
            Navigation
          </span>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1 hover:bg-white/5 rounded text-zinc-600 hover:text-zinc-400 transition-colors ml-auto"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>
      </div>

      {/* Navigation items */}
      <div className="flex-grow overflow-y-auto py-1.5 space-y-0.5">
        {SECTIONS.map((sec) => {
          const isActive = activeSection === sec.id;
          const badge =
            sec.id === "artifacts" && artifactCount > 0
              ? artifactCount
              : sec.id === "task" && approvalCount > 0
                ? approvalCount
                : null;

          return (
            <button
              key={sec.id}
              onClick={() => onSetSection(sec.id)}
              title={collapsed ? sec.label : undefined}
              className={`w-full flex items-center gap-2.5 px-3 py-2 transition-all rounded-lg mx-auto ${
                collapsed ? "justify-center mx-1 w-auto" : ""
              } ${
                isActive
                  ? "bg-blue-600/15 text-blue-400"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-white/3"
              }`}
            >
              <span className="shrink-0">{sec.icon}</span>
              {!collapsed && (
                <span className="text-[10px] font-bold uppercase tracking-widest flex-grow text-left">
                  {sec.label}
                </span>
              )}
              {!collapsed && badge && (
                <span className="text-[8px] bg-blue-600 text-white px-1.5 py-0.5 rounded-full font-bold">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer logo */}
      <div className="h-10 border-t border-white/5 flex items-center justify-center shrink-0">
        <div className="flex items-center gap-1.5">
          <Layers size={12} className="text-blue-500/50" />
          {!collapsed && (
            <span className="text-[7px] font-black uppercase tracking-widest text-zinc-700">
              Agent Lee OS
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
