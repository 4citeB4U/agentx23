import { CheckCircle2, Cloud, ExternalLink, Github, Loader2, Zap } from 'lucide-react';
import React, { useState } from 'react';
import { BACKEND_URL } from '../constants';
import { SovereignIdentity } from '../services/SovereignIdentity';

type DeployStatus = 'idle' | 'preparing' | 'deploying' | 'completed' | 'error';
type Platform = 'GITHUB' | 'VERCEL' | 'FLY';

export const DeployPanel: React.FC = () => {
    const [status, setStatus] = useState<DeployStatus>('idle');
    const [platform, setPlatform] = useState<Platform>('GITHUB');

    const handleDeploy = async () => {
        setStatus('preparing');
        try {
            const payload = { platform, project: 'agent-lee-studio' };
            const headers = await SovereignIdentity.signRequest(payload);
            const response = await fetch(`${BACKEND_URL}/api/deployment/initiate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...headers
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                const data = await response.json();
                console.log(`[deploy] Mission ${data.id} launched.`);
                setStatus('deploying');
                // Simulate the pushing phase as the backend works in background
                setTimeout(() => setStatus('completed'), 3000);
            } else {
                setStatus('error');
            }
        } catch (error) {
            console.error('[deploy] Neural bridge failure:', error);
            setStatus('error');
        }
    };

    return (
        <div className="flex flex-col h-full bg-studio-panel border-l border-studio-border w-80 shrink-0 shadow-2xl overflow-hidden">
            <div className="p-4 border-b border-studio-border/50 flex items-center gap-2">
                <Zap size={16} className="text-studio-accent" />
                <span className="text-xs font-bold tracking-widest text-studio-text uppercase">Unit_Deployer</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                {/* Platform Selection */}
                <div className="space-y-3">
                    <label className="text-[10px] font-mono text-studio-secondary uppercase tracking-widest opacity-60">Select_Target</label>
                    <div className="grid grid-cols-1 gap-2">
                        {[
                            { id: 'GITHUB', label: 'GitHub Pages', icon: <Github size={16} /> },
                            { id: 'VERCEL', label: 'Vercel Edge', icon: <Cloud size={16} /> },
                            { id: 'FLY', label: 'Fly.io Mesh', icon: <Cloud size={16} /> },
                        ].map((p) => (
                            <button
                                key={p.id}
                                onClick={() => setPlatform(p.id as Platform)}
                                className={`
                  flex items-center justify-between p-3 rounded-xl border transition-all
                  ${platform === p.id
                                        ? 'bg-studio-accent/10 border-studio-accent text-studio-accent'
                                        : 'bg-black/20 border-studio-border/50 text-studio-secondary hover:border-studio-border'}
                `}
                            >
                                <div className="flex items-center gap-3">
                                    {p.icon}
                                    <span className="text-xs font-medium">{p.label}</span>
                                </div>
                                {platform === p.id && <div className="w-1.5 h-1.5 rounded-full bg-studio-accent shadow-[0_0_8px_rgba(168,199,250,1)]" />}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Deploy Actions */}
                <div className="pt-4 border-t border-studio-border/30">
                    {status === 'idle' ? (
                        <button
                            onClick={handleDeploy}
                            className="w-full py-4 bg-studio-accent text-studio-bg rounded-xl font-bold text-sm tracking-widest hover:brightness-110 active:scale-95 transition-all shadow-lg overflow-hidden relative group"
                        >
                            <div className="absolute inset-0 bg-white/20 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                            INITIATE_DEPLOY
                        </button>
                    ) : (
                        <div className={`p-4 rounded-xl border ${status === 'completed' ? 'border-green-500/50 bg-green-500/5' : 'border-studio-accent/50 bg-studio-accent/5'}`}>
                            <div className="flex items-center gap-3 mb-3">
                                {status === 'completed' ? (
                                    <CheckCircle2 size={18} className="text-green-400" />
                                ) : (
                                    <Loader2 size={18} className="text-studio-accent animate-spin" />
                                )}
                                <span className="text-xs font-mono uppercase tracking-widest">
                                    {status === 'preparing' && 'Analyzing_Mesh...'}
                                    {status === 'deploying' && 'Pushing_to_Edge...'}
                                    {status === 'completed' && 'Mission_Accomplished'}
                                </span>
                            </div>
                            <div className="h-1 bg-studio-border/30 rounded-full overflow-hidden">
                                <div
                                    className={`h-full transition-all duration-500 ${status === 'completed' ? 'bg-green-400 w-full' : 'bg-studio-accent w-1/2'}`}
                                />
                            </div>
                        </div>
                    )}
                </div>

                {/* Recent Deploys */}
                <div className="space-y-3 pt-6">
                    <label className="text-[10px] font-mono text-studio-secondary uppercase tracking-widest opacity-60">Deployment_Logs</label>
                    <div className="space-y-2">
                        {[1, 2].map((i) => (
                            <div key={i} className="p-3 bg-black/30 border border-studio-border/20 rounded-lg flex items-center justify-between group cursor-pointer hover:bg-black/50 transition-colors">
                                <div className="flex flex-col">
                                    <span className="text-[10px] text-studio-text font-mono">build_v1.{i}.0</span>
                                    <span className="text-[9px] text-studio-secondary opacity-50 uppercase tracking-tighter">12m ago // GITHUB</span>
                                </div>
                                <ExternalLink size={12} className="text-studio-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
