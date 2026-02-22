import { Activity, Box, Code2, FolderOpen, HelpCircle, Home, LayoutDashboard, MessageSquare, Mic, MonitorPlay, Send, Settings, Smartphone } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { AgentContact, Message, Tab } from '../types';

// --- VS CODE STYLE MENU BAR (fully functional dropdowns) ---
export const MenuBar: React.FC = () => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Keyboard shortcuts for the Code tab menus
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (!e.ctrlKey && !e.metaKey) return;
      const key = e.key.toLowerCase();
      const dispatch = (name: string) => window.dispatchEvent(new CustomEvent(`agentlee:${name}`));
      if (key === 's' && !e.shiftKey) { e.preventDefault(); dispatch('save'); }
      else if (key === 's' && e.shiftKey) { e.preventDefault(); dispatch('saveAs'); }
      else if (key === 'n' && !e.shiftKey) { e.preventDefault(); dispatch('newFile'); }
      else if (key === '`' && e.shiftKey) { e.preventDefault(); dispatch('newTerminal'); }
      else if (key === 'b' && e.shiftKey) { e.preventDefault(); dispatch('runBuildTask'); }
      else if (key === 'e' && e.shiftKey) { e.preventDefault(); dispatch('toggleExplorer'); }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, []);

  const dispatch = (event: string, detail?: unknown) => {
    window.dispatchEvent(new CustomEvent(`agentlee:${event}`, { detail }));
    setActiveMenu(null);
  };

  const openUrl = (url: string) => { window.open(url, '_blank', 'noopener,noreferrer'); setActiveMenu(null); };

  type MenuItem = { label: string; shortcut?: string; sep?: boolean; action: () => void };
  const menus: Record<string, MenuItem[]> = {
    Edit: [
      { label: 'Undo', shortcut: 'Ctrl+Z', action: () => { document.execCommand('undo'); setActiveMenu(null); } },
      { label: 'Redo', shortcut: 'Ctrl+Y', action: () => { document.execCommand('redo'); setActiveMenu(null); } },
      { label: '', sep: true, action: () => {} },
      { label: 'Cut', shortcut: 'Ctrl+X', action: () => { document.execCommand('cut'); setActiveMenu(null); } },
      { label: 'Copy', shortcut: 'Ctrl+C', action: () => { document.execCommand('copy'); setActiveMenu(null); } },
      { label: 'Paste', shortcut: 'Ctrl+V', action: () => { document.execCommand('paste'); setActiveMenu(null); } },
      { label: '', sep: true, action: () => {} },
      { label: 'Find', shortcut: 'Ctrl+F', action: () => dispatch('find') },
      { label: 'Replace', shortcut: 'Ctrl+H', action: () => dispatch('replace') },
      { label: '', sep: true, action: () => {} },
      { label: 'Toggle Line Comment', shortcut: 'Ctrl+/', action: () => dispatch('toggleComment') },
      { label: 'Format Document', action: () => dispatch('formatDocument') },
    ],
    Terminal: [
      { label: 'New Terminal', shortcut: 'Ctrl+Shift+`', action: () => dispatch('newTerminal') },
      { label: 'Kill Terminal', action: () => dispatch('killTerminal') },
      { label: '', sep: true, action: () => {} },
      { label: 'Run Task...', action: () => dispatch('runTask') },
      { label: 'Run Build Task...', shortcut: 'Ctrl+Shift+B', action: () => dispatch('runBuildTask') },
      { label: 'Run Active File', action: () => dispatch('runActiveFile') },
    ],
    Help: [
      { label: '📖  About Agent Lee OS', action: () => dispatch('helpAbout') },
      { label: '', sep: true, action: () => {} },
      { label: '🏠  Home — Dashboard overview', action: () => dispatch('helpHome') },
      { label: '💻  Code Studio — How to use', action: () => dispatch('helpCode') },
      { label: '📡  Live View — Remote desktop', action: () => dispatch('helpLive') },
      { label: '📩  Messages — Telegram & inbox', action: () => dispatch('helpMessages') },
      { label: '⚙️  Settings & voice profile', action: () => dispatch('helpSettings') },
      { label: '', sep: true, action: () => {} },
      { label: '⌨️  Keyboard Shortcuts', action: () => dispatch('helpShortcuts') },
      { label: '🔗  Documentation', action: () => openUrl('https://agentleeos.leewayinnovations.io') },
    ],
  };

  return (
    <div ref={barRef} className="h-9 w-full bg-[#111] border-b border-white/5 flex items-center px-4 gap-1 z-100 relative shrink-0">
      <div className="flex items-center mr-4 shrink-0">
        <Box size={16} className="text-blue-500 mr-2" />
        <span className="text-[10px] font-bold tracking-tighter text-gray-400">AGENT LEE STUDIO</span>
      </div>
      <div className="flex gap-0.5 overflow-x-auto no-scrollbar">
        {Object.keys(menus).map(key => (
          <div key={key} className="relative">
            <button
              onClick={() => setActiveMenu(activeMenu === key ? null : key)}
              className={`px-3 py-1.5 text-[11px] font-medium rounded transition-colors whitespace-nowrap ${
                activeMenu === key ? 'bg-[#094771] text-white' : 'text-gray-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {key}
            </button>
            {activeMenu === key && (
              <div className="absolute top-full left-0 mt-0.5 bg-[#252526] border border-[#454545] rounded shadow-2xl z-9999 min-w-57.5 py-1">
                {menus[key].map((item, i) =>
                  item.sep ? (
                    <div key={i} className="border-t border-[#454545] my-1" />
                  ) : (
                    <button
                      key={i}
                      onClick={item.action}
                      className="w-full flex items-center justify-between px-4 py-1.5 text-[12px] text-[#cccccc] hover:bg-[#094771] hover:text-white transition-colors text-left gap-4"
                    >
                      <span>{item.label}</span>
                      {item.shortcut && <span className="text-[10px] text-[#858585] shrink-0">{item.shortcut}</span>}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-4 px-2 text-[10px] text-gray-500 font-mono shrink-0">
        <span className="hidden sm:inline">main*</span>
        <HelpCircle size={14} className="hover:text-white cursor-pointer" onClick={() => dispatch('about')} />
      </div>
    </div>
  );
};

// --- Glass Panel (The Apple Pro / Stark Container) ---
// Replaces HUDFrame. Soft corners, blurred background, subtle borders.
export const GlassPanel: React.FC<{ children: React.ReactNode; className?: string; title?: string }> = ({
  children,
  className = '',
  title
}) => {
  return (
    <div className={`glass-panel rounded-3xl overflow-hidden relative transition-all duration-300 ${className}`}>
      {/* Subtle top sheen */}
      <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-white/20 to-transparent opacity-50"></div>

      {title && (
        <div className="px-6 py-3 border-b border-white/5 flex items-center justify-between bg-white/2">
          <span className="text-[10px] font-semibold tracking-[0.2em] text-blue-400 uppercase font-inter">{title}</span>
          <div className="flex gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-white/10"></div>
          </div>
        </div>
      )}
      <div className="p-0">
        {children}
      </div>
    </div>
  );
};

// --- HUD Frame (Technical/Sci-Fi Border) ---
export const HUDFrame: React.FC<{
  children: React.ReactNode;
  className?: string;
  title?: string;
  icon?: React.ReactNode;
  accent?: 'blue' | 'green' | 'yellow' | 'red' | 'cyan';
}> = ({
  children,
  className = '',
  title,
  icon,
  accent = 'blue'
}) => {
    const accentColors = {
      blue: 'border-blue-500/30 text-blue-400',
      green: 'border-green-500/30 text-green-400',
      yellow: 'border-yellow-500/30 text-yellow-400',
      red: 'border-red-500/30 text-red-400',
      cyan: 'border-cyan-500/30 text-cyan-400',
    };

    const accentColor = accentColors[accent] || accentColors.blue;
    const borderColor = accentColor.split(' ')[0];
    const textColor = accentColor.split(' ')[1];

    return (
      <div className={`relative border ${borderColor} bg-black/40 rounded-xl overflow-hidden ${className}`}>
        {title && (
          <div className={`px-4 py-2 border-b ${borderColor} flex items-center justify-between bg-white/2`}>
            <div className="flex items-center gap-2">
              {icon && <span className={textColor}>{icon}</span>}
              <span className={`text-[10px] font-bold tracking-widest uppercase ${textColor}`}>{title}</span>
            </div>
            <div className="flex gap-1">
              <div className={`w-1 h-1 rounded-full bg-current opacity-50`}></div>
              <div className={`w-1 h-1 rounded-full bg-current opacity-50`}></div>
            </div>
          </div>
        )}
        <div className="p-4">
          {children}
        </div>

        {/* Corner Accents */}
        <div className={`absolute top-0 left-0 w-2 h-2 border-t-2 border-l-2 ${borderColor} rounded-tl-md`}></div>
        <div className={`absolute top-0 right-0 w-2 h-2 border-t-2 border-r-2 ${borderColor} rounded-tr-md`}></div>
        <div className={`absolute bottom-0 left-0 w-2 h-2 border-b-2 border-l-2 ${borderColor} rounded-bl-md`}></div>
        <div className={`absolute bottom-0 right-0 w-2 h-2 border-b-2 border-r-2 ${borderColor} rounded-br-md`}></div>
      </div>
    );
  };

// --- Metric Card (HUD Items) ---
export const MetricCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: string;
  color: string;
  progress?: number;
}> = ({ icon, label, value, color, progress }) => {
  const colorClasses = {
    cyan: 'text-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.2)]',
    purple: 'text-purple-400 shadow-[0_0_10px_rgba(192,132,252,0.2)]',
    amber: 'text-yellow-400 shadow-[0_0_10px_rgba(251,191,36,0.2)]',
    emerald: 'text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.2)]',
    blue: 'text-blue-400 shadow-[0_0_10px_rgba(96,165,250,0.2)]',
  };

  const bgClasses = {
    cyan: 'bg-cyan-500',
    purple: 'bg-purple-500',
    amber: 'bg-yellow-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500',
  };

  const activeColor = (colorClasses as any)[color] || colorClasses.blue;
  const activeBg = (bgClasses as any)[color] || bgClasses.blue;

  return (
    <div className="bg-black/40 border border-white/5 rounded-2xl p-5 hover:border-white/10 transition-all hover:bg-white/2">
      <div className="flex items-center gap-3 mb-4">
        <div className={`w-10 h-10 rounded-xl bg-white/3 flex items-center justify-center ${activeColor}`}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest leading-none">{label}</span>
          <span className="text-xl font-bold text-white mt-1 leading-none">{value}</span>
        </div>
      </div>
      {progress !== undefined && (
        <div className="space-y-2">
          <div className="flex justify-between items-center text-[9px] font-mono text-gray-600 uppercase tracking-tighter">
            <span>Utilization</span>
            <span>{progress}%</span>
          </div>
          <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 ${activeBg}`}
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
      )}
    </div>
  );
};

// --- Contact Row (Minimalist) ---
export const ContactRow: React.FC<{ contact: AgentContact }> = ({ contact }) => (
  <div className="flex items-center justify-between p-4 hover:bg-white/5 transition-all duration-300 cursor-pointer group rounded-2xl mx-2">
    <div className="flex items-center gap-4">
      {/* Avatar Ring */}
      <div className="relative">
        <div className="w-10 h-10 rounded-full bg-linear-to-br from-gray-700 to-gray-900 flex items-center justify-center text-white/80 font-medium text-sm shadow-inner ring-1 ring-white/10">
          {contact.name.charAt(0)}
        </div>
        <div className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-[#121212] ${contact.status === 'online' ? 'bg-accent-cyan shadow-[0_0_8px_#00f0ff]' : 'bg-gray-500'}`}></div>
      </div>

      <div className="flex flex-col">
        <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors tracking-wide">{contact.name}</span>
        <span className="text-[10px] text-gray-500 font-mono tracking-wider">{contact.role}</span>
      </div>
    </div>

    <div className="text-[10px] text-gray-600 font-medium tracking-widest px-3 py-1 rounded-full border border-white/5 group-hover:border-blue-500/30 group-hover:text-blue-400 transition-all">
      {contact.location?.split('-')[0] || 'Unknown'}
    </div>
  </div>
);

// --- Message Stream (Clean Chat) ---
export const MessageStream: React.FC<{ messages: Message[] }> = ({ messages }) => {
  return (
    <GlassPanel title="Chats" className="min-h-62.5 flex flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto max-h-87.5 custom-scrollbar p-6">
        {messages.map((msg) => {
          const isSystem = msg.sender === 'system';
          const isAgent = msg.sender === 'agent';
          const isTelegram = msg.source === 'telegram';

          return (
            <div key={msg.id} className={`flex flex-col ${isSystem ? 'items-center' : 'items-start'} animate-[fadeIn_0.3s_ease-out]`}>
              {isSystem ? (
                <div className="flex items-center gap-2 py-2">
                  <div className="h-px w-8 bg-linear-to-r from-transparent to-blue-500/50"></div>
                  <span className="text-[9px] font-mono text-blue-400/80 tracking-widest uppercase">{msg.text}</span>
                  <div className="h-px w-8 bg-linear-to-l from-transparent to-blue-500/50"></div>
                </div>
              ) : (
                <div className="flex gap-4 max-w-[90%]">
                  <div className={`w-0.5 self-stretch rounded-full ${isAgent ? 'bg-linear-to-b from-accent-cyan to-blue-600' : isTelegram ? 'bg-linear-to-b from-blue-400 to-blue-600' : 'bg-gray-700'}`}></div>
                  <div className="flex flex-col">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className={`text-[10px] font-bold tracking-wider uppercase ${isAgent ? 'text-white' : 'text-gray-400'}`}>{msg.sender}</span>
                      {isTelegram && (
                        <span className="text-[8px] font-bold tracking-widest uppercase text-blue-400 bg-blue-500/10 border border-blue-500/30 rounded px-1.5 py-0.5">TG</span>
                      )}
                      <span className="text-[9px] text-gray-600 font-mono">{msg.timestamp}</span>
                    </div>
                    <p
                      data-testid={isAgent ? 'agent-message' : 'user-message'}
                      data-sender={msg.sender}
                      className="text-sm text-gray-300 leading-relaxed font-light"
                    >{msg.text}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </GlassPanel>
  );
};

// --- Floating Dock (The Bottom Nav) ---
// Inspired by macOS Dock / VisionOS. Floating, centered, blurred.
export const BottomNav: React.FC<{
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  unreadCounts?: Partial<Record<Tab, number>>;
}> = ({ activeTab, onTabChange, unreadCounts = {} }) => {
  const items = [
    { id: Tab.COMMS, icon: <Home size={22} />, label: 'Home' },
    { id: Tab.MESSAGES, icon: <MessageSquare size={22} />, label: 'Messages' },
    { id: Tab.LIVE, icon: <MonitorPlay size={22} />, label: 'Remote' },
    { id: Tab.PHONE, icon: <Smartphone size={22} />, label: 'Phone' },
    { id: Tab.FILES, icon: <FolderOpen size={22} />, label: 'Data' },
    { id: Tab.CODE, icon: <Code2 size={22} />, label: 'Studio' },
    { id: Tab.APPS, icon: <LayoutDashboard size={22} />, label: 'Apps' },
    { id: Tab.SYSTEM, icon: <Settings size={22} />, label: 'Sys' },
  ];

  return (
    <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
      <div className="glass-panel rounded-full px-2 py-2 flex items-center gap-1 pointer-events-auto shadow-[0_10px_40px_-10px_rgba(0,0,0,0.5)] border-white/10 bg-black/40">
        {items.map((item) => {
          const isActive = activeTab === item.id;
          const unread = unreadCounts[item.id as Tab] || 0;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id as Tab)}
              title={item.label}
              aria-label={item.label}
              className={`relative w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 group
                ${isActive ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(255,255,255,0.1)]' : 'text-gray-500 hover:text-white hover:bg-white/5'}`}
            >
              {item.icon}
              {/* Unread badge */}
              {unread > 0 && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 bg-blue-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center px-1 shadow-[0_0_8px_rgba(59,130,246,0.8)]">
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
              {/* Tooltip */}
              <span className="absolute -top-10 bg-black/80 text-white text-[9px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md border border-white/10 pointer-events-none">
                {item.label}
              </span>
              {/* Active Dot */}
              {isActive && <div className="absolute -bottom-1 w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_5px_#00A3FF]"></div>}
            </button>
          );
        })}
      </div>
    </div>
  );
};

// --- Command Input (Floating Pill) ---
export const CommandInput: React.FC<{
  onCommand?: (cmd: string) => void;
  onMicToggle?: () => void;
  isMicEnabled?: boolean;
  disabled?: boolean;
  disabledHint?: string;
}> = ({ onCommand, onMicToggle, isMicEnabled, disabled, disabledHint }) => {
  const [val, setVal] = useState('');

  const submit = () => {
    if (disabled) return;
    if (!val.trim()) return;
    if (onCommand) onCommand(val);
    setVal('');
  };

  return (
    <div className="fixed bottom-24 left-0 right-0 z-40 flex justify-center px-4">
      <div className="w-full max-w-lg glass-panel rounded-full p-1 pl-4 flex items-center shadow-2xl border-white/10 bg-black/60">
        <input
          data-testid="command-input"
          type="text"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder={disabled ? (disabledHint || 'COMMS locked (handshake invalid)') : "Let's talk..."}
          disabled={Boolean(disabled)}
          className={`flex-1 bg-transparent text-white text-sm focus:outline-none placeholder-gray-500 font-light h-10 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
        />
        <div className="flex gap-1">
          <button
            title="Voice input"
            aria-label="Voice input"
            onClick={onMicToggle}
            disabled={Boolean(disabled)}
            className={`w-10 h-10 flex items-center justify-center transition-colors rounded-full hover:bg-white/5 ${isMicEnabled ? 'text-blue-400 bg-blue-500/10' : 'text-gray-400'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
          >
            <Mic size={18} className={isMicEnabled ? 'animate-pulse' : ''} />
          </button>
          <button
            title="Send command"
            aria-label="Send command"
            onClick={submit}
            disabled={Boolean(disabled)}
            className={`w-10 h-10 flex items-center justify-center bg-blue-600 hover:bg-blue-500 text-white rounded-full transition-all shadow-[0_0_15px_rgba(37,99,235,0.4)] ${disabled ? 'opacity-40 cursor-not-allowed hover:bg-blue-600' : ''}`}
          >
            <Send size={16} className="ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
