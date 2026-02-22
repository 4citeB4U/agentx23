import React, { useState } from 'react';
import { DeployPanel } from './DeployPanel';
import { FileExplorer } from './FileExplorer';
import { MatrixView } from './MatrixView';
import { SettingsControlTower } from './SettingsControlTower';
import { SovereignSidebar } from './SovereignSidebar';
import { TelemetryDashboard } from './TelemetryDashboard';
import { UnifiedCommandBar } from './UnifiedCommandBar';
import { VoxelCore } from './VoxelCore';

/**
 * SOVEREIGN LAYOUT
 * The unified structural shell for the redesigned Agent Lee OS.
 */

interface LayoutProps {
    onSendMessage: (text: string) => void;
    isMicActive: boolean;
    onToggleMic: () => void;
    messages: any[];
}

export const SovereignLayout: React.FC<LayoutProps> = ({
    onSendMessage,
    isMicActive,
    onToggleMic,
    messages
}) => {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
    const overlayDelayClass = ['delay-0', 'delay-200', 'delay-[400ms]'];

    const renderContent = () => {
        switch (activeTab) {
            case 'dashboard':
                return (
                    <div className="flex-1 flex overflow-hidden">
                        <div className="flex-1 relative">
                            <VoxelCore />
                            {/* Overlay HUDs */}
                            <div className="absolute top-6 left-6 z-20 pointer-events-none fade-in">
                                <div className="glass p-3 rounded-xl border-l-4 border-l-studio-accent">
                                    <span className="text-[10px] font-mono text-studio-accent uppercase tracking-widest">MISSION_SECTOR: ORCHESTRATION</span>
                                </div>
                            </div>
                        </div>
                        <div className="w-[400px] border-l border-studio-border bg-black/40 backdrop-blur-md overflow-y-auto">
                            <TelemetryDashboard />
                        </div>
                    </div>
                );
            case 'matrix':
                return <MatrixView />;
            case 'files':
                return (
                    <div className="flex-1 flex overflow-hidden">
                        <div className="w-80 border-r border-studio-border shrink-0">
                            <FileExplorer />
                        </div>
                        <div className="flex-1 flex flex-col items-center justify-center bg-studio-surface opacity-30 gap-4">
                            <div className="w-20 h-24 border border-white/20 rounded-lg flex items-center justify-center">
                                <div className="w-12 h-1 bg-white/10 rounded-full"></div>
                            </div>
                            <span className="text-[10px] font-mono uppercase tracking-[0.4em]">Awaiting_Selection</span>
                        </div>
                    </div>
                );
            case 'deploy':
                return <DeployPanel />;
            case 'settings':
                return <SettingsControlTower />;
            default:
                return (
                    <div className="flex-1 flex items-center justify-center text-studio-text-muted font-mono uppercase text-xs tracking-widest bg-studio-surface italic">
                        Sector_Under_Construction...
                    </div>
                );
        }
    };

    return (
        <div className="h-screen w-screen flex bg-studio-bg text-studio-text overflow-hidden">
            <SovereignSidebar
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isCollapsed={isSidebarCollapsed}
                onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
            />

            <main className="flex-1 flex flex-col min-w-0 relative">
                <div className="flex-1 flex overflow-hidden">
                    {renderContent()}
                </div>

                {/* Global Unified Command Bar */}
                <UnifiedCommandBar
                    onSendMessage={onSendMessage}
                    onToggleMic={onToggleMic}
                    isMicActive={isMicActive}
                />
            </main>

            {/* Right Chat Overlay */}
            <div className="fixed top-8 right-8 z-[60] w-80 pointer-events-none space-y-4">
                {messages?.slice(-3).map((msg, i) => (
                    <div key={i} className={`fade-in glass-card p-3 border-l-2 ${msg.role === 'model' ? 'border-l-studio-accent' : 'border-l-studio-secondary'} transform transition-all duration-1000 ${overlayDelayClass[i] || 'delay-0'}`} style={{ animationDelay: `${i * 200}ms` }}>
                        <div className="text-[9px] font-mono text-studio-text-dim mb-1 uppercase opacity-60 tracking-tighter">
                            {msg.role === 'model' ? 'AGENT_LEE // SECURE_BRIDGE' : 'OPERATOR // AUTHORIZED'}
                        </div>
                        <div className="text-[11px] leading-relaxed text-studio-text font-medium truncate-multiline">
                            {msg.text}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
