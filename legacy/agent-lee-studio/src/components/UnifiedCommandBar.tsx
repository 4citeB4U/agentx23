import { Command, Mic, PlusCircle, SendHorizontal, Sparkles } from 'lucide-react';
import React, { useState } from 'react';

interface UnifiedCommandBarProps {
    onSendMessage: (text: string) => void;
    onToggleMic: () => void;
    isMicActive: boolean;
}

export const UnifiedCommandBar: React.FC<UnifiedCommandBarProps> = ({
    onSendMessage,
    onToggleMic,
    isMicActive
}) => {
    const [input, setInput] = useState('');

    const handleSend = () => {
        if (!input.trim()) return;
        onSendMessage(input);
        setInput('');
    };

    return (
        <div className={`
            w-full relative group z-50
            md:static md:w-full md:block
            fixed bottom-[var(--nav-bar-height)] left-0 right-0 px-4 pb-4 md:pb-0 /* Mobile docking */
        `}>
            <div className={`
                relative flex items-center bg-glass-surface backdrop-blur-xl border rounded-full transition-all duration-300
                ${input ? 'border-accent-cyan/50 shadow-[0_0_20px_rgba(0,240,255,0.15)]' : 'border-white/10 hover:border-white/20'}
                h-12 md:h-14 /* Larger touch target */
            `}>
                <div className="pl-4 pr-3 py-3 text-accent-cyan/70">
                    <Command size={20} />
                </div>

                <input
                    className="flex-1 bg-transparent text-sm md:text-base text-white placeholder-text-muted focus:outline-none font-medium tracking-wide"
                    placeholder="Describe mission objective..."
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                />

                <div className="flex items-center gap-2 pr-2">
                    <button
                        onClick={onToggleMic}
                        aria-label={isMicActive ? "Disable Microphone" : "Enable Microphone"}
                        title={isMicActive ? "Disable Microphone" : "Enable Microphone"}
                        className={`p-3 md:p-2 rounded-full transition-all duration-300 ${isMicActive ? 'bg-red-500/20 text-red-500 animate-pulse' : 'text-text-dim hover:text-white hover:bg-white/10'}`}
                    >
                        <Mic size={20} />
                    </button>
                    <button
                        onClick={handleSend}
                        disabled={!input.trim()}
                        aria-label="Send Message"
                        title="Send Message"
                        className={`p-3 md:p-2 rounded-full transition-all duration-300 ${input.trim() ? 'bg-accent-cyan text-black scale-100' : 'text-text-muted scale-90 opacity-50'}`}
                    >
                        <SendHorizontal size={20} />
                    </button>
                </div>
            </div>

            {/* Context Actions (Slide Down/Up) */}
            <div className="
                absolute md:top-full top-auto bottom-full left-4 right-4 
                pt-2 md:pt-2 pb-2 md:pb-0
                opacity-0 group-hover:opacity-100 transition-all duration-300 
                translate-y-[-10px] group-hover:translate-y-0 pointer-events-none group-hover:pointer-events-auto
            ">
                <div className="flex items-center justify-center gap-4">
                    <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-text-dim hover:text-accent-cyan hover:border-accent-cyan/30 transition-colors uppercase tracking-wider backdrop-blur-md">
                        <PlusCircle size={12} /> Add_Context
                    </button>
                    <button className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/60 border border-white/10 text-[10px] font-bold text-text-dim hover:text-accent-plasma hover:border-accent-plasma/30 transition-colors uppercase tracking-wider backdrop-blur-md">
                        <Sparkles size={12} /> AI_Reasoning
                    </button>
                </div>
            </div>
        </div>
    );
};
