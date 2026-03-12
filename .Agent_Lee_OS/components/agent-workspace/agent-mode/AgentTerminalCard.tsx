import React, { useState } from "react";
import { ThreadEvent } from "../types";
import { Terminal, ChevronDown, ChevronUp } from "lucide-react";

export const AgentTerminalCard: React.FC<{ event: ThreadEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 mx-2 sm:mx-8 border border-zinc-800 bg-[#121212] rounded-xl overflow-hidden shadow-sm flex flex-col font-sans">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 text-amber-400 p-2 rounded-lg">
            <Terminal size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-200">
              Ran terminal command
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-0.5 truncate max-w-sm">
              {event.title}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 font-mono">
            {event.data?.output ? `${event.data.output.length} chars output` : 'No output'}
          </span>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-zinc-800 bg-black p-4 overflow-x-auto max-h-64 overflow-y-auto">
          <p className="text-xs text-zinc-400 mb-2 leading-relaxed whitespace-pre-wrap">{event.content}</p>
          {event.data?.output && (
            <pre className="text-[11px] font-mono text-green-400/90 leading-relaxed whitespace-pre-wrap">
              {event.data.output}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
