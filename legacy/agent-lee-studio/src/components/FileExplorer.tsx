import { ChevronRight, FileCode, FileJson, Folder, HardDrive, Hash, MoreHorizontal, RefreshCcw, Search } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { BACKEND_URL } from '../constants';
import { SovereignIdentity } from '../services/SovereignIdentity';

/**
 * FILE EXPLORER (V3)
 * Redesigned as a "Neural Data Tree" with fluid animations and spatial depth.
 */

interface FileNode {
    name: string;
    type: 'file' | 'folder';
    path: string;
    children?: FileNode[];
    isOpen?: boolean;
}

const INDENT_CLASSES = ['pl-3', 'pl-7', 'pl-11', 'pl-15', 'pl-19', 'pl-23', 'pl-27', 'pl-31'];
const LINE_LEFT_CLASSES = ['left-1', 'left-5', 'left-9', 'left-13', 'left-17', 'left-21', 'left-25', 'left-29'];
const getIndentClass = (depth: number) => INDENT_CLASSES[Math.min(depth, INDENT_CLASSES.length - 1)];
const getLineLeftClass = (depth: number) => LINE_LEFT_CLASSES[Math.min(depth, LINE_LEFT_CLASSES.length - 1)];

const FileTreeItem: React.FC<{ node: FileNode; depth: number; onSelect: (node: FileNode) => void }> = ({ node, depth, onSelect }) => {
    const [isOpen, setIsOpen] = useState(node.isOpen || false);
    const [children, setChildren] = useState<FileNode[]>(node.children || []);
    const [loading, setLoading] = useState(false);

    const toggleOpen = async () => {
        if (node.type === 'folder') {
            const nextOpen = !isOpen;
            setIsOpen(nextOpen);

            if (nextOpen && children.length === 0) {
                setLoading(true);
                try {
                    const headers = await SovereignIdentity.signRequest({ path: node.path });
                    const res = await fetch(`${BACKEND_URL}/api/files?path=${encodeURIComponent(node.path)}`, { headers });
                    if (!res.ok) throw new Error('Access Denied');
                    const data = await res.json();
                    setChildren(data.files || []);
                } catch (e) {
                    console.error("FS_ACCESS_ERROR", e);
                } finally {
                    setLoading(false);
                }
            }
        } else {
            onSelect(node);
        }
    };

    return (
        <div className="font-mono select-none relative">
            {/* Connection Line (Vertical) - Visual candy for depth */}
            {depth > 0 && (
                <div
                    className={`absolute top-0 bottom-0 w-[1px] bg-white/5 ${getLineLeftClass(depth)}`}
                ></div>
            )}

            <div
                className={`
                    flex items-center py-2 md:py-1 px-3 cursor-pointer text-[13px] md:text-[11px] group transition-all duration-200 relative overflow-hidden
                    min-h-[44px] md:min-h-[28px] /* Touch target size */
                    ${isOpen ? 'text-accent-cyan bg-accent-cyan/5' : 'text-text-dim hover:text-white hover:bg-white/5'}
                    ${getIndentClass(depth)}
                `}
                onClick={toggleOpen}
            >
                {/* Hover Glow */}
                <div className="absolute inset-0 bg-gradient-to-r from-accent-cyan/0 via-accent-cyan/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>

                <span className="mr-2 opacity-70 group-hover:opacity-100 transition-opacity z-10">
                    {node.type === 'folder' && (
                        <div className={`transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`}>
                            <ChevronRight size={10} />
                        </div>
                    )}
                    {node.type === 'file' && <div className="w-[10px]" />}
                </span>

                <span className="mr-3 relative z-10">
                    {node.type === 'folder' && <Folder size={14} className={isOpen ? 'text-accent-cyan drop-shadow-[0_0_8px_rgba(0,240,255,0.4)]' : 'text-text-muted group-hover:text-text-primary'} />}
                    {node.name.endsWith('.tsx') && <FileCode size={14} className="text-blue-400" />}
                    {node.name.endsWith('.ts') && <FileCode size={14} className="text-blue-500/80" />}
                    {node.name.endsWith('.css') && <Hash size={14} className="text-pink-400" />}
                    {node.name.endsWith('.json') && <FileJson size={14} className="text-yellow-400" />}
                    {!node.name.includes('.') && node.type === 'file' && <FileCode size={14} className="text-gray-500" />}
                </span>

                <span className="truncate flex-1 tracking-tight z-10">{node.name}</span>

                {loading && <RefreshCcw size={10} className="animate-spin text-accent-cyan ml-2" />}
            </div>

            {node.type === 'folder' && isOpen && (
                <div className="animate-in slide-in-from-top-2 duration-200">
                    {children.length > 0 ? (
                        children.map((child, i) => (
                            <FileTreeItem key={i} node={child} depth={depth + 1} onSelect={onSelect} />
                        ))
                    ) : !loading && (
                        <div className={`py-2 text-[9px] text-text-muted/30 italic uppercase tracking-widest ${getIndentClass(depth + 1)}`}>
                            [ Empty_Sector ]
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface FileExplorerProps {
    onSelectNode?: (node: FileNode) => void;
}

export const FileExplorer: React.FC<FileExplorerProps> = ({ onSelectNode }) => {
    const [rootFiles, setRootFiles] = useState<FileNode[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchRoot = async () => {
        setLoading(true);
        try {
            const headers = await SovereignIdentity.signRequest({ path: '.' });
            const res = await fetch(`${BACKEND_URL}/api/files?path=.`, { headers });
            if (!res.ok) throw new Error('Neural Handshake Failed');
            const data = await res.json();
            setRootFiles(data.files || []);
        } catch (e) {
            console.error("ROOT_ACCESS_FAILURE", e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRoot(); }, []);

    return (
        <div className="flex flex-col h-full bg-glass-surface/30 backdrop-blur-md border-r border-glass-border">

            {/* Header */}
            <div className="h-14 px-5 flex items-center justify-between border-b border-glass-border bg-black/40">
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20">
                        <HardDrive size={14} className="text-accent-cyan" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-[10px] font-bold text-white uppercase tracking-widest">Neural_Drive</span>
                        <span className="text-[8px] font-mono text-text-muted">/root/agent-lee-studio</span>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button title="Search Files" aria-label="Search Files" className="p-1.5 hover:bg-white/5 rounded-md text-text-muted hover:text-white transition-colors">
                        <Search size={14} />
                    </button>
                    <button title="Refresh Files" aria-label="Refresh Files" onClick={fetchRoot} className="p-1.5 hover:bg-white/5 rounded-md text-text-muted hover:text-white transition-colors">
                        <RefreshCcw size={14} className={loading ? 'animate-spin' : ''} />
                    </button>
                    <button title="More Options" aria-label="More Options" className="p-1.5 hover:bg-white/5 rounded-md text-text-muted hover:text-white transition-colors">
                        <MoreHorizontal size={14} />
                    </button>
                </div>
            </div>

            {/* Tree Area */}
            <div className="flex-1 overflow-y-auto py-2 scrollbar-hide">
                {loading && rootFiles.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-4 opacity-50">
                        <div className="relative">
                            <div className="absolute inset-0 rounded-full bg-accent-cyan/20 animate-ping"></div>
                            <RefreshCcw className="animate-spin text-accent-cyan relative z-10" size={24} />
                        </div>
                        <span className="text-[9px] font-mono text-text-dim uppercase tracking-widest animate-pulse">Scanning_File_Index...</span>
                    </div>
                ) : (
                    <div className="px-2">
                        {rootFiles.map((node, i) => (
                            <FileTreeItem key={i} node={node} depth={0} onSelect={(selectedNode) => onSelectNode?.(selectedNode)} />
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Stats */}
            <div className="h-8 border-t border-glass-border bg-black/60 flex items-center justify-between px-4 text-[9px] font-mono text-text-muted">
                <span>{rootFiles.length} NODES_DETECTED</span>
                <span>RD_ONLY</span>
            </div>
        </div>
    );
};
