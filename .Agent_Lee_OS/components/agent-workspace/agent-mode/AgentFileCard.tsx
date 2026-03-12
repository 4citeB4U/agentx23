import React, { useState } from "react";
import { ThreadEvent } from "../types";
import { FileText, ChevronDown, ChevronUp, Code } from "lucide-react";

export const AgentFileCard: React.FC<{ event: ThreadEvent, onOpenFile?: (path: string) => void }> = ({ event, onOpenFile }) => {
  const [expanded, setExpanded] = useState(false);
  const isWrite = event.type === "write_file";

  return (
    <div className="my-3 mx-2 sm:mx-8 border border-zinc-800 bg-[#121212] rounded-xl overflow-hidden shadow-sm flex flex-col font-sans">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isWrite ? 'bg-indigo-500/10 text-indigo-400' : 'bg-sky-500/10 text-sky-400'}`}>
            {isWrite ? <Code size={18} /> : <FileText size={18} />}
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-200">
              {isWrite ? "Wrote to file" : "Read file"}
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-0.5">
              {event.data?.path || event.title}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {event.verification?.verified && (
            <span className="text-[10px] uppercase font-bold text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
              Verified
            </span>
          )}
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 p-4">
          <div className="text-xs text-zinc-400 mb-3 whitespace-pre-wrap leading-relaxed">
            {event.content}
          </div>
          {onOpenFile && event.data?.path && (
            <button 
              onClick={(e) => { e.stopPropagation(); onOpenFile(event.data.path); }}
              className="text-xs font-medium text-blue-400 hover:text-blue-300 transition-colors"
            >
              Open in Editor
            </button>
          )}
        </div>
      )}
    </div>
  );
};
