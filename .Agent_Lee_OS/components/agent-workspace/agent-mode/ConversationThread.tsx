import React, { useState } from "react";
import { ThreadEvent, TaskPlan, Artifact } from "../types";
import { User, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { AgentTerminalCard } from "./AgentTerminalCard";
import { AgentFileCard } from "./AgentFileCard";
import { AgentResearchCard } from "./AgentResearchCard";
import { ApprovalCard } from "./ApprovalCard";
import { ArtifactCard } from "./ArtifactCard";
import { CompletionCard } from "./CompletionCard";
import { AgentLiveWorkCard } from "./AgentLiveWorkCard";

interface ConversationThreadProps {
  thread: ThreadEvent[];
  isThinking: boolean;
  plan: TaskPlan | null;
  status: string;
  onApproval: (id: string, approved: boolean) => void;
  onOpenFile: (path: string) => void;
  threadEndRef: React.RefObject<HTMLDivElement>;
}

export const ConversationThread: React.FC<ConversationThreadProps> = ({
  thread,
  isThinking,
  plan,
  status,
  onApproval,
  onOpenFile,
  threadEndRef
}) => {
  const thinkingEvent = thread.find(e => e.status === "running" || (e.status === "pending" && !plan));
  const showLiveCard = isThinking || (plan && plan.steps.some((s) => s.status === "running" || s.status === "done"));

  return (
    <div className="flex flex-col w-full max-w-4xl mx-auto h-full px-4 sm:px-8 pt-8 pb-32 overflow-y-auto font-sans bg-[#0f0f13] text-zinc-100 placeholder-zinc-500">
      {thread.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-center mt-32">
          <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center mb-6 shadow-[0_0_40px_rgba(59,130,246,0.2)] border border-blue-500/20">
            <Sparkles size={28} className="text-blue-400" />
          </div>
          <h2 className="text-2xl font-semibold text-zinc-100 mb-3 tracking-tight">
            How can I help you today?
          </h2>
          <p className="text-[15px] text-zinc-400 max-w-md leading-relaxed">
            Agent Lee is ready. I can search the web, read and write files, deploy apps, run commands, and even operate your device using vision and tools.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <AnimatePresence initial={false}>
            {thread.map((evt) => {
              if (evt.type === "goal") {
                return (
                  <motion.div 
                    key={evt.id}
                    initial={{ opacity: 0, scale: 0.95, y: 10 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="flex flex-row-reverse items-start gap-4 mb-8 mt-4"
                  >
                    <div className="w-8 h-8 rounded-full bg-zinc-700 flex flex-shrink-0 items-center justify-center shadow-md">
                      <User size={16} className="text-zinc-300" />
                    </div>
                    <div className="bg-[#2f2f2f] text-zinc-100 px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] text-[15px] shadow-sm leading-relaxed whitespace-pre-wrap">
                      {evt.content}
                    </div>
                  </motion.div>
                );
              }

              if (evt.type === "narration" || evt.type === "user_message" || evt.type === "thinking") {
                if (evt.type === "narration" || evt.type === "thinking") {
                  return (
                    <motion.div 
                      key={evt.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-start gap-4 my-6 px-1"
                    >
                      <div className="w-8 h-8 rounded-full bg-[#10a37f] flex flex-shrink-0 items-center justify-center shadow-[0_0_15px_rgba(16,163,127,0.4)] mt-1">
                        <Sparkles size={16} className="text-white" />
                      </div>
                      <div className="text-zinc-200 text-[15px] pt-1 leading-relaxed whitespace-pre-wrap max-w-3xl font-sans">
                        {evt.content}
                      </div>
                    </motion.div>
                  );
                }
                return null;
              }

              if (evt.type === "command" || evt.type === "build" || evt.type === "test") {
                return <AgentTerminalCard key={evt.id} event={evt} />;
              }
              if (evt.type === "read_file" || evt.type === "write_file") {
                return <AgentFileCard key={evt.id} event={evt} onOpenFile={onOpenFile} />;
              }
              if (evt.type === "search" || evt.type === "research") {
                return <AgentResearchCard key={evt.id} event={evt} />;
              }
              if (evt.type === "approval") {
                return <ApprovalCard key={evt.id} event={evt} onApproval={onApproval} />;
              }
              if (evt.type === "artifact") {
                return <ArtifactCard key={evt.id} event={evt} />;
              }
              if (evt.type === "complete") {
                return <CompletionCard key={evt.id} event={evt} />;
              }
              if (evt.type === "error") {
                return (
                  <div key={evt.id} className="my-3 mx-2 sm:mx-8 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                    <div className="text-red-400 font-bold mb-1">Task Failed</div>
                    <div className="text-sm text-red-300/80">{evt.content}</div>
                  </div>
                );
              }

              return null;
            })}
          </AnimatePresence>

          {showLiveCard && (
            <div className="my-2 transition-all">
              <AgentLiveWorkCard 
                 event={thinkingEvent} 
                 plan={plan} 
                 status={status} 
              />
            </div>
          )}

          <div ref={threadEndRef as any} className="h-4" />
        </div>
      )}
    </div>
  );
};
