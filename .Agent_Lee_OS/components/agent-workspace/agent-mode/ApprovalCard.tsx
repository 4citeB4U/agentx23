import React from "react";
import { ThreadEvent } from "../types";
import { Lock, ThumbsUp, ThumbsDown } from "lucide-react";

export const ApprovalCard: React.FC<{
  event: ThreadEvent;
  onApproval: (id: string, approved: boolean) => void;
}> = ({ event, onApproval }) => {
  return (
    <div className="my-3 mx-2 sm:mx-8 border border-orange-500/30 bg-orange-500/5 rounded-xl overflow-hidden shadow-sm flex flex-col font-sans">
      <div className="px-4 py-4 flex items-start gap-3">
        <div className="bg-orange-500/20 text-orange-400 p-2 rounded-lg shrink-0 mt-0.5">
          <Lock size={20} />
        </div>
        <div className="flex-grow min-w-0">
          <div className="text-sm font-semibold text-zinc-100 flex items-center justify-between">
            <span>Action Requires Approval</span>
            {event.approvalState && event.approvalState !== "pending" && (
              <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${
                event.approvalState === "approved" ? "bg-emerald-500/20 text-emerald-400" : "bg-zinc-800 text-zinc-400"
              }`}>
                {event.approvalState}
              </span>
            )}
          </div>
          <div className="text-sm text-zinc-300 mt-2 mb-4 leading-relaxed whitespace-pre-wrap">
            {event.content}
          </div>
          
          {event.approvalState === "pending" && (
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => onApproval(event.id, true)}
                className="flex items-center gap-2 px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
              >
                <ThumbsUp size={16} />
                Approve
              </button>
              <button
                onClick={() => onApproval(event.id, false)}
                className="flex items-center gap-2 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm font-semibold rounded-lg transition-colors shadow-sm border border-white/10"
              >
                <ThumbsDown size={16} />
                Deny
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
