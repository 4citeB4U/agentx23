import { Settings, Sparkles } from 'lucide-react';
import React from 'react';

interface AgentLeeHeaderProps {
    persona?: string;
    isMicActive?: boolean;
}

export const AgentLeeHeader: React.FC<AgentLeeHeaderProps> = ({
    persona = "ARCHITECT",
    isMicActive = false
}) => {
    return (
        <header className="h-16 bg-studio-panel border-b border-studio-border flex items-center justify-between px-6 shrink-0 z-50 shadow-2xl">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-3 group cursor-pointer">
                    <div className="relative">
                        <Sparkles size={24} className="text-studio-accent group-hover:scale-110 transition-transform duration-300" />
                        <div className="absolute inset-0 bg-studio-accent/20 blur-xl rounded-full animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-studio-text font-bold tracking-widest text-sm uppercase">Agent Lee OS</span>
                        <span className="text-[10px] text-studio-secondary tracking-[0.2em] font-mono opacity-60">PHASE 1 // {persona}</span>
                    </div>
                </div>

                <div className="h-8 w-px bg-studio-border/50"></div>

                <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-full border border-studio-border/30">
                    <div className={`w-2 h-2 rounded-full ${isMicActive ? 'bg-red-500 animate-pulse' : 'bg-studio-secondary/30'}`} />
                    <span className="text-[11px] font-mono text-studio-secondary uppercase tracking-tighter">
                        Voice Route: {isMicActive ? 'ACTIVE' : 'STANDBY'}
                    </span>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 bg-black/20 border border-studio-border/40 rounded-lg p-1">
                    <button className="p-2 hover:bg-studio-border/50 rounded-md text-studio-secondary transition-all">
                        <Settings size={18} />
                    </button>
                </div>

                <button className="flex items-center gap-2 px-4 py-2 bg-studio-accent text-studio-bg rounded-lg font-bold text-xs hover:opacity-90 active:scale-95 transition-all">
                    SYSTEM_REBOOT
                </button>
            </div>
        </header>
    );
};
