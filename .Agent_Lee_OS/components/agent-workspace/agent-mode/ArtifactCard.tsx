import React, { useState } from "react";
import { ThreadEvent } from "../types";
import { Package, ChevronDown, ChevronUp } from "lucide-react";

export const ArtifactCard: React.FC<{ event: ThreadEvent }> = ({ event }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="my-3 mx-2 sm:mx-8 border border-violet-500/30 bg-violet-500/5 rounded-xl overflow-hidden shadow-sm flex flex-col font-sans">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-violet-500/10 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="bg-violet-500/20 text-violet-400 p-2 rounded-lg">
            <Package size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-200">
              Artifact Generated
            </div>
            <div className="text-xs text-zinc-500 font-mono mt-0.5 truncate max-w-sm">
              {event.title}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {expanded ? <ChevronUp size={16} className="text-zinc-500" /> : <ChevronDown size={16} className="text-zinc-500" />}
        </div>
      </div>
      
      {expanded && (
        <div className="border-t border-violet-500/20 bg-black p-4 overflow-x-auto max-h-64 overflow-y-auto">
          <p className="text-xs text-zinc-400 mb-2 leading-relaxed whitespace-pre-wrap">{event.content}</p>
          {event.data?.content && (
            <pre className="text-[11px] font-mono text-zinc-300 leading-relaxed whitespace-pre-wrap p-2 bg-zinc-900 rounded">
              {event.data.content}
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
