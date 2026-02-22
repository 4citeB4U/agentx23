import { Box, Code2, LayoutGrid } from 'lucide-react';
import React from 'react';

export type ViewMode = 'ANTIGRAVITY' | 'VSCODE' | 'DUAL';

interface MatrixToggleProps {
    currentMode: ViewMode;
    onModeChange: (mode: ViewMode) => void;
}

export const MatrixToggle: React.FC<MatrixToggleProps> = ({ currentMode, onModeChange }) => {
    const modes: { id: ViewMode; label: string; icon: React.ReactNode }[] = [
        { id: 'ANTIGRAVITY', label: 'ANTIGRAVITY', icon: <Box size={14} /> },
        { id: 'VSCODE', label: 'VSCODE_BRIDGE', icon: <Code2 size={14} /> },
        { id: 'DUAL', label: 'MATRIX_DUAL', icon: <LayoutGrid size={14} /> },
    ];

    return (
        <div className="flex flex-col items-center gap-2 py-4 border-r border-studio-border bg-black/40 w-16 shrink-0">
            {modes.map((mode) => (
                <button
                    key={mode.id}
                    onClick={() => onModeChange(mode.id)}
                    title={mode.label}
                    className={`
            relative group p-3 rounded-xl transition-all duration-300
            ${currentMode === mode.id
                            ? 'bg-studio-accent text-studio-bg shadow-[0_0_15px_rgba(168,199,250,0.4)]'
                            : 'text-studio-secondary hover:text-white hover:bg-studio-border/30'}
          `}
                >
                    {mode.icon}
                    {currentMode === mode.id && (
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-studio-accent rounded-l-full" />
                    )}

                    {/* Tooltip emulation */}
                    <div className="absolute left-16 top-1/2 -translate-y-1/2 px-2 py-1 bg-studio-panel border border-studio-border text-[10px] font-mono text-studio-text rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                        {mode.label}
                    </div>
                </button>
            ))}

            <div className="mt-auto pb-4">
                <div className="w-1 h-24 bg-gradient-to-b from-transparent via-studio-accent/20 to-transparent" />
            </div>
        </div>
    );
};
