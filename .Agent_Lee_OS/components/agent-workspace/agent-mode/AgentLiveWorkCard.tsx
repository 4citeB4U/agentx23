import React, { useState } from "react";
import { ThreadEvent, TaskPlan } from "../types";
import { Loader2, Zap, LayoutTemplate, Activity, ChevronRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface AgentLiveWorkCardProps {
  event?: ThreadEvent; // the 'thinking' event
  plan: TaskPlan | null;
  status: string;
}

export const AgentLiveWorkCard: React.FC<AgentLiveWorkCardProps> = ({ event, plan, status }) => {
  const [expanded, setExpanded] = useState(true);

  if (!event && !plan) return null;

  // If there's a plan, find active steps
  const currentStepNum = plan ? plan.currentStep : 0;
  const currentStep = plan?.steps[currentStepNum];
  
  return (
    <div className="my-4 mx-2 sm:mx-8 border border-zinc-800 bg-[#1e1e24] shadow-md rounded-xl overflow-hidden font-sans">
      <div 
        className="px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-zinc-800/50 transition-colors bg-[#25252b]"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-3">
          <div className="text-blue-400">
            {status === "executing" || status === "planning" || status === "thinking" ? (
              <Loader2 size={18} className="animate-spin" />
            ) : status === "replanning" ? (
              <Activity size={18} className="text-amber-500 animate-pulse" />
            ) : (
              <Zap size={18} />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
              {status === "planning" ? "Planning next moves..." 
                : status === "replanning" ? "Rethinking approach..."
                : currentStep ? `Step ${currentStepNum + 1}: ${currentStep.title}`
                : "Agent Lee is working..."}
            </div>
            {plan && (
              <div className="text-[11px] text-zinc-500 font-medium tracking-wide">
                {plan.steps.filter(s => s.status === "done").length}/{plan.steps.length} steps complete
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center text-zinc-500">
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-zinc-800 bg-[#121212] overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Event Content (if it's a thinking or error event) */}
              {event && event.content && (
                <div className="text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 p-3 rounded-lg leading-relaxed whitespace-pre-wrap font-mono relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-500 rounded-l" />
                  {event.content}
                </div>
              )}

              {/* Plan Pipeline */}
              {plan && plan.steps.length > 0 && (
                <div className="space-y-2 mt-2">
                  <div className="text-[10px] text-zinc-600 uppercase font-black tracking-widest px-1">
                    Execution Pipeline
                  </div>
                  <div className="border border-zinc-800/50 rounded-lg p-3 space-y-3 bg-[#18181b]">
                    {plan.steps.map((step, idx) => {
                      const isActive = step.status === "running";
                      const isDone = step.status === "done";
                      const isFailed = step.status === "error";
                      
                      return (
                        <div key={idx} className={`flex items-start gap-3 transition-opacity ${isDone ? "opacity-60" : "opacity-100"}`}>
                          <div className="shrink-0 pt-0.5">
                            {isActive ? (
                              <Loader2 size={12} className="text-blue-400 animate-spin" />
                            ) : isDone ? (
                              <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50 flex items-center justify-center" />
                            ) : isFailed ? (
                              <div className="w-3 h-3 rounded-full bg-red-500/20 border border-red-500/50 flex items-center justify-center" />
                            ) : (
                              <div className="w-3 h-3 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center px-1 text-[8px] font-bold text-zinc-500">
                                {idx + 1}
                              </div>
                            )}
                          </div>
                          
                          <div className="flex-grow min-w-0">
                            <div className={`text-xs font-semibold ${isActive ? "text-blue-300" : isDone ? "text-zinc-500 line-through" : isFailed ? "text-red-400" : "text-zinc-400"}`}>
                              {step.title}
                            </div>
                            {step.description && !isDone && (
                              <div className="text-[10px] text-zinc-600 mt-0.5">
                                {step.description}
                              </div>
                            )}
                          </div>
                          {step.tool && (
                            <span className="text-[9px] font-mono text-zinc-500 uppercase tracking-wider shrink-0 bg-zinc-800 px-1.5 py-0.5 rounded">
                              {step.tool}
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
