import {
    FileCode2,
    LayoutDashboard,
    Monitor,
    Settings,
    ShieldCheck,
    Zap
} from 'lucide-react';
import React from 'react';

/**
 * ORBITAL NAV
 * A floating dock-style navigation component for Fluid UI.
 */

interface NavProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export const OrbitalNav: React.FC<NavProps> = ({
    activeTab,
    onTabChange,
    isCollapsed,
    onToggleCollapse
}) => {
    const navItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Orchestration', color: 'text-accent-cyan' },
        { id: 'files', icon: FileCode2, label: 'Source Control', color: 'text-white' },
        { id: 'matrix', icon: Monitor, label: 'Matrix View', color: 'text-accent-plasma' },
        { id: 'deploy', icon: Zap, label: 'Deployment', color: 'text-yellow-400' },
        { id: 'security', icon: ShieldCheck, label: 'Security Log', color: 'text-emerald-400' },
        { id: 'settings', icon: Settings, label: 'Settings', color: 'text-text-dim' },
    ];

    return (
        <div className={`
            glass-panel rounded-2xl transition-all duration-500 ease-out flex flex-col items-center py-4 gap-2
            md:w-16 md:h-[70vh] md:flex-col md:static
            fixed bottom-4 left-4 right-4 h-[var(--nav-bar-height)] flex-row justify-around z-50
            hover:border-accent-cyan/30 hover:shadow-[0_0_20px_rgba(0,240,255,0.1)]
        `}>
            {/* Collapse Toggle */}
            <button
                onClick={onToggleCollapse}
                title={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                aria-label={isCollapsed ? 'Expand navigation' : 'Collapse navigation'}
                className="w-10 h-10 rounded-xl hover:bg-white/10 flex items-center justify-center text-text-muted transition-colors mb-4"
            >
                <div className={`w-1.5 h-1.5 rounded-full bg-accent-cyan transition-all duration-500 ${isCollapsed ? 'opacity-50' : 'shadow-[0_0_10px_#00f0ff]'}`}></div>
            </button>

            {/* Icons Stack */}
            <div className="flex-1 flex flex-col gap-4 w-full px-2">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        title={item.label}
                        aria-label={item.label}
                        className={`
                            relative group w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300
                            ${activeTab === item.id
                                ? 'bg-white/10 shadow-[inner_0_0_10px_rgba(255,255,255,0.1)]'
                                : 'hover:bg-white/5'}
                        `}
                    >
                        <item.icon
                            size={20}
                            className={`
                                transition-all duration-300 
                                ${activeTab === item.id
                                    ? `${item.color} scale-110 drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]`
                                    : 'text-text-muted group-hover:text-white'}
                            `}
                        />

                        {/* Tooltip Label (Floats right) */}
                        <div className="absolute left-[120%] bg-bg-nebula border border-glass-border px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-widest text-text-primary opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 backdrop-blur-md">
                            {item.label}
                            {/* Arrow */}
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-t-[4px] border-b-[4px] border-r-[4px] border-t-transparent border-b-transparent border-r-glass-border"></div>
                        </div>

                        {/* Active Indicator Dot */}
                        {activeTab === item.id && (
                            <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-1 h-4 bg-accent-cyan rounded-full"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* Bottom/Profile */}
            <div className="mt-auto pt-4 border-t border-white/5 w-full flex justify-center">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-accent-plasma to-accent-magenta p-[1px]">
                    <div className="w-full h-full rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center text-[8px] font-bold">
                        AL
                    </div>
                </div>
            </div>
        </div>
    );
};
