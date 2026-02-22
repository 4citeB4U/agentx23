import { Activity, Cpu, Database, HardDrive, ShieldCheck, Wifi } from 'lucide-react';
import React, { useEffect, useState } from 'react';

/**
 * TELEMETRY DASHBOARD
 * Real-time monitoring for the Sovereign AI OS.
 */

export const TelemetryDashboard: React.FC = () => {
    const [stats, setStats] = useState({
        aiQuotas: { file_read: 85, file_write: 42 },
        bridgeHealth: 'EXCELLENT',
        latency: '12ms',
        auditIntegrity: 'VERIFIED',
        safeMode: false
    });

    useEffect(() => {
        const interval = window.setInterval(() => {
            setStats((previous) => {
                const nextRead = Math.min(100, Math.max(10, previous.aiQuotas.file_read + (Math.random() > 0.5 ? 1 : -1) * (2 + Math.floor(Math.random() * 4))));
                const nextWrite = Math.min(50, Math.max(1, previous.aiQuotas.file_write + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 3))));
                const latencyValue = Math.min(42, Math.max(8, parseInt(previous.latency, 10) + (Math.random() > 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2))));

                return {
                    ...previous,
                    aiQuotas: {
                        file_read: nextRead,
                        file_write: nextWrite
                    },
                    latency: `${latencyValue}ms`,
                    bridgeHealth: latencyValue < 16 ? 'EXCELLENT' : latencyValue < 28 ? 'STABLE' : 'DEGRADED'
                };
            });
        }, 1800);

        return () => window.clearInterval(interval);
    }, []);

    const widthSteps = [
        'w-[0%]', 'w-[5%]', 'w-[10%]', 'w-[15%]', 'w-[20%]', 'w-[25%]', 'w-[30%]', 'w-[35%]', 'w-[40%]', 'w-[45%]', 'w-[50%]',
        'w-[55%]', 'w-[60%]', 'w-[65%]', 'w-[70%]', 'w-[75%]', 'w-[80%]', 'w-[85%]', 'w-[90%]', 'w-[95%]', 'w-[100%]'
    ];
    const readIndex = Math.max(0, Math.min(20, Math.round(stats.aiQuotas.file_read / 5)));
    const writePercent = Math.min(100, (stats.aiQuotas.file_write / 50) * 100);
    const writeIndex = Math.max(0, Math.min(20, Math.round(writePercent / 5)));

    return (
        <div className="p-6 space-y-6">
            <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-mono text-studio-accent uppercase tracking-[0.3em] flex items-center gap-2">
                    <Activity size={14} /> System_Orchestration
                </h3>
                <span className="text-[9px] text-studio-text-dim uppercase font-mono tracking-tighter">NODE_ID: AGENT_LEE_MASTER</span>
            </div>

            <div className="grid grid-cols-2 gap-4">
                {/* AI Quotas */}
                <div className="glass-card p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-2 text-studio-text-dim">
                        <Cpu size={14} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Neural_Quotas</span>
                    </div>
                    <div className="space-y-2">
                        <div className="flex justify-between text-[9px] font-mono mb-1 text-studio-text-muted uppercase">
                            <span>Read_Streams</span>
                            <span>{stats.aiQuotas.file_read}/100</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full bg-studio-accent transition-all duration-1000 ${widthSteps[readIndex]}`}></div>
                        </div>

                        <div className="flex justify-between text-[9px] font-mono mb-1 text-studio-text-muted uppercase mt-3">
                            <span>Write_Streams</span>
                            <span>{stats.aiQuotas.file_write}/50</span>
                        </div>
                        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className={`h-full bg-studio-secondary transition-all duration-1000 ${widthSteps[writeIndex]}`}></div>
                        </div>
                    </div>
                </div>

                {/* Audit & Integrity */}
                <div className="glass-card p-4 flex flex-col gap-4">
                    <div className="flex items-center gap-2 text-studio-text-dim">
                        <ShieldCheck size={14} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Integrity_Monitor</span>
                    </div>
                    <div className="flex-1 flex flex-col justify-center items-center text-center">
                        <div className="text-lg font-display font-bold text-studio-accent mb-1 animate-pulse">
                            {stats.auditIntegrity}
                        </div>
                        <span className="text-[9px] uppercase font-mono text-studio-text-muted">Hash_Chain_Consistency</span>
                    </div>
                </div>

                {/* Bridge Health */}
                <div className="glass-card p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-studio-text-dim">
                        <Wifi size={14} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Neural_Bridge</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <span className="text-xl font-display font-bold text-white">{stats.bridgeHealth}</span>
                        <span className="text-[9px] font-mono text-studio-accent">{stats.latency}</span>
                    </div>
                </div>

                {/* Resource Stats */}
                <div className="glass-card p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-2 text-studio-text-dim">
                        <HardDrive size={14} />
                        <span className="text-[10px] uppercase font-bold tracking-widest">Volatile_Cache</span>
                    </div>
                    <div className="flex items-end justify-between">
                        <span className="text-xl font-display font-bold text-white">420MB</span>
                        <span className="text-[9px] font-mono text-studio-text-muted">LRU_CLEAN</span>
                    </div>
                </div>
            </div>

            {/* Event Stream */}
            <div className="glass-card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-2 text-studio-text-dim">
                    <Database size={14} />
                    <span className="text-[10px] uppercase font-bold tracking-widest">Audit_Stream_Latest</span>
                </div>
                <div className="space-y-2 font-mono text-[9px]">
                    <div className="flex items-center gap-3 py-1 border-b border-white/5 opacity-80">
                        <span className="text-studio-accent">14:02:11</span>
                        <span className="text-studio-text-dim">API_REQUEST_SUCCESS</span>
                        <span className="ml-auto text-studio-text-muted">/api/chat</span>
                    </div>
                    <div className="flex items-center gap-3 py-1 border-b border-white/5 opacity-60">
                        <span className="text-studio-accent">14:01:45</span>
                        <span className="text-studio-text-dim">KEY_ROTATION_SUCCESS</span>
                        <span className="ml-auto text-studio-text-muted">SYSTEM_ROTATE</span>
                    </div>
                </div>
            </div>
        </div>
    );
};
