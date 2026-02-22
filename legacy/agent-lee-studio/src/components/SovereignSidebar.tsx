import {
    ChevronLeft,
    FileCode2,
    LayoutDashboard,
    Menu,
    Monitor,
    Settings,
    ShieldCheck,
    Zap
} from 'lucide-react';
import React from 'react';

interface SidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
    isCollapsed: boolean;
    onToggleCollapse: () => void;
}

export const SovereignSidebar: React.FC<SidebarProps> = ({
    activeTab,
    onTabChange,
    isCollapsed,
    onToggleCollapse
}) => {
    const navItems = [
        { id: 'dashboard', icon: LayoutDashboard, label: 'Orchestration' },
        { id: 'files', icon: FileCode2, label: 'Source_Control' },
        { id: 'matrix', icon: Monitor, label: 'Matrix_View' },
        { id: 'deploy', icon: Zap, label: 'Deployment' },
        { id: 'security', icon: ShieldCheck, label: 'Security_Log' },
        { id: 'settings', icon: Settings, label: 'Settings' },
    ];

    return (
        <div className={`h-full flex flex-col bg-studio-surface border-r border-studio-border transition-all duration-500 ease-[cubic-bezier(0.19,1,0.22,1)] ${isCollapsed ? 'w-16' : 'w-64'} z-50 relative`}>
            {/* Header / Toggle */}
            <div className="h-16 flex items-center px-4 justify-between border-b border-studio-border">
                {!isCollapsed && <span className="font-display font-bold text-sm tracking-widest text-studio-accent uppercase animate-pulse">Sovereign_OS</span>}
                <button
                    onClick={onToggleCollapse}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors text-studio-text-dim"
                >
                    {isCollapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            {/* Nav Items */}
            <div className="flex-1 py-6 space-y-2 overflow-y-auto scrollbar-hide px-3">
                {navItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => onTabChange(item.id)}
                        className={`
                            w-full flex items-center gap-4 p-3 rounded-xl transition-all duration-300 group relative
                            ${activeTab === item.id
                                ? 'bg-studio-accent/10 text-studio-accent border border-studio-accent/20'
                                : 'text-studio-text-dim hover:bg-white/5 hover:text-white'}
                        `}
                    >
                        <item.icon size={20} className={activeTab === item.id ? 'animate-pulse' : 'group-hover:scale-110 transition-transform'} />
                        {!isCollapsed && (
                            <span className="text-xs font-medium tracking-tight whitespace-nowrap uppercase">
                                {item.label}
                            </span>
                        )}
                        {/* Active Indicator */}
                        {activeTab === item.id && (
                            <div className="absolute left-[-12px] top-1/2 -translate-y-1/2 w-1.5 h-6 bg-studio-accent rounded-r-full shadow-[0_0_15px_rgba(0,245,255,1)]"></div>
                        )}
                    </button>
                ))}
            </div>

            {/* User / Bottom info */}
            <div className="p-4 border-t border-studio-border">
                <div className={`flex items-center gap-3 ${isCollapsed ? 'justify-center' : ''}`}>
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-studio-accent to-studio-tertiary flex items-center justify-center text-[10px] font-bold text-black border border-white/20">
                        AL
                    </div>
                    {!isCollapsed && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-[10px] font-bold text-white truncate uppercase tracking-tighter">Agent_Lee</span>
                            <span className="text-[9px] text-studio-accent font-mono truncate uppercase opacity-60">R5_SOVEREIGN</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
