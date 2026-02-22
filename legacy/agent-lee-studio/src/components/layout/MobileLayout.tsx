import React, { useEffect, useState } from 'react';
import { MatrixView } from '../MatrixView';
import MemoryLakeCore from '../MemoryLake'; // Actually it was default export in my previous step
import { SettingsControlTower } from '../SettingsControlTower';
import { UnifiedCommandBar } from '../UnifiedCommandBar';
import { SovereignIdentity } from '../../services/SovereignIdentity';

interface MobileLayoutProps {
    onSendMessage: (text: string) => void;
    onToggleMic: () => void;
    isMicActive: boolean;
    messages: any[];
}

export const MobileLayout: React.FC<MobileLayoutProps> = ({
    onSendMessage,
    onToggleMic,
    isMicActive,
    messages
}) => {
    const [activeTab, setActiveTab] = useState<'chat' | 'matrix' | 'files' | 'settings'>('chat');

    // --- Agent Voice (Sovereign TTS Bridge) ---
    const speak = async (text: string) => {
        try {
            const body = { text, voice: 'en-US-AndrewMultilingualNeural' };
            const signedHeaders = await SovereignIdentity.signRequest(body);

            const response = await fetch(`/api/chat/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...signedHeaders
                },
                body: JSON.stringify(body)
            });
            if (!response.ok) throw new Error('TTS_FAILED');
            const blob = await response.blob();
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.play();
            audio.onended = () => URL.revokeObjectURL(url);
        } catch (e) {
            console.warn("Sovereign TTS Fallback due to:", e);
            const utterance = new SpeechSynthesisUtterance(text);
            window.speechSynthesis.speak(utterance);
        }
    };

    useEffect(() => {
        // Greet on mount using the CLONED REFERENCE VOICE (agentvoice.m4a)
        setTimeout(() => {
            const intro = new Audio('/agent_lee_reference_voice.m4a');
            intro.play().catch(e => {
                console.warn("Reference voice play failed, falling back to TTS:", e);
                speak("Agent Lee Online. Systems nominal.");
            });
        }, 1000);
    }, []);

    // SPEAK ON NEW MESSAGE
    useEffect(() => {
        const lastMessage = messages[messages.length - 1];
        if (lastMessage && lastMessage.role === 'model' && !lastMessage.spoken) {
            speak(lastMessage.text);
            lastMessage.spoken = true; // Prevent re-speaking on re-renders
        }
    }, [messages]);

    // Icon components for nav
    const NavTab: React.FC<{ icon: any, label: string, isActive: boolean, onClick: () => void }> = ({ icon: Icon, label, isActive, onClick }) => (
        <button
            onClick={onClick}
            className={`
                flex flex-col items-center justify-center p-2 rounded-2xl transition-all duration-200 min-w-[60px]
                ${isActive ? 'text-accent-cyan bg-accent-cyan/10 scale-110' : 'text-text-muted hover:text-white active:scale-95'}
            `}
        >
            <Icon size={24} className={`mb-1 transition-all ${isActive ? 'drop-shadow-[0_0_8px_rgba(0,240,255,0.5)]' : ''}`} />
            <span className="text-[9px] font-bold tracking-wide uppercase">{label}</span>
            {isActive && <div className="w-1 h-1 rounded-full bg-accent-cyan mt-1 shadow-[0_0_5px_#00f0ff]" />}
        </button>
    );

    return (
        <div className="relative mx-auto h-screen w-full overflow-hidden bg-background-dark text-white font-display selection:bg-primary/30">
            {/* Background Atmosphere & Effects */}
            <div className="pointer-events-none absolute inset-0 scanline z-50"></div>
            <div className="fixed inset-0 bg-gradient-to-b from-panel-dark via-background-dark to-background-dark pointer-events-none z-0" />

            {/* --- HEADER (Stark Style) --- */}
            <header className="sticky top-0 z-40 bg-background-dark/80 backdrop-blur-md border-b border-primary/20 p-4 pb-4 shadow-lg shadow-black/50">
                <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-glow">shield_locked</span>
                        <h1 className="text-sm font-bold tracking-[0.2em] text-primary uppercase">AGENT LEE OS // THE FIRST AGENTIC IDE</h1>
                    </div>
                    <div className="flex gap-4 items-center">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_rgba(13,127,242,0.8)]" />
                        <div className="text-[10px] text-right">
                            <p className="text-white/40 uppercase">Satellite Link</p>
                            <p className="text-primary font-bold animate-pulse">ACTIVE-09</p>
                        </div>
                    </div>
                </div>

                {/* Secondary Header Details */}
                <div className="flex gap-2 mt-2">
                    <div className="flex-1 bg-primary/10 border border-primary/30 rounded p-2">
                        <p className="text-[8px] text-primary/70 uppercase mb-0.5">Encryption</p>
                        <div className="flex items-end justify-between">
                            <span className="text-xs font-bold leading-none">AES-1024</span>
                            <span className="text-[8px] text-accent accent-glow font-bold">SECURE</span>
                        </div>
                    </div>
                    <div className="flex-1 bg-primary/10 border border-primary/30 rounded p-2">
                        <p className="text-[8px] text-primary/70 uppercase mb-0.5">Signal</p>
                        <div className="flex items-end justify-between">
                            <span className="text-xs font-bold leading-none">99.8%</span>
                            <div className="flex gap-0.5 pb-0.5">
                                <div className="w-0.5 h-2 bg-primary"></div>
                                <div className="w-0.5 h-3 bg-primary"></div>
                                <div className="w-0.5 h-2 bg-primary"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            {/* --- MAIN CONTENT --- */}
            <main className="flex-1 h-[calc(100vh-180px)] overflow-hidden z-10 relative">

                {/* 1. CHAT VIEW */}
                <div className={activeTab === 'chat' ? 'block h-full overflow-y-auto px-4 pt-4 pb-24 scrollbar-hide' : 'hidden'}>
                    <h2 className="text-[10px] font-bold tracking-widest text-primary/50 uppercase mb-4 px-2">Incoming Encrypted Signals</h2>

                    <div className="space-y-4">
                        {messages.length === 0 && (
                            <div className="flex items-center justify-center h-32 opacity-30 text-xs font-mono uppercase tracking-widest text-primary">
                                Awaiting Transmission...
                            </div>
                        )}
                        {messages.map((msg) => (
                            <div key={msg.id} className="animate-in slide-in-from-bottom-2 duration-300">
                                {msg.role === 'model' ? (
                                    <div className="relative group">
                                        {/* Agent Message Style */}
                                        <div className="absolute -inset-0.5 bg-primary/20 rounded-lg blur opacity-75"></div>
                                        <div className="relative flex items-start gap-3 bg-panel-dark border border-primary/50 rounded-lg p-3 holographic-glow">
                                            <div className="shrink-0 pt-1">
                                                <span className="material-symbols-outlined text-primary text-sm">smart_toy</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex justify-between items-start mb-1">
                                                    <h3 className="text-primary font-bold text-xs tracking-wider">AGENT LEE</h3>
                                                    <span className="text-[8px] font-bold text-accent px-1 border border-accent/50 rounded">AI-CORE</span>
                                                </div>
                                                <p className="text-white/90 text-sm font-sans leading-relaxed">{msg.text}</p>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex justify-end">
                                        {/* User Message Style */}
                                        <div className="bg-mobile-panel/40 border border-white/10 rounded-lg p-3 max-w-[85%] backdrop-blur-sm">
                                            <div className="flex justify-between items-center mb-1 gap-2">
                                                <h3 className="text-white/60 font-bold text-[10px] uppercase">OPERATOR</h3>
                                                <span className="text-[8px] font-mono text-white/30">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                            <p className="text-white/80 text-sm">{msg.text}</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* 2. MATRIX VIEW */}
                <div className={activeTab === 'matrix' ? 'block h-full' : 'hidden'}>
                    <div className="h-full w-full flex flex-col p-2">
                        <div className="rounded-xl overflow-hidden border border-primary/30 shadow-[0_0_20px_rgba(13,127,242,0.1)] bg-black flex-1 relative">
                            <div className="absolute top-2 left-2 z-20 bg-black/60 backdrop-blur px-2 py-1 border border-primary/20 rounded text-[9px] text-primary font-mono">
                                LIVE FEED // {activeTab === 'matrix' ? 'CONNECTED' : 'OFFLINE'}
                            </div>
                            <div className="absolute inset-0 overflow-hidden">
                                <MatrixView />
                            </div>
                        </div>
                    </div>
                </div>

                {/* 3. FILES VIEW */}
                <div className={activeTab === 'files' ? 'block h-full' : 'hidden'}>
                    <div className="h-full flex flex-col">
                        <div className="bg-panel-dark/50 px-4 py-2 border-b border-primary/20 flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-xs">folder_open</span>
                            <h2 className="text-[10px] font-bold uppercase tracking-widest text-primary">/root/memory-lake</h2>
                        </div>
                        <div className="flex-1 overflow-auto p-0 bg-transparent">
                            <MemoryLakeCore />
                        </div>
                    </div>
                </div>

                {/* 4. SYSTEM VIEW */}
                <div className={activeTab === 'settings' ? 'block h-full' : 'hidden'}>
                    <SettingsControlTower />
                </div>
            </main>

            {/* --- COMMAND BAR (Overlay) --- */}
            <div className={`
                fixed z-50 transition-all duration-300 ease-out left-0 right-0 px-4
                ${activeTab === 'chat' ? 'bottom-28 translate-y-0 opacity-100' : 'bottom-0 translate-y-10 opacity-0 pointer-events-none'}
            `}>
                <UnifiedCommandBar
                    onSendMessage={onSendMessage}
                    onToggleMic={onToggleMic}
                    isMicActive={isMicActive}
                />
            </div>

            {/* --- BOTTOM NAV (Stark Style) --- */}
            <nav className="fixed bottom-0 left-0 right-0 max-w-[430px] mx-auto z-50 p-6 pt-0 pointer-events-none">
                <div className="pointer-events-auto bg-background-dark/90 backdrop-blur-xl border border-primary/30 rounded-2xl flex items-center justify-around p-3 holographic-glow shadow-2xl">
                    <button onClick={() => setActiveTab('matrix')} className={`flex flex-col items-center gap-1 group transition-all ${activeTab === 'matrix' ? 'text-primary' : 'text-white/40'}`}>
                        <div className={`size-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'matrix' ? 'bg-primary/20' : 'group-hover:bg-primary/10'}`}>
                            <span className="material-symbols-outlined">grid_view</span>
                        </div>
                    </button>

                    {/* Central Comms Button */}
                    <button onClick={() => setActiveTab('chat')} className="flex flex-col items-center gap-1 group -mt-8">
                        <div className={`size-14 rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(13,127,242,0.5)] border-4 border-background-dark transition-all ${activeTab === 'chat' ? 'bg-primary text-white scale-110' : 'bg-panel-dark text-primary border-primary/50'}`}>
                            <span className="material-symbols-outlined text-[24px]">cell_tower</span>
                        </div>
                        <span className={`text-[9px] font-bold tracking-tighter mt-1 uppercase ${activeTab === 'chat' ? 'text-primary' : 'text-white/40'}`}>Comms</span>
                    </button>

                    <button onClick={() => setActiveTab('files')} className={`flex flex-col items-center gap-1 group transition-all ${activeTab === 'files' ? 'text-primary' : 'text-white/40'}`}>
                        <div className={`size-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'files' ? 'bg-primary/20' : 'group-hover:bg-primary/10'}`}>
                            <span className="material-symbols-outlined">folder</span>
                        </div>
                    </button>

                    <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center gap-1 group transition-all ${activeTab === 'settings' ? 'text-primary' : 'text-white/40'}`}>
                        <div className={`size-10 rounded-xl flex items-center justify-center transition-all ${activeTab === 'settings' ? 'bg-primary/20' : 'group-hover:bg-primary/10'}`}>
                            <span className="material-symbols-outlined">settings</span>
                        </div>
                    </button>
                </div>
            </nav>

            <div className="fixed bottom-2 right-2 z-[60] opacity-50 pointer-events-none">
                <span className="text-[8px] font-mono text-white/30 uppercase tracking-widest">By Leeway Innovation</span>
            </div>
        </div>
    );
};
