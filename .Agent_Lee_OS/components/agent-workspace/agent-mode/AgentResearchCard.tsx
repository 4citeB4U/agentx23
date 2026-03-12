import React, { useState } from "react";
import { ThreadEvent } from "../types";
import { Search, Globe, ChevronDown, ChevronUp } from "lucide-react";

export const AgentResearchCard: React.FC<{ event: ThreadEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);
  const isWeb = event.type === "research";

  return (
    <div className="my-3 mx-2 sm:mx-8 border border-zinc-800 bg-[#121212] rounded-xl overflow-hidden shadow-sm flex flex-col font-sans">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${isWeb ? 'bg-teal-500/10 text-teal-400' : 'bg-cyan-500/10 text-cyan-400'}`}>
            {isWeb ? <Globe size={18} /> : <Search size={18} />}
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-200">
              {isWeb ? "Researched Web" : "Searched Workspace"}
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-0.5 truncate max-w-sm">
              {event.title}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">
            {event.data?.results?.length || 0} results
          </span>
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-zinc-800 bg-zinc-900/50 p-4 max-h-64 overflow-y-auto">
          {event.content && (
            <div className="text-xs text-zinc-400 mb-4 whitespace-pre-wrap leading-relaxed">
              {event.content}
            </div>
          )}
          {event.data?.results && event.data.results.length > 0 && (
            <div className="space-y-3">
              {event.data.results.map((r: any, i: number) => (
                <div key={i} className="flex flex-col gap-1">
                  <a href={r.url || '#'} className="text-sm font-medium text-blue-400 hover:text-blue-300 transition-colors">
                    {r.title || r.name}
                  </a>
                  {r.snippet && (
                    <div className="text-xs text-zinc-500 leading-relaxed max-w-2xl whitespace-pre-wrap">
                      {r.snippet}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
