import React from "react";
import { ThreadEvent } from "../types";
import { Trophy, CheckCircle } from "lucide-react";

export const CompletionCard: React.FC<{ event: ThreadEvent }> = ({ event }) => {
  return (
    <div className="my-6 mx-2 sm:mx-8 border-2 border-green-500/30 bg-green-500/10 rounded-xl overflow-hidden shadow-lg flex flex-col font-sans">
      <div className="px-6 py-6 flex flex-col items-center justify-center text-center">
        <div className="bg-green-500/20 text-green-400 p-4 rounded-full mb-4 shadow-[0_0_30px_rgba(34,197,94,0.3)]">
          <Trophy size={32} />
        </div>
        <h3 className="text-xl font-bold text-green-400 mb-2">Task Complete</h3>
        <p className="text-sm text-green-200/80 mb-6 max-w-lg leading-relaxed whitespace-pre-wrap">
          {event.content || "Agent Lee has successfully completed the requested task."}
        </p>

        {event.verification?.verified && (
          <div className="inline-flex items-center gap-2 bg-black/40 px-4 py-2 rounded-full border border-green-500/20">
            <CheckCircle size={16} className="text-green-500" />
            <span className="text-xs font-semibold uppercase tracking-widest text-green-500">
              Verified: {event.verification.evidence || "All steps completed successfully"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
