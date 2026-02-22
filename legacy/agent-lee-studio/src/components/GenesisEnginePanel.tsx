import { Box, Download, Sliders, Sparkles, Zap } from 'lucide-react';
import React from 'react';
import { BACKEND_URL, NEURAL_HANDSHAKE_KEY } from '../constants';

export const GenesisEnginePanel: React.FC = () => {
    return (
        <div className="absolute top-24 left-6 w-64 bg-studio-panel/60 backdrop-blur-xl border border-studio-border/30 rounded-2xl overflow-hidden shadow-2xl z-40 pointer-events-auto">
            <div className="p-3 bg-studio-accent/10 border-b border-studio-border/30 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Sparkles size={14} className="text-studio-accent" />
                    <span className="text-[10px] font-bold text-studio-text tracking-widest uppercase">Genesis_Engine</span>
                </div>
                <Sliders size={12} className="text-studio-secondary opacity-50" />
            </div>

            <div className="p-4 space-y-4">
                {/* Core Settings */}
                <div className="space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono text-studio-secondary uppercase tracking-tighter opacity-70">Neural_Density</span>
                        <span className="text-[9px] font-mono text-studio-accent">15,000 VOX</span>
                    </div>
                    <div className="h-1 bg-studio-border/30 rounded-full">
                        <div className="h-full w-2/3 bg-studio-accent rounded-full shadow-[0_0_8px_rgba(168,199,250,0.5)]" />
                    </div>
                </div>

                <div className="space-y-3 pt-2">
                    <div className="flex justify-between items-center">
                        <span className="text-[9px] font-mono text-studio-secondary uppercase tracking-tighter opacity-70">Aura_Luminance</span>
                        <span className="text-[9px] font-mono text-studio-accent">1.2 LUX</span>
                    </div>
                    <div className="h-1 bg-studio-border/30 rounded-full">
                        <div className="h-full w-1/2 bg-studio-accent rounded-full shadow-[0_0_8px_rgba(168,199,250,0.5)]" />
                    </div>
                </div>

                {/* Mesh Actions */}
                <div className="grid grid-cols-2 gap-2 pt-4 border-t border-studio-border/20">
                    <button className="flex flex-col items-center gap-2 p-3 bg-black/40 border border-studio-border/30 rounded-xl hover:bg-studio-accent/20 transition-all group">
                        <Box size={16} className="text-studio-secondary group-hover:text-studio-accent" />
                        <span className="text-[8px] font-mono text-studio-secondary uppercase">View_Mesh</span>
                    </button>
                    <button
                        onClick={async () => {
                            await fetch(`${BACKEND_URL}/api/services/track-export`, {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'X-Neural-Handshake': NEURAL_HANDSHAKE_KEY
                                },
                                body: JSON.stringify({ meshId: 'vox_avatar_delta', format: 'glb' })
                            });
                            console.log('[genesis] Export tracked.');
                        }}
                        className="flex flex-col items-center gap-2 p-3 bg-black/40 border border-studio-border/30 rounded-xl hover:bg-studio-accent/20 transition-all group"
                    >
                        <Download size={16} className="text-studio-secondary group-hover:text-studio-accent" />
                        <span className="text-[8px] font-mono text-studio-secondary uppercase">Export_GLB</span>
                    </button>
                </div>

                <button className="w-full flex items-center justify-center gap-2 py-3 bg-studio-accent/10 border border-studio-accent/30 rounded-xl text-studio-accent text-[10px] font-bold tracking-[0.2em] hover:bg-studio-accent hover:text-studio-bg transition-all uppercase">
                    <Zap size={14} /> Re_Materialize
                </button>
            </div>

            <div className="px-4 py-2 bg-black/40 text-center border-t border-studio-border/10">
                <span className="text-[8px] font-mono text-studio-secondary opacity-30 tracking-widest">ENGINE_V4.2 // SECTOR_G</span>
            </div>
        </div>
    );
};
