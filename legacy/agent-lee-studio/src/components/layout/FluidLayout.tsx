import React, { useState } from 'react';
import { DeployPanel } from '../DeployPanel';
import { FileExplorer } from '../FileExplorer';
import { FloatingAgentContainer } from '../FloatingAgentContainer';
import { MatrixView } from '../MatrixView';
import { SettingsControlTower } from '../SettingsControlTower';
import { TelemetryDashboard } from '../TelemetryDashboard';
import { UnifiedCommandBar } from '../UnifiedCommandBar';
import { OrbitalNav } from './OrbitalNav';

/**
 * FLUID LAYOUT
 * The next-gen visual architecture for Sovereign OS V3.
 * Features: Living Backgrounds, Z-Layer depth, and Orbital Navigation.
 */

interface LayoutProps {
    onSendMessage: (text: string) => void;
    isMicActive: boolean;
    onToggleMic: () => void;
    messages: any[];
}

export const FluidLayout: React.FC<LayoutProps> = ({
    onSendMessage,
    isMicActive,
    onToggleMic,
    messages
}) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const [selectedFileNode, setSelectedFileNode] = useState<{ name: string; type: 'file' | 'folder'; path: string } | null>(null);

    // --- Z-Layer 2: Content Projection ---
    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="flex h-full animate-in fade-in zoom-in-95 duration-500">
                        {/* Main Work Area */}
                        <div className="flex-1 relative p-6">
                            {/* Static VoxelCore Removed - Agent is now floating */}

                            {/* Floating HUD Elements */}
                            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-6 h-full pointer-events-none">
                                <div className="glass-panel rounded-3xl p-6 pointer-events-auto flex flex-col hover:border-accent-cyan/30 transition-colors">
                                    <h2 className="text-xs font-bold uppercase tracking-widest text-accent-cyan mb-4 glow-text">Mission Status</h2>
                                    <div className="flex-1 overflow-hidden">
                                        <div className="h-full flex items-center justify-center border-2 border-dashed border-white/5 rounded-xl">
                                            <span className="text-xs font-mono text-text-muted">Awaiting_Directives...</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="glass-panel rounded-3xl p-6 pointer-events-auto flex flex-col border border-white/5 hover:border-accent-magenta/30 transition-colors">
                                    <h2 className="text-xs font-bold uppercase tracking-widest text-accent-magenta mb-4">Comms Stream</h2>
                                    <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                                        {messages.length === 0 ? (
                                            <div className="h-full flex items-center justify-center border border-dashed border-white/10 rounded-xl text-xs font-mono text-text-muted">
                                                Awaiting_Transmission...
                                            </div>
                                        ) : (
                                            messages.slice(-20).map((msg) => (
                                                <div key={msg.id} className={`rounded-xl px-3 py-2 border ${msg.role === 'model' ? 'border-accent-cyan/30 bg-accent-cyan/5' : 'border-accent-magenta/30 bg-accent-magenta/5'}`}>
                                                    <div className="text-[9px] font-mono uppercase tracking-widest text-text-dim mb-1">
                                                        {msg.role === 'model' ? 'Agent Lee' : 'Operator'}
                                                    </div>
                                                    <div className="text-xs leading-relaxed text-text-primary">{msg.text}</div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Telemetry Slide-out (Right) */}
                        <div className="w-[380px] h-full p-4 pl-0">
                            <div className="h-full glass-panel rounded-3xl overflow-hidden relative">
                                <TelemetryDashboard />
                            </div>
                        </div>
                    </div>
                );
            case 'matrix':
                return (
                    <div className="flex h-full p-4 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex-1 glass-panel rounded-3xl overflow-hidden border-accent-plasma/30 shadow-[0_0_30px_rgba(112,0,255,0.1)]">
                            <MatrixView />
                        </div>
                    </div>
                );
            case 'files':
                return (
                    <div className="flex h-full p-4 animate-in fade-in zoom-in-95 duration-500">
                        <div className="w-80 glass-panel rounded-l-3xl border-r-0 overflow-hidden">
                            <FileExplorer onSelectNode={(node) => setSelectedFileNode(node)} />
                        </div>
                        <div className="flex-1 glass-panel rounded-r-3xl overflow-hidden bg-black/40 p-6">
                            <div className="h-full flex flex-col">
                                <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-5">
                                    <h3 className="text-xs font-bold uppercase tracking-widest text-accent-cyan">File Workspace</h3>
                                    <span className="text-[10px] font-mono text-text-muted uppercase">Explorer_Linked</span>
                                </div>

                                {selectedFileNode ? (
                                    <div className="space-y-4">
                                        <div className="glass-card rounded-2xl p-5 border border-white/10">
                                            <div className="text-[10px] font-mono text-text-muted uppercase mb-2">Selected Node</div>
                                            <div className="text-lg font-bold text-white tracking-tight">{selectedFileNode.name}</div>
                                            <div className="text-[11px] text-text-dim mt-2 font-mono">{selectedFileNode.path}</div>
                                            <div className="mt-4 inline-flex px-2 py-1 rounded-full bg-white/5 border border-white/10 text-[10px] uppercase tracking-wider text-accent-cyan">
                                                {selectedFileNode.type === 'folder' ? 'Directory' : 'File'}
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <button className="glass-card rounded-xl p-4 border border-white/10 hover:border-accent-cyan/40 text-left transition-colors">
                                                <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Action</div>
                                                <div className="text-sm font-semibold text-white">Open In Editor</div>
                                            </button>
                                            <button className="glass-card rounded-xl p-4 border border-white/10 hover:border-accent-cyan/40 text-left transition-colors">
                                                <div className="text-[10px] font-mono text-text-muted uppercase mb-1">Action</div>
                                                <div className="text-sm font-semibold text-white">Inspect Metadata</div>
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center">
                                        <div className="text-center opacity-50">
                                            <div className="w-16 h-16 rounded-full border-2 border-dashed border-white/20 flex items-center justify-center mx-auto mb-4">
                                                <div className="w-2 h-2 bg-white rounded-full animate-ping"></div>
                                            </div>
                                            <span className="text-xs font-mono uppercase tracking-widest text-text-dim">Select a file or folder from Explorer</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            case 'settings':
                return (
                    <div className="flex h-full p-4 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex-1 glass-panel rounded-3xl overflow-hidden">
                            <SettingsControlTower />
                        </div>
                    </div>
                );
            case 'deploy':
                return (
                    <div className="flex h-full p-4 animate-in fade-in zoom-in-95 duration-500">
                        <div className="flex-1 glass-panel rounded-3xl overflow-hidden">
                            <DeployPanel />
                        </div>
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <div className="h-screen w-screen relative overflow-hidden text-text-primary selection:bg-accent-cyan/30">

            {/* --- Z-Layer 0: Living Background --- */}
            <div className="aurora-bg">
                <div className="aurora-orb orb-1"></div>
                <div className="aurora-orb orb-2"></div>
                <div className="aurora-orb orb-3"></div>
            </div>

            {/* --- Z-Layer 100: Floating Agent Presence (Draggable & Context Aware) --- */}
            <FloatingAgentContainer activeTab={activeTab} messages={messages} />

            {/* --- Z-Layer 1: Orbital Navigation (Left Dock) --- */}
            <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50">
                <OrbitalNav
                    activeTab={activeTab}
                    onTabChange={setActiveTab}
                    isCollapsed={isSidebarCollapsed}
                    onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                />
            </div>

            {/* --- Z-Layer 2: Main Content Area --- */}
            <main className="absolute inset-0 z-10 pl-24 pt-20 pb-24 pr-4">
                {renderContent()}
            </main>

            {/* --- Z-Layer 3: Top Command Bar (Floating) --- */}
            <div className={`
                z-50 w-full px-4
                md:absolute md:top-6 md:left-1/2 md:-translate-x-1/2 md:w-[600px]
                pointer-events-none md:pointer-events-auto /* Let clicks pass through on mobile wrapper if needed */
            `}>
                <div className="pointer-events-auto md:glass-panel md:rounded-full md:px-2 md:py-2 md:shadow-2xl md:shadow-accent-cyan/10 md:border-t md:border-white/10">
                    <UnifiedCommandBar
                        onSendMessage={onSendMessage}
                        onToggleMic={onToggleMic}
                        isMicActive={isMicActive}
                    />
                </div>
            </div>

            {/* --- Z-Layer 4: Notifications / Chat Overlay --- */}
            <div className="absolute top-8 right-8 z-50 w-80 pointer-events-none space-y-4">
                {messages.slice(-3).map((msg, i) => (
                    <div key={i} className={`fade-in glass-card p-4 rounded-2xl border-l-[3px] ${msg.role === 'model' ? 'border-l-accent-cyan' : 'border-l-accent-magenta'}`}>
                        <div className="text-[9px] font-mono text-text-dim mb-1 uppercase tracking-widest flex items-center gap-2">
                            <div className={`w-1.5 h-1.5 rounded-full ${msg.role === 'model' ? 'bg-accent-cyan' : 'bg-accent-magenta'}`}></div>
                            {msg.role === 'model' ? 'AGENT_LEE // HOLOGRAM' : 'OPERATOR'}
                        </div>
                        <div className="text-[12px] leading-relaxed font-medium">
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
