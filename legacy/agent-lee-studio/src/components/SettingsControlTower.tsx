import { Activity, Database, Globe, Settings as SettingsIcon, Shield, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { DeployPanel } from './DeployPanel';
import { SystemTelemetry } from './SystemTelemetry';
import { TelemetryDashboard } from './TelemetryDashboard';

/**
 * SETTINGS CONTROL TOWER (V3)
 * Redesigned for Fluid Intelligence with glass panels and holographic cards.
 */

type SettingsTab = 'system' | 'security' | 'integrations' | 'identity' | 'genesis';

export const SettingsControlTower: React.FC = () => {
    const [activeTab, setActiveTab] = useState<SettingsTab>('system');

    const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
        { id: 'system', label: 'System Dashboard', icon: <Activity size={14} /> },
        { id: 'security', label: 'Security & Sovereignty', icon: <Shield size={14} /> },
        { id: 'integrations', label: 'Integrations', icon: <Globe size={14} /> },
        { id: 'identity', label: 'Agent Lee Identity', icon: <Database size={14} /> },
        { id: 'genesis', label: 'Genesis Engine', icon: <Sparkles size={14} /> }
    ];

    const renderTabContent = () => {
        switch (activeTab) {
            case 'system':
                return <SystemDiagnosticsTab />;
            case 'security':
                return <SecurityTab />;
            case 'integrations':
                return <IntegrationsTab />;
            case 'identity':
                return <VoiceIdentityTab />;
            case 'genesis':
                return <PanelPlaceholder title="Genesis Engine" icon={<Sparkles size={48} />} />;
        }
    };

    return (
        <div className="h-full w-full flex flex-col bg-transparent">
            {/* Header */}
            <div className="h-16 shrink-0 flex items-center justify-between px-8 border-b border-white/5 bg-black/20 backdrop-blur-md">
                <div className="flex items-center gap-4">
                    <div className="p-2 bg-accent-cyan/10 rounded-xl border border-accent-cyan/20">
                        <SettingsIcon size={20} className="text-accent-cyan" />
                    </div>
                    <div className="flex flex-col">
                        <h1 className="text-sm font-bold uppercase tracking-[0.2em] text-white">Control_Tower</h1>
                        <span className="text-[10px] font-mono text-text-dim">SYSTEM_CONFIGURATION_MODULE</span>
                    </div>
                </div>
                <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-accent-cyan/5 border border-accent-cyan/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-accent-cyan animate-pulse"></div>
                    <span className="text-[10px] font-mono text-accent-cyan font-bold uppercase tracking-wider">Telemetry_Live</span>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
                {/* Navigation (Sidebar on Desktop, Horizontal Scroll on Mobile) */}
                <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-white/5 bg-black/10 p-2 md:p-4 flex md:flex-col gap-2 overflow-x-auto md:overflow-visible shrink-0 scrollbar-hide">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`
                                flex-shrink-0 px-4 py-3 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-all flex items-center gap-3 group relative overflow-hidden 
                                min-w-[150px] md:min-w-0 md:w-full /* Mobile horizontal card width */
                                ${activeTab === tab.id
                                    ? 'bg-white/5 text-white shadow-[0_4px_20px_rgba(0,0,0,0.5)] border border-white/10'
                                    : 'text-text-dim hover:text-white hover:bg-white/5'
                                }
                            `}
                        >
                            {/* Active Indicator Line */}
                            {activeTab === tab.id && <div className="absolute left-0 bottom-0 right-0 h-1 md:h-auto md:top-0 md:bottom-0 md:right-auto md:w-1 bg-accent-cyan"></div>}

                            <span className={activeTab === tab.id ? 'text-accent-cyan' : 'text-text-muted group-hover:text-white'}>{tab.icon}</span>
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-gradient-to-br from-transparent via-white/[0.02] to-transparent">
                    <div className="max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20 /* Padding for bottom nav */">
                        {renderTabContent()}
                    </div>
                </div>
            </div>
        </div>
    );
};

const SystemDiagnosticsTab: React.FC = () => {
    return (
        <div className="space-y-6">
            <SystemDashboardPlaceholder />
            <div className="glass-panel rounded-2xl border border-white/5 overflow-hidden">
                <TelemetryDashboard />
            </div>
        </div>
    );
};

const SecurityTab: React.FC = () => {
    return (
        <div className="space-y-6">
            <div className="glass-panel rounded-2xl border border-white/5 p-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-4 flex items-center gap-2">
                    <Shield size={14} className="text-accent-cyan" /> Security & Sovereignty
                </h3>
                <p className="text-xs text-text-muted font-mono uppercase tracking-wider">Live security and handshake telemetry</p>
            </div>
            <SystemTelemetry />
        </div>
    );
};

const IntegrationsTab: React.FC = () => {
    return (
        <div className="space-y-4">
            <div className="glass-panel rounded-2xl border border-white/5 p-5">
                <h3 className="text-xs font-bold uppercase tracking-widest text-white mb-2 flex items-center gap-2">
                    <Globe size={14} className="text-accent-cyan" /> Deployment Nexus
                </h3>
                <p className="text-[10px] text-text-dim font-mono uppercase tracking-wider">GitHub • Vercel • Fly.io mission launch controls</p>
            </div>
            <div className="w-full overflow-x-auto">
                <DeployPanel />
            </div>
        </div>
    );
};

// System Dashboard
const SystemDashboardPlaceholder: React.FC = () => {
    return (
        <div className="space-y-8">
            {/* Status Cards Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatusCard title="System State" value="ONLINE" status="healthy" />
                <StatusCard title="Ports Health" value="5/5" status="healthy" />
                <StatusCard title="Latency" value="< 20ms" status="healthy" />
                <StatusCard title="Queue Depth" value="0" status="healthy" />
                <StatusCard title="Error Rate" value="0.0%" status="healthy" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Live Metrics */}
                <div className="lg:col-span-2 glass-panel rounded-2xl p-6 relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Activity size={100} />
                    </div>
                    <h2 className="text-xs font-bold uppercase tracking-widest text-accent-cyan mb-6 flex items-center gap-2">
                        <Activity size={14} /> Live Metrics
                    </h2>
                    <div className="grid grid-cols-2 gap-4">
                        <GraphPlaceholder title="Message Bus Activity" color="bg-accent-cyan" />
                        <GraphPlaceholder title="LLM Cluster Load" color="bg-accent-plasma" />
                        <GraphPlaceholder title="Tooling Activity" color="bg-accent-magenta" />
                        <GraphPlaceholder title="Network Throughput" color="bg-emerald-400" />
                    </div>
                </div>

                {/* Event Timeline */}
                <div className="glass-panel rounded-2xl p-6 relative overflow-hidden">
                    <h2 className="text-xs font-bold uppercase tracking-widest text-white mb-6 flex items-center gap-2">
                        <Database size={14} /> System Events
                    </h2>
                    <div className="space-y-3 relative z-10">
                        <EventLogItem type="security" message="Auth check: Validated" timestamp="Just now" />
                        <EventLogItem type="deployment" message="FluidLayout hot-reload" timestamp="10s ago" />
                        <EventLogItem type="tool" message="MCP: rewrite_file executed" timestamp="30s ago" />
                        <EventLogItem type="filesystem" message="Index sync complete" timestamp="1m ago" />
                    </div>
                    {/* Gradient fade at bottom */}
                    <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/50 to-transparent pointer-events-none"></div>
                </div>
            </div>
        </div>
    );
};

// --- VOICE IDENTITY TAB ---
const VoiceIdentityTab: React.FC = () => {
    const [isPlaying, setIsPlaying] = useState(false);

    const playReference = () => {
        setIsPlaying(true);
        const audio = new Audio('/agent_lee_reference_voice.m4a');
        audio.play().catch(e => console.error(e));
        audio.onended = () => setIsPlaying(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="p-8 glass-panel rounded-3xl border border-white/5 relative overflow-hidden bg-gradient-to-br from-accent-cyan/10 to-transparent">
                <div className="absolute top-0 right-0 p-8 text-accent-cyan opacity-10">
                    <Database size={120} />
                </div>

                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center md:items-start text-center md:text-left">
                    <div className="size-32 rounded-3xl bg-black/40 border-2 border-accent-cyan/40 p-1 flex items-center justify-center relative shadow-[0_0_30px_rgba(0,240,255,0.2)] overflow-hidden">
                        <img
                            src="/agent_lee_avatar.gif"
                            alt="Agent Lee Identity"
                            className="size-full object-cover rounded-2xl opacity-80"
                            onError={(e) => (e.currentTarget.src = 'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=Lee')}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                        <div className="absolute bottom-2 left-0 right-0 text-center">
                            <span className="text-[8px] font-bold text-accent-cyan uppercase tracking-widest">VERIFIED_ID</span>
                        </div>
                    </div>

                    <div className="flex-1 space-y-4">
                        <div className="space-y-1">
                            <h2 className="text-2xl font-bold text-white tracking-tight uppercase">Agent Lee <span className="text-accent-cyan text-sm ml-2 font-mono">v1.2.5</span></h2>
                            <p className="text-xs text-text-muted font-mono uppercase tracking-[0.2em]">Neural_Entity // Full_Stack_Architect</p>
                        </div>

                        <p className="text-sm text-white/70 leading-relaxed max-w-xl">
                            Specialized AI entity optimized for autonomous system orchestration and rapid development.
                            Persona modeled with high EQ, technical mastery, and a rhythmic, confident cadence.
                        </p>

                        <div className="flex flex-wrap gap-2 pt-2">
                            <span className="px-3 py-1 rounded-full bg-accent-cyan/10 border border-accent-cyan/30 text-[9px] font-bold text-accent-cyan uppercase">Sovereign_Link</span>
                            <span className="px-3 py-1 rounded-full bg-accent-plasma/10 border border-accent-plasma/30 text-[9px] font-bold text-accent-plasma uppercase">High_EQ_Neural</span>
                            <span className="px-3 py-1 rounded-full bg-accent-magenta/10 border border-accent-magenta/30 text-[9px] font-bold text-accent-magenta uppercase">Zero_Trust_Auth</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Voice Profile */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Activity size={14} className="text-accent-cyan" /> Voice Neural Identity
                    </h3>

                    <div className="space-y-4 pt-4">
                        <div className="p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-between group hover:border-accent-cyan/50 transition-all">
                            <div>
                                <h4 className="text-[10px] font-bold text-text-dim uppercase tracking-wider mb-1">Active Voice Protocol</h4>
                                <div className="text-sm font-bold text-white">AGENT_LEE_SOVEREIGN_V1</div>
                            </div>
                            <button
                                onClick={playReference}
                                disabled={isPlaying}
                                className={`size-10 rounded-full flex items-center justify-center transition-all ${isPlaying ? 'bg-accent-cyan text-black animate-pulse' : 'bg-white/5 text-accent-cyan border border-accent-cyan/30 hover:bg-accent-cyan hover:text-black'}`}
                            >
                                <span className="material-symbols-outlined text-[20px]">{isPlaying ? 'graphic_eq' : 'play_arrow'}</span>
                            </button>
                        </div>

                        <div className="p-4 bg-black/40 rounded-xl border border-white/5 space-y-3">
                            <div className="flex justify-between text-[9px] font-mono uppercase text-text-muted">
                                <span>Neural Clarity</span>
                                <span>98.4%</span>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="w-[98.4%] h-full bg-accent-cyan shadow-[0_0_10px_#00f0ff]" />
                            </div>
                            <div className="flex justify-between text-[9px] font-mono uppercase text-text-muted pt-1">
                                <span>Persona Adherence</span>
                                <span>DYNAMIC</span>
                            </div>
                            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="w-full h-full bg-gradient-to-r from-accent-cyan via-accent-plasma to-accent-magenta opacity-80" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Identity Verification */}
                <div className="glass-panel p-6 rounded-2xl border border-white/5 space-y-6">
                    <h3 className="text-xs font-bold text-white uppercase tracking-widest flex items-center gap-2">
                        <Shield size={14} className="text-accent-magenta" /> Identity Credentials
                    </h3>

                    <div className="space-y-2">
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-text-muted">DEVICE_ID</span>
                            <span className="text-[10px] font-mono text-white">LEE-AX-884-PROD</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-text-muted">SIGNATURE_HMAC</span>
                            <span className="text-[10px] font-mono text-white">VERIFIED_ACTIVE</span>
                        </div>
                        <div className="p-3 bg-white/5 rounded-lg border border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-mono text-text-muted">SOVEREIGN_STATUS</span>
                            <span className="text-[10px] font-mono text-emerald-400 font-bold uppercase tracking-widest">AUTHENTICATED</span>
                        </div>
                    </div>

                    <div className="pt-4">
                        <button className="w-full py-3 rounded-xl bg-accent-magenta/10 border border-accent-magenta/30 text-[10px] font-bold text-accent-magenta uppercase tracking-widest hover:bg-accent-magenta hover:text-white transition-all shadow-[0_0_20px_rgba(255,0,255,0.1)]">
                            Rotate Neural Credentials
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const PanelPlaceholder: React.FC<{ title: string; icon: React.ReactNode }> = ({ title, icon }) => {
    return (
        <div className="flex flex-col items-center justify-center h-[60vh] text-center">
            <div className="mb-6 p-8 rounded-full bg-white/5 border border-white/5 animate-pulse">
                <div className="text-text-muted">{icon}</div>
            </div>
            <h2 className="text-xl font-bold uppercase tracking-widest text-white mb-2">{title}</h2>
            <p className="text-xs font-mono text-text-muted uppercase tracking-wider">Module_Under_Construction // Awaiting_Implementation</p>
        </div>
    );
};

const StatusCard: React.FC<{ title: string; value: string; status: 'healthy' | 'warning' | 'error' }> = ({ title, value, status }) => {
    const statusColors = {
        healthy: 'text-accent-cyan border-accent-cyan/30 bg-accent-cyan/5',
        warning: 'text-yellow-500 border-yellow-500/30 bg-yellow-500/5',
        error: 'text-red-500 border-red-500/30 bg-red-500/5'
    };

    return (
        <div className={`glass-card p-5 rounded-xl border ${statusColors[status]} transition-transform hover:-translate-y-1`}>
            <div className="text-[9px] font-mono uppercase tracking-wider opacity-70 mb-2">{title}</div>
            <div className="text-2xl font-bold tracking-tight">{value}</div>
        </div>
    );
};

const GraphPlaceholder: React.FC<{ title: string, color: string }> = ({ title, color }) => {
    const barHeights = ['h-[24%]', 'h-[36%]', 'h-[48%]', 'h-[62%]', 'h-[76%]', 'h-[88%]'];
    const barOpacities = ['opacity-50', 'opacity-60', 'opacity-70', 'opacity-80', 'opacity-90'];

    return (
        <div className="bg-black/20 rounded-xl p-4 border border-white/5">
            <h3 className="text-[9px] font-mono uppercase tracking-wider text-text-dim mb-3 flex justify-between">
                <span>{title}</span>
                <span className="text-white">Active</span>
            </h3>
            <div className="h-24 flex items-end gap-1 opacity-80">
                {[...Array(15)].map((_, i) => (
                    <div
                        key={i}
                        className={`flex-1 rounded-t-sm ${color} ${barHeights[i % barHeights.length]} ${barOpacities[i % barOpacities.length]}`}
                    ></div>
                ))}
            </div>
        </div>
    );
};

const EventLogItem: React.FC<{ type: 'security' | 'tool' | 'filesystem' | 'deployment'; message: string; timestamp: string }> = ({ type, message, timestamp }) => {
    const typeColors = {
        security: 'text-accent-cyan bg-accent-cyan/10',
        tool: 'text-accent-plasma bg-accent-plasma/10',
        filesystem: 'text-blue-400 bg-blue-400/10',
        deployment: 'text-accent-magenta bg-accent-magenta/10'
    };

    return (
        <div className="flex items-center gap-3 p-2.5 bg-white/5 rounded-lg border border-white/5 hover:bg-white/10 transition-colors cursor-default group">
            <div className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded ${typeColors[type]}`}>
                {type}
            </div>
            <div className="flex-1 text-[10px] text-text-dim group-hover:text-white transition-colors">{message}</div>
            <div className="text-[9px] font-mono text-text-muted">{timestamp}</div>
        </div>
    );
};
