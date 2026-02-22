
import { DBSchema, IDBPDatabase, openDB } from 'idb';
import JSZip from 'jszip';
import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";

// ==========================================
// 0. SYSTEM CONSTANTS & TYPES
// ==========================================

const DB_NAME_CORE = 'agent-lee-neural-core';
const DB_VERSION_CORE = 3;
const DB_NAME_COLD = 'agent-lee-cold-store';
const DB_VERSION_COLD = 1;

export type DriveId = "L" | "E" | "O" | "N" | "A" | "R" | "D" | "LEE";
export type CorruptionStatus = "safe" | "suspect" | "corrupt" | "offloaded";
export type FileCategory = "code" | "data" | "doc" | "media" | "sys" | "archive";

const DRIVE_COLORS: Record<DriveId, string> = {
    "LEE": "#ffffff", "N": "#d8b4fe", "A": "#f472b6", "R": "#fb923c",
    "O": "#fbbf24", "L": "#22d3ee", "E": "#facc15", "D": "#4ade80",
};

export interface ExternalRef {
    type: 'opfs' | 'handle';
    path: string;
    archiveId?: string;
}

export interface NeuralFile {
    id: string;
    driveId: DriveId;
    slotId: number;
    name: string;
    path: string; // Relative path inside the slot
    extension: string;
    sizeBytes: number;
    content: string | Blob | null;
    category: FileCategory;
    status: CorruptionStatus;
    lastModified: number;
    signature: string;
    annotations: { id: string; text: string; timestamp: string }[];
    externalRef?: ExternalRef;
}

export interface ColdArchiveEntry {
    id: string;
    name: string;
    sizeBytes: number;
    createdAt: number;
    path: string; // OPFS path
    mimeType: string;
    originalDriveId?: string;
    originalSlotId?: number;
}

// ==========================================
// 1. UTILITIES: OPFS (Origin Private File System)
// ==========================================

function normalizePath(path: string): string {
    return path.replace(/^opfs:\//, "").replace(/^\/+/, "");
}

async function getOpfsRoot(): Promise<FileSystemDirectoryHandle> {
    return await navigator.storage.getDirectory();
}

async function opfsWriteFile(path: string, blob: Blob): Promise<void> {
    const rel = normalizePath(path);
    const parts = rel.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error(`Invalid OPFS path: ${path}`);

    let dir = await getOpfsRoot();
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: true });
    }

    const fh = await dir.getFileHandle(fileName, { create: true });
    const w = await fh.createWritable();
    await w.write(blob);
    await w.close();
}

async function opfsReadFile(path: string): Promise<File> {
    const rel = normalizePath(path);
    const parts = rel.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) throw new Error(`Invalid OPFS path: ${path}`);

    let dir = await getOpfsRoot();
    for (const part of parts) {
        dir = await dir.getDirectoryHandle(part, { create: false });
    }

    const fh = await dir.getFileHandle(fileName, { create: false });
    return await fh.getFile();
}

async function opfsDeleteFile(path: string): Promise<void> {
    const rel = normalizePath(path);
    const parts = rel.split("/").filter(Boolean);
    const fileName = parts.pop();
    if (!fileName) return;

    try {
        let dir = await getOpfsRoot();
        for (const part of parts) {
            dir = await dir.getDirectoryHandle(part, { create: false });
        }
        await dir.removeEntry(fileName);
    } catch (e) {
        console.warn("Failed to delete OPFS file:", path, e);
    }
}

// ==========================================
// 2. LOGIC: COLD STORE (Singleton)
// ==========================================

interface ColdDB extends DBSchema {
    archives: { key: string; value: ColdArchiveEntry };
}

class ColdStorageLink {
    private dbPromise = openDB<ColdDB>(DB_NAME_COLD, DB_VERSION_COLD, {
        upgrade(db) {
            db.createObjectStore('archives', { keyPath: 'id' });
        },
    });

    async addArchive(blob: Blob, meta: Omit<ColdArchiveEntry, 'path' | 'createdAt' | 'sizeBytes'>): Promise<ColdArchiveEntry> {
        const path = `archives/${meta.id}_${meta.name}`;
        await opfsWriteFile(path, blob);

        const entry: ColdArchiveEntry = {
            ...meta,
            path,
            sizeBytes: blob.size,
            createdAt: Date.now(),
        };

        const db = await this.dbPromise;
        await db.put('archives', entry);
        return entry;
    }

    async getArchiveBlob(id: string): Promise<Blob | null> {
        const db = await this.dbPromise;
        const entry = await db.get('archives', id);
        if (!entry) return null;
        try {
            return await opfsReadFile(entry.path);
        } catch (e) {
            console.error("Failed to read cold archive:", e);
            return null;
        }
    }

    async removeArchive(id: string) {
        const db = await this.dbPromise;
        const entry = await db.get('archives', id);
        if (entry) {
            await opfsDeleteFile(entry.path);
            await db.delete('archives', id);
        }
    }

    async listArchives(): Promise<ColdArchiveEntry[]> {
        const db = await this.dbPromise;
        return db.getAll('archives');
    }
}
const coldStore = new ColdStorageLink();

// ==========================================
// 3. LOGIC: NEURAL DB (Singleton)
// ==========================================

interface NeuralDB extends DBSchema {
    files: {
        key: string;
        value: NeuralFile;
        indexes: { 'by-slot': [string, number]; 'by-signature': string };
    };
    meta: { key: string; value: { initialized: boolean } };
}

class NeuralLink {
    private dbPromise: Promise<IDBPDatabase<NeuralDB>>;

    constructor() {
        this.dbPromise = openDB<NeuralDB>(DB_NAME_CORE, DB_VERSION_CORE, {
            upgrade(db, oldVersion) {
                if (oldVersion < 2) {
                    if (db.objectStoreNames.contains('files')) db.deleteObjectStore('files');
                    if (db.objectStoreNames.contains('meta')) db.deleteObjectStore('meta');
                }
                if (!db.objectStoreNames.contains('files')) {
                    const fileStore = db.createObjectStore('files', { keyPath: 'id' });
                    fileStore.createIndex('by-slot', ['driveId', 'slotId']);
                    fileStore.createIndex('by-signature', 'signature');
                }
                if (!db.objectStoreNames.contains('meta')) {
                    db.createObjectStore('meta');
                }
            },
        });
        this.initializeCore();
    }

    private async initializeCore() {
        const db = await this.dbPromise;
        const meta = await db.get('meta', 'init');
        if (!meta) {
            console.log("Agent Lee: Initializing Neural Grid...");
            await this.seedMockData();
            await db.put('meta', { initialized: true }, 'init');
        }
    }

    async getFiles(driveId: DriveId, slotId: number): Promise<NeuralFile[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex('files', 'by-slot', [driveId, slotId]);
    }

    async getFilesByDrive(driveId: DriveId): Promise<NeuralFile[]> {
        const db = await this.dbPromise;
        const range = IDBKeyRange.bound([driveId, 0], [driveId, 100]);
        return db.getAllFromIndex('files', 'by-slot', range);
    }

    async getAllFiles(): Promise<NeuralFile[]> {
        const db = await this.dbPromise;
        return db.getAll('files');
    }

    async getCopies(signature: string): Promise<NeuralFile[]> {
        const db = await this.dbPromise;
        return db.getAllFromIndex('files', 'by-signature', signature);
    }

    async addFile(file: NeuralFile) {
        const db = await this.dbPromise;
        await db.put('files', file);
    }

    async renameFile(id: string, newName: string) {
        const db = await this.dbPromise;
        const f = await db.get('files', id);
        if (f) {
            f.name = newName;
            f.lastModified = Date.now();
            await db.put('files', f);
        }
    }

    async deleteFile(id: string) {
        const db = await this.dbPromise;
        await db.delete('files', id);
    }

    async updateStatus(id: string, status: CorruptionStatus) {
        const db = await this.dbPromise;
        const f = await db.get('files', id);
        if (f) { f.status = status; await db.put('files', f); }
    }

    async offload(id: string, ref: ExternalRef) {
        const db = await this.dbPromise;
        const f = await db.get('files', id);
        if (f) {
            f.content = null;
            f.status = 'offloaded';
            f.externalRef = ref;
            f.lastModified = Date.now();
            await db.put('files', f);
        }
    }

    private async seedMockData() {
        const drives: DriveId[] = ["L", "E", "O", "N", "A", "R", "D", "LEE"];
        const roles: Record<string, FileCategory[]> = {
            "LEE": ["sys", "code"],
            "N": ["media"], "A": ["media"],
            "R": ["media", "doc"], "O": ["archive", "data"],
            "L": ["code", "data"], "E": ["data", "code"],
            "D": ["doc"]
        };

        const db = await this.dbPromise;
        const tx = db.transaction('files', 'readwrite');

        for (const d of drives) {
            for (let s = 1; s <= 8; s++) {
                if (Math.random() > 0.3) {
                    const count = Math.floor(Math.random() * 3) + 1;
                    for (let i = 0; i < count; i++) {
                        const cat = roles[d][i % roles[d].length] || 'doc';
                        const isCorrupt = (d === 'D' || d === 'E') && Math.random() > 0.85;
                        const path = (Math.random() > 0.7) ? "archive/old_logs/" : "";
                        let extension = 'dat';
                        if (cat === 'code') extension = 'ts';
                        if (cat === 'media') extension = 'png';

                        let content: string | Blob = isCorrupt ? "CORRUPTED_SECTOR_DATA" : "Active neural pathway data...";
                        if (cat === 'media') content = new Blob(["MOCK_BINARY_DATA"], { type: 'application/octet-stream' });

                        const file: NeuralFile = {
                            id: `${d}-${s}-${i}-${Date.now()}`,
                            driveId: d, slotId: s,
                            name: `mem_frag_${d}${s}_${i}.${extension}`,
                            path: path, extension: extension,
                            sizeBytes: Math.floor(Math.random() * 1024 * 1024 * 5),
                            content: content, category: cat,
                            status: isCorrupt ? 'corrupt' : 'safe',
                            lastModified: Date.now(),
                            signature: `SIG_${d}_${i}`,
                            annotations: []
                        };
                        tx.store.put(file);
                    }
                }
            }
        }
        await tx.done;
    }
}
const neuralDB = new NeuralLink();

// ==========================================
// 4. SUB-COMPONENTS
// ==========================================

interface LayoutNode {
    id: string;
    x: number; y: number; w: number; h: number;
    color: string;
    type: "drive" | "slot" | "file";
    status?: CorruptionStatus;
    relatedDrives?: DriveId[];
}

const ConnectionLayer: React.FC<{ nodes: LayoutNode[], w: number, h: number, activeDrive: DriveId, activeSlot: number | null }> = ({ nodes, w, h, activeDrive, activeSlot }) => {
    const getNode = (id: string) => nodes.find(n => n.id === id);
    const driveColor = DRIVE_COLORS[activeDrive];
    const paths: React.ReactNode[] = [];

    const driveNode = getNode(`drive_${activeDrive}`);
    if (driveNode) {
        nodes.filter(n => n.type === 'slot').forEach(slot => {
            const start = { x: driveNode.x + driveNode.w / 2, y: driveNode.y + driveNode.h };
            const end = { x: slot.x + slot.w, y: slot.y + slot.h / 2 };
            const cp1 = { x: start.x, y: start.y + 100 };
            const cp2 = { x: end.x + 50, y: end.y };
            const d = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

            const isActive = activeSlot && `slot_${activeDrive}-${activeSlot}` === slot.id;
            paths.push(<path key={`d-s-${slot.id}`} d={d} stroke={driveColor} strokeWidth={isActive ? 2.5 : 1.5} fill="none" opacity={isActive ? 0.9 : 0.4} />);
            if (isActive) paths.push(<path key={`d-s-anim-${slot.id}`} d={d} stroke={driveColor} strokeWidth={4} fill="none" className="animate-flow" strokeDasharray="10 100" strokeLinecap="round" filter="url(#glow)" />);
        });
    }

    if (activeSlot && driveNode) {
        const slotNode = getNode(`slot_${activeDrive}-${activeSlot}`);
        if (slotNode) {
            nodes.filter(n => n.type === 'file').forEach(file => {
                if (file.status === 'corrupt') return;

                const start = { x: slotNode.x + slotNode.w, y: slotNode.y + slotNode.h / 2 };
                const end = { x: file.x, y: file.y + file.h / 2 };
                const cp1 = { x: start.x + 80, y: start.y };
                const cp2 = { x: end.x - 80, y: end.y };
                const d = `M ${start.x} ${start.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${end.x} ${end.y}`;

                const isOffloaded = file.status === 'offloaded';
                const dash = isOffloaded ? "4 4" : "";

                paths.push(<path key={`s-f-${file.id}`} d={d} stroke={driveColor} strokeWidth={1.5} fill="none" opacity={0.5} strokeDasharray={dash} />);
                const animClass = isOffloaded ? "animate-pulse" : "animate-flow-fast";
                if (!isOffloaded) {
                    paths.push(<path key={`s-f-anim-${file.id}`} d={d} stroke={driveColor} strokeWidth={2.5} fill="none" className={animClass} strokeDasharray="5 50" strokeLinecap="round" filter="url(#glow)" />);
                }

                file.relatedDrives?.forEach(rId => {
                    const rNode = getNode(`drive_${rId}`);
                    if (rNode) {
                        const rColor = DRIVE_COLORS[rId];
                        const fStart = { x: file.x + file.w / 2, y: file.y };
                        const dEnd = { x: rNode.x + rNode.w / 2, y: rNode.y + rNode.h };
                        const rCp1 = { x: fStart.x, y: fStart.y - 100 };
                        const rCp2 = { x: dEnd.x, y: dEnd.y + 100 };
                        const rD = `M ${fStart.x} ${fStart.y} C ${rCp1.x} ${rCp1.y}, ${rCp2.x} ${rCp2.y}, ${dEnd.x} ${dEnd.y}`;
                        paths.push(<path key={`f-d-${file.id}-${rId}`} d={rD} stroke={rColor} strokeWidth={1} fill="none" opacity={0.7} />);
                        paths.push(<path key={`f-d-a-${file.id}-${rId}`} d={rD} stroke={rColor} strokeWidth={3} fill="none" className="animate-reverse-flow" strokeDasharray="5 80" strokeLinecap="round" filter="url(#glow)" opacity={1} />);
                    }
                });
            });
        }
    }

    return (
        <svg width={w} height={h} className="absolute inset-0 pointer-events-none z-10 overflow-visible">
            <defs>
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                    <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                    <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                    </feMerge>
                </filter>
            </defs>
            {paths}
        </svg>
    );
};

const FileCard: React.FC<{
    file: NeuralFile,
    activeDriveId: DriveId,
    fileRelations: Record<string, DriveId[]>,
    onOpen: (f: NeuralFile) => void,
    onRename: (id: string, name: string) => void,
    isSelected: boolean,
    selectionMode: boolean,
    toggleSelection: (id: string) => void,
    setRef: (id: string) => (el: HTMLDivElement | null) => void
}> = React.memo(({ file, activeDriveId, fileRelations, onOpen, onRename, isSelected, selectionMode, toggleSelection, setRef }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState(file.name);
    const inputRef = useRef<HTMLInputElement>(null);

    const isCorrupt = file.status === 'corrupt';
    const isOffloaded = file.status === 'offloaded';

    useEffect(() => { setEditName(file.name); }, [file.name]);
    useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

    const handleRenameSubmit = () => {
        if (editName.trim() && editName !== file.name) onRename(file.id, editName);
        setIsEditing(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') handleRenameSubmit();
        if (e.key === 'Escape') { setEditName(file.name); setIsEditing(false); }
        e.stopPropagation();
    };

    let borderColor = 'border-slate-800';
    let bgColor = 'bg-slate-900/20';
    let hoverClass = isCorrupt ? 'hover:bg-red-900/20 hover:border-red-500 hover:scale-105 shadow-[0_0_10px_rgba(220,38,38,0.2)] cursor-help' : 'hover:bg-white/5 hover:border-white/20 hover:scale-105 cursor-pointer cursor-grab active:cursor-grabbing';

    if (isCorrupt) {
        borderColor = 'border-red-600/50';
        bgColor = 'bg-red-950/10';
    } else if (isOffloaded) {
        borderColor = 'border-dashed border-slate-600';
        bgColor = 'bg-transparent';
        hoverClass = 'hover:bg-slate-900/40 cursor-alias';
    }

    if (isSelected) {
        borderColor = 'border-cyan-400 border-2 shadow-[0_0_15px_rgba(34,211,238,0.3)]';
        bgColor = 'bg-cyan-900/20';
    } else if (selectionMode) {
        hoverClass = 'hover:bg-cyan-900/10 hover:border-cyan-500/50 cursor-crosshair';
    }

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (selectionMode || e.ctrlKey || e.metaKey) toggleSelection(file.id);
        else if (!isEditing) onOpen(file);
    };

    return (
        <div ref={setRef(`file_${file.id}`)} onClick={handleClick} draggable={!isEditing}
            onDragStart={(e) => { if (!isEditing) { e.dataTransfer.setData("agent-lee-file-id", file.id); e.dataTransfer.effectAllowed = "copy"; } else e.preventDefault(); }}
            className={`relative p-3 border rounded-lg backdrop-blur-sm transition-all duration-300 flex flex-col justify-between min-h-[90px] group overflow-hidden ${borderColor} ${bgColor} ${hoverClass}`}>
            <div className="flex justify-between items-start">
                <div className={`w-2 h-2 rounded-full ${isOffloaded ? 'bg-slate-600 animate-pulse' : ''} ${isCorrupt ? 'bg-red-500 animate-ping' : ''}`} style={{ backgroundColor: (!isOffloaded && !isCorrupt) ? DRIVE_COLORS[activeDriveId] : undefined }} />
                {selectionMode && <div className={`w-3 h-3 rounded border ${isSelected ? 'bg-cyan-400 border-cyan-400' : 'border-slate-600 bg-transparent'}`}></div>}
                {isOffloaded && !selectionMode && <span className="text-[10px] text-slate-500 font-mono tracking-tighter border border-slate-700 px-1 rounded">EXT. LINK</span>}
                {isCorrupt && !selectionMode && <span className="text-[9px] text-red-500 font-black tracking-widest border border-red-900 bg-red-950 px-1 rounded animate-pulse">CORRUPT</span>}
                {(!isOffloaded && !isCorrupt && !selectionMode && fileRelations[file.id]) && (
                    <div className="flex gap-1.5 bg-black/50 rounded-full px-1.5 py-0.5 border border-white/10">
                        {fileRelations[file.id].map(r => <div key={r} className="w-2 h-2 rounded-full shadow-[0_0_5px_currentColor] animate-pulse" style={{ backgroundColor: DRIVE_COLORS[r], color: DRIVE_COLORS[r] }} />)}
                    </div>
                )}
            </div>

            <div className="mt-2 z-10 relative">
                {isEditing ? (
                    <input ref={inputRef} value={editName} onChange={e => setEditName(e.target.value)} onBlur={handleRenameSubmit} onKeyDown={handleKeyDown} onClick={e => e.stopPropagation()} className="w-full bg-black/50 border border-emerald-500/50 text-xs font-bold text-white px-1 rounded outline-none font-mono" />
                ) : (
                    <div className="group/name flex items-center justify-between gap-1 w-full">
                        <div className={`text-xs font-bold truncate ${isOffloaded ? 'text-slate-500 italic' : ''} ${isCorrupt ? 'text-red-400 font-mono' : 'text-slate-300 group-hover:text-white'}`}>{file.name}</div>
                        {!isOffloaded && !isCorrupt && !selectionMode && <button onClick={(e) => { e.stopPropagation(); setIsEditing(true); }} className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-500 hover:text-emerald-400 px-1">✎</button>}
                    </div>
                )}
                <div className="flex justify-between items-center mt-1">
                    <div className="text-[9px] font-mono text-slate-600 uppercase">{file.category}</div>
                    {isOffloaded && <div className="text-[10px] text-emerald-500 font-bold animate-pulse">» CONNECTED</div>}
                </div>
            </div>
        </div>
    );
});

const MediaPreview: React.FC<{ file: NeuralFile }> = ({ file }) => {
    const [url, setUrl] = useState<string | null>(null);
    const [mimeType, setMimeType] = useState<string>('');

    useEffect(() => {
        let activeUrl: string | null = null;
        let isMounted = true;
        const load = async () => {
            let blob: Blob | null = null;
            if (file.content instanceof Blob) blob = file.content;
            else if (file.status === 'offloaded' && file.externalRef?.type === 'opfs') {
                try { blob = await coldStore.getArchiveBlob(file.externalRef.archiveId || file.id); } catch (e) { console.error(e); }
            }
            if (isMounted && blob) {
                setMimeType(blob.type);
                activeUrl = URL.createObjectURL(blob);
                setUrl(activeUrl);
            }
        };
        load();
        return () => { isMounted = false; if (activeUrl) URL.revokeObjectURL(activeUrl); };
    }, [file.id, file.status, file.externalRef?.archiveId]);

    if (!url) return null;
    const type = mimeType || '';
    const name = file.name || '';
    const isImg = type.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp|svg)$/i.test(name) || name.endsWith('.png');
    const isAudio = type.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(name);
    const isVideo = type.startsWith('video/') || /\.(mp4|webm|mov|mkv)$/i.test(name);

    return (
        <div className="w-full h-32 bg-black border border-slate-800 rounded mb-4 flex items-center justify-center overflow-hidden relative">
            {isImg && <img src={url} alt="Preview" className="max-h-full max-w-full object-contain" />}
            {isAudio && <audio controls src={url} className="w-full px-4" />}
            {isVideo && <video controls src={url} className="max-h-full max-w-full" />}
            {(!isImg && !isAudio && !isVideo) && <div className="text-[10px] text-slate-500">BINARY PREVIEW NOT AVAILABLE</div>}
        </div>
    );
};

// ==========================================
// 5. MAIN APPLICATION COMPONENT
// ==========================================

export interface AgentLeeRef {
    speak: (message: string) => void;
    focusDrive: (driveId: DriveId) => void;
}

const MemoryLakeCore = forwardRef<AgentLeeRef, { onExit?: () => void }>(({ onExit }, ref) => {
    const [activeDriveId, setActiveDriveId] = useState<DriveId>("LEE");
    const [activeSlotId, setActiveSlotId] = useState<number | null>(null);
    const [activeFile, setActiveFile] = useState<NeuralFile | null>(null);
    const [viewSafeMode, setViewSafeMode] = useState(false);
    const [files, setFiles] = useState<NeuralFile[]>([]);
    const [fileRelations, setFileRelations] = useState<Record<string, DriveId[]>>({});
    const [slotCounts, setSlotCounts] = useState<Record<number, number>>({});
    const [coldArchives, setColdArchives] = useState<ColdArchiveEntry[]>([]);
    const [dragOverDrive, setDragOverDrive] = useState<DriveId | null>(null);
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const containerRef = useRef<HTMLDivElement>(null);
    const nodeRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const fileInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const [dim, setDim] = useState({ w: 0, h: 0 });
    const [tick, setTick] = useState(0);

    useEffect(() => { refreshSlotCounts(); refreshColdArchives(); }, [activeDriveId]);

    const refreshSlotCounts = async () => {
        const f = await neuralDB.getFilesByDrive(activeDriveId);
        const counts: Record<number, number> = {};
        f.forEach(file => { counts[file.slotId] = (counts[file.slotId] || 0) + 1; });
        setSlotCounts(counts);
    };

    const refreshColdArchives = async () => {
        const archives = await coldStore.listArchives();
        setColdArchives(archives);
    };

    const loadFiles = async () => {
        if (!activeSlotId) { setFiles([]); return; }
        const fs = await neuralDB.getFiles(activeDriveId, activeSlotId) as unknown as NeuralFile[];
        setFiles(fs);
        const rels: Record<string, DriveId[]> = {};
        for (const f of fs) {
            if (f.signature) {
                try {
                    const copies = await neuralDB.getCopies(f.signature);
                    const driveIds = copies.map(c => c.driveId).filter(d => d !== activeDriveId);
                    const others = Array.from(new Set<DriveId>(driveIds));
                    if (others.length > 0) rels[f.id] = others;
                } catch (e) { /* ignore */ }
            }
        }
        setFileRelations(rels);
    };

    useEffect(() => { loadFiles(); setSelectedIds(new Set()); setSelectionMode(false); }, [activeDriveId, activeSlotId]);

    useEffect(() => {
        if (!containerRef.current) return;
        const ro = new ResizeObserver(e => setDim({ w: e[0].contentRect.width, h: e[0].contentRect.height }));
        ro.observe(containerRef.current);
        return () => ro.disconnect();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => setTick(t => t + 1), 50);
        return () => clearInterval(interval);
    }, [files, activeSlotId]);

    const toggleSelection = (id: string) => {
        const next = new Set(selectedIds);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        setSelectedIds(next);
        if (next.size > 0 && !selectionMode) setSelectionMode(true);
        if (next.size === 0) setSelectionMode(false);
    };

    const selectAll = () => {
        if (selectedIds.size === files.length) setSelectedIds(new Set());
        else setSelectedIds(new Set(files.map(f => f.id)));
    };

    const handleRename = async (id: string, newName: string) => {
        await neuralDB.renameFile(id, newName);
        loadFiles();
    };

    const handleExport = async (scope: 'file' | 'slot' | 'drive' | 'system' | 'selected', targetFile?: NeuralFile) => {
        const zip = new JSZip();
        let targets: NeuralFile[] = [];
        let filename = "export.zip";

        if (scope === 'file' && targetFile) {
            targets = [targetFile];
            filename = `${targetFile.name}.zip`;
        } else if (scope === 'selected' && selectedIds.size > 0) {
            targets = files.filter(f => selectedIds.has(f.id));
            filename = `BATCH_EXPORT_${selectedIds.size}_FILES.zip`;
        } else if (scope === 'slot' && activeSlotId) {
            targets = await neuralDB.getFiles(activeDriveId, activeSlotId) as unknown as NeuralFile[];
            filename = `DRIVE-${activeDriveId}_SLOT-${activeSlotId}.zip`;
        } else if (scope === 'drive') {
            targets = await neuralDB.getFilesByDrive(activeDriveId) as unknown as NeuralFile[];
            filename = `DRIVE-${activeDriveId}_FULL.zip`;
        } else if (scope === 'system') {
            targets = await neuralDB.getAllFiles() as unknown as NeuralFile[];
            filename = `AGENT_LEE_CORE_SYSTEM.zip`;
        }

        targets.forEach(f => {
            const folderPrefix = f.path ? f.path : "";
            const entryName = folderPrefix + f.name;
            if (f.status === 'offloaded') {
                zip.file(`${entryName}.link`, `EXTERNAL_LINK_REF: ${f.id}\nORIGINAL_SIZE: ${f.sizeBytes}`);
            } else if (f.content) {
                zip.file(entryName, f.content);
            }
        });

        const blob = await zip.generateAsync({ type: "blob" });
        if (blob.size > 1024 * 1024 * 1024) {
            alert("SYSTEM ALERT: Archive exceeds 1GB logical segment limit.");
            return;
        }
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        a.click();
    };

    const handleBatchDelete = async () => {
        if (!confirm(`Permanently delete ${selectedIds.size} neural nodes?`)) return;
        for (const id of selectedIds) await neuralDB.deleteFile(id);
        await loadFiles();
        refreshSlotCounts();
        setSelectedIds(new Set());
        setSelectionMode(false);
    };

    const handleBatchOffload = async () => {
        const targets = files.filter(f => selectedIds.has(f.id) && f.status !== 'offloaded' && f.content);
        for (const f of targets) {
            let blob: Blob;
            if (f.content instanceof Blob) blob = f.content;
            else if (typeof f.content === 'string') blob = new Blob([f.content], { type: 'text/plain' });
            else continue;

            const archive = await coldStore.addArchive(blob, {
                id: f.id, name: f.name, mimeType: blob.type || 'application/octet-stream',
                originalDriveId: f.driveId, originalSlotId: f.slotId
            });
            await neuralDB.offload(f.id, { type: 'opfs', path: archive.path, archiveId: archive.id });
        }
        await loadFiles();
        refreshColdArchives();
        setSelectedIds(new Set());
    };

    const handleOffload = async () => {
        if (!activeFile) return;
        let blob: Blob;
        if (activeFile.content instanceof Blob) blob = activeFile.content;
        else if (typeof activeFile.content === 'string') blob = new Blob([activeFile.content], { type: 'text/plain' });
        else return;

        const archive = await coldStore.addArchive(blob, {
            id: activeFile.id, name: activeFile.name, mimeType: blob.type || 'application/octet-stream',
            originalDriveId: activeFile.driveId, originalSlotId: activeFile.slotId
        });
        await neuralDB.offload(activeFile.id, { type: 'opfs', path: archive.path, archiveId: archive.id });
        await loadFiles();
        refreshColdArchives();
        setActiveFile(null);
    };

    const handleDelete = async () => {
        if (!activeFile) return;
        await neuralDB.deleteFile(activeFile.id);
        await loadFiles();
        refreshSlotCounts();
        setActiveFile(null);
        setViewSafeMode(false);
    };

    const handleRepair = async () => {
        if (!activeFile) return;
        await neuralDB.updateStatus(activeFile.id, 'safe');
        const updated = { ...activeFile, status: 'safe' as CorruptionStatus };
        await loadFiles();
        setActiveFile(updated);
        setViewSafeMode(false);
    };

    const processUpload = async (fileList: FileList) => {
        if (!activeSlotId) return;
        for (const file of Array.from(fileList)) {
            let relPath = file.webkitRelativePath || "";
            if (relPath) {
                const parts = relPath.split('/');
                parts.pop();
                relPath = parts.join('/') + '/';
                if (relPath === "/") relPath = "";
            }
            const nf: NeuralFile = {
                id: `${activeDriveId}-${activeSlotId}-${Date.now()}-${Math.random()}`,
                driveId: activeDriveId, slotId: activeSlotId,
                name: file.name, path: relPath,
                extension: file.name.split('.').pop() || 'dat',
                sizeBytes: file.size, content: file, category: 'data', status: 'safe',
                lastModified: file.lastModified, signature: `SIG_${Math.random()}`, annotations: []
            };
            if (file.type.startsWith('image/')) nf.category = 'media';
            if (file.type.startsWith('audio/') || file.type.startsWith('video/')) nf.category = 'media';
            if (file.name.endsWith('.js') || file.name.endsWith('.ts') || file.name.endsWith('.json')) nf.category = 'code';
            await neuralDB.addFile(nf);
        }
        await loadFiles();
        refreshSlotCounts();
    };

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files) return;
        await processUpload(e.target.files);
    };

    const handleDriveDrop = async (e: React.DragEvent, targetDriveId: DriveId) => {
        e.preventDefault();
        setDragOverDrive(null);
        const fileId = e.dataTransfer.getData("agent-lee-file-id");
        if (fileId) {
            const sourceFile = files.find(f => f.id === fileId);
            if (!sourceFile || sourceFile.driveId === targetDriveId) return;
            const targetSlot = Math.floor(Math.random() * 8) + 1;
            const newFile: NeuralFile = {
                ...sourceFile,
                id: `${targetDriveId}-${targetSlot}-${Date.now()}-${Math.random()}`,
                driveId: targetDriveId, slotId: targetSlot, lastModified: Date.now(),
            };
            await neuralDB.addFile(newFile);
            await loadFiles();
        }
    };

    const handleSlotDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        if (!activeSlotId) return;
        const items = e.dataTransfer.items;
        if (items) {
            const scanFiles = async (item: any, path = "") => {
                if (item.isFile) {
                    const file = await new Promise<File>(res => item.file(res));
                    Object.defineProperty(file, 'webkitRelativePath', { value: path + file.name });
                    await processUpload([file] as unknown as FileList);
                } else if (item.isDirectory) {
                    const reader = item.createReader();
                    const readEntries = async () => {
                        const entries = await new Promise<any[]>((res) => reader.readEntries(res));
                        if (entries.length > 0) {
                            for (const entry of entries) await scanFiles(entry, path + item.name + "/");
                            await readEntries();
                        }
                    };
                    await readEntries();
                }
            };
            for (let i = 0; i < items.length; i++) {
                const item = items[i].webkitGetAsEntry ? items[i].webkitGetAsEntry() : null;
                if (item) await scanFiles(item);
            }
        } else if (e.dataTransfer.files) {
            await processUpload(e.dataTransfer.files);
        }
    };

    const openFile = (file: NeuralFile) => {
        if (selectionMode) return;
        setActiveFile(file);
        setViewSafeMode(false);
    };

    const openColdArchive = async (archive: ColdArchiveEntry) => {
        const blob = await coldStore.getArchiveBlob(archive.id);
        if (blob) {
            setActiveFile({
                id: archive.id, driveId: (archive.originalDriveId || 'LEE') as DriveId, slotId: archive.originalSlotId || 1,
                name: archive.name, path: "", extension: archive.name.split('.').pop() || 'dat',
                sizeBytes: archive.sizeBytes, content: blob, category: 'archive', status: 'offloaded',
                lastModified: archive.createdAt, signature: "COLD_READ", annotations: [],
                externalRef: { type: 'opfs', path: archive.path, archiveId: archive.id }
            });
        }
    };

    const deleteColdArchive = async (id: string) => {
        await coldStore.removeArchive(id);
        refreshColdArchives();
    };

    const layoutNodes = useMemo(() => {
        if (!containerRef.current) return [];
        const nodes: LayoutNode[] = [];
        const rect = containerRef.current.getBoundingClientRect();
        const add = (id: string, type: "drive" | "slot" | "file", color: string, related?: DriveId[], status?: CorruptionStatus) => {
            const el = nodeRefs.current.get(id);
            if (el) {
                const r = el.getBoundingClientRect();
                nodes.push({ id, type, color, x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height, relatedDrives: related, status });
            }
        };
        (Object.keys(DRIVE_COLORS) as unknown as DriveId[]).forEach(d => add(`drive_${d}`, 'drive', DRIVE_COLORS[d]));
        for (let i = 1; i <= 8; i++) add(`slot_${activeDriveId}-${i}`, 'slot', DRIVE_COLORS[activeDriveId]);
        files.forEach(f => add(`file_${f.id}`, 'file', DRIVE_COLORS[activeDriveId], fileRelations[f.id], f.status));
        return nodes;
    }, [dim, tick, files, activeDriveId, activeSlotId, fileRelations]);

    const setRef = (id: string) => (el: HTMLDivElement | null) => { if (el) nodeRefs.current.set(id, el); else nodeRefs.current.delete(id); };

    useImperativeHandle(ref, () => ({ speak: console.log, focusDrive: setActiveDriveId }));

    // --- RENDER MODAL ---
    const renderModalContent = () => {
        if (!activeFile) return null;
        if (activeFile.status === 'corrupt') {
            return (
                <div className="w-full max-w-lg bg-black border-2 border-red-600 rounded-xl shadow-[0_0_50px_rgba(220,38,38,0.4)] overflow-hidden animate-[fade-in_0.1s_ease-out] relative z-[60]">
                    <div className="absolute inset-0 bg-red-900/10 pointer-events-none" />
                    <div className="p-6 border-b border-red-900 bg-red-950/30 flex justify-between items-center relative z-10">
                        <h3 className="text-xl font-black text-red-500 tracking-widest flex items-center gap-2"> <span className="animate-pulse">⚠</span> CORRUPTION DETECTED </h3>
                    </div>
                    <div className="p-8 flex flex-col items-center text-center relative z-10">
                        <button onClick={handleRepair} className="py-3 bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold rounded tracking-wider shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all">MAKE SAFE (RESTORE)</button>
                        <button onClick={handleDelete} className="mt-2 py-3 bg-red-900 hover:bg-red-800 text-white text-xs font-bold rounded tracking-wider transition-colors">DELETE FRAGMENT</button>
                    </div>
                    <div className="p-3 bg-red-950/50 border-t border-red-900 flex justify-end">
                        <button onClick={() => setActiveFile(null)} className="text-[10px] text-red-400 hover:text-white uppercase">Cancel</button>
                    </div>
                </div>
            );
        }
        return (
            <div className="w-full max-w-lg bg-slate-950 border border-slate-800 rounded-xl shadow-2xl overflow-hidden animate-[fade-in_0.2s_ease-out] z-[60]">
                <div className="p-6 border-b border-slate-900 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DRIVE_COLORS[activeDriveId] }} />
                        <h3 className="text-lg font-bold text-white truncate max-w-[200px]">{activeFile.name}</h3>
                    </div>
                </div>
                <div className="p-8 flex flex-col items-center justify-center min-h-[150px] bg-slate-900/30">
                    <MediaPreview file={activeFile} />
                    <p className="text-xs text-slate-400 font-mono mb-6">{(activeFile.sizeBytes / 1024).toFixed(2)} KB • {activeFile.category.toUpperCase()}</p>
                    <div className="grid grid-cols-2 gap-3 w-full max-w-xs">
                        <button onClick={() => handleExport('file', activeFile)} className="py-3 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded">DOWNLOAD</button>
                        <button onClick={handleOffload} className="py-3 bg-indigo-900/30 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/20 text-xs font-bold rounded">OFFLOAD (LINK)</button>
                    </div>
                </div>
                <div className="p-4 bg-slate-900/80 border-t border-slate-900 flex justify-between">
                    <button onClick={handleDelete} className="text-[10px] text-red-500 hover:text-red-400 font-bold tracking-widest">DELETE NODE</button>
                    <button onClick={() => setActiveFile(null)} className="text-[10px] text-slate-500 hover:text-slate-300">CLOSE</button>
                </div>
            </div>
        );
    };

    return (
        <div ref={containerRef} className="relative w-full h-full bg-black/50 overflow-hidden flex flex-col text-slate-200 select-none font-sans" onDragOver={(e) => e.preventDefault()} onDrop={handleSlotDrop}>
            <input type="file" ref={fileInputRef} multiple className="hidden" onChange={handleUpload} />
            <input type="file" ref={folderInputRef} multiple className="hidden" onChange={handleUpload} {...{ webkitdirectory: "", directory: "" } as any} />
            <ConnectionLayer nodes={layoutNodes} w={dim.w} h={dim.h} activeDrive={activeDriveId} activeSlot={activeSlotId} />
            <div className="z-30 min-h-16 py-2 flex flex-col md:flex-row items-center justify-between px-2 bg-gradient-to-b from-black/50 to-transparent gap-2 md:gap-0">
                <div className="w-full flex items-center justify-between md:justify-center gap-1 overflow-x-auto no-scrollbar pb-2">
                    {(Object.keys(DRIVE_COLORS) as unknown as DriveId[]).map(d => (
                        <div key={d} ref={setRef(`drive_${d}`)} onClick={() => { setActiveDriveId(d); setActiveSlotId(null); setActiveFile(null); }} onDragOver={(e) => { e.preventDefault(); setDragOverDrive(d); }} onDragLeave={() => setDragOverDrive(null)} onDrop={(e) => handleDriveDrop(e, d)}
                            className={`w-9 h-9 flex items-center justify-center rounded-lg border cursor-pointer transition-all hover:scale-110 backdrop-blur-md shrink-0 ${activeDriveId === d ? 'border-white bg-white/10 shadow-[0_0_20px_rgba(255,255,255,0.15)]' : 'border-slate-800 bg-black/40 opacity-60 hover:opacity-100'} ${dragOverDrive === d ? 'scale-125 border-white shadow-[0_0_30px_rgba(255,255,255,0.5)] z-50 ring-2 ring-white/50' : ''}`} style={{ color: DRIVE_COLORS[d], borderColor: (activeDriveId === d || dragOverDrive === d) ? DRIVE_COLORS[d] : undefined }}><span className="font-black text-[10px] md:text-xs">{d}</span></div>
                    ))}
                </div>
            </div>
            <div className="flex-1 flex min-h-0 relative z-20">
                <div className="w-16 py-2 flex flex-col items-center overflow-y-auto no-scrollbar">
                    {Array.from({ length: 8 }, (_, i) => i + 1).map(id => (
                        <div key={id} ref={setRef(`slot_${activeDriveId}-${id}`)} onClick={() => { setActiveSlotId(id); setActiveFile(null); }} className={`relative w-12 h-10 mb-2 cursor-pointer transition-all duration-300 group ${id % 2 === 0 ? 'translate-x-1' : '-translate-x-1'}`}>
                            <div className={`absolute inset-0 skew-x-[-12deg] border-l-4 flex items-center justify-center backdrop-blur-sm transition-all ${activeSlotId === id ? 'bg-white/5 border-l-current shadow-[0_0_20px_rgba(0,0,0,0.5)]' : 'bg-slate-900/40 border-l-slate-700 hover:bg-slate-800/60'}`} style={{ color: activeSlotId === id ? DRIVE_COLORS[activeDriveId] : '#64748b', borderColor: activeSlotId === id ? DRIVE_COLORS[activeDriveId] : undefined }}>
                                <span className="text-xs font-black italic">{id}</span>
                            </div>
                        </div>
                    ))}
                </div>
                <div className="flex-1 m-2 p-2 bg-gradient-to-br from-slate-900/10 to-transparent rounded-tl-3xl border-t border-l border-white/5 backdrop-blur-sm flex flex-col relative overflow-hidden">
                    {activeSlotId ? (
                        <>
                            <div className="flex justify-between items-center border-b border-white/5 pb-2 mb-2">
                                <h2 className="text-lg font-black tracking-tighter" style={{ color: DRIVE_COLORS[activeDriveId] }}>SECTOR 0{activeSlotId}</h2>
                                <div className="flex gap-1">
                                    <button onClick={() => setSelectionMode(!selectionMode)} className={`px-2 py-1 border rounded-full text-[9px] font-bold ${selectionMode ? 'bg-cyan-900/40 border-cyan-400 text-cyan-400' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}>{selectionMode ? "DONE" : "SELECT"}</button>
                                </div>
                            </div>
                            <div className="flex-1 overflow-y-auto pr-1 grid grid-cols-2 gap-2 content-start pb-20">
                                {files.map(f => <FileCard key={f.id} file={f} activeDriveId={activeDriveId} fileRelations={fileRelations} onOpen={openFile} onRename={handleRename} setRef={setRef} isSelected={selectedIds.has(f.id)} selectionMode={selectionMode} toggleSelection={toggleSelection} />)}
                            </div>
                        </>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none">
                            <p className="font-mono tracking-[0.2em] text-slate-500 text-xs text-center">SELECT SECTOR</p>
                        </div>
                    )}
                </div>
            </div>
            {activeFile && <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 cursor-default" onClick={(e) => e.target === e.currentTarget && setActiveFile(null)}>{renderModalContent()}</div>}
            <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .animate-flow { animation: dash 2s linear infinite; }
        .animate-flow-fast { animation: dash 1s linear infinite; }
        .animate-reverse-flow { animation: dash-rev 3s linear infinite; }
        @keyframes dash { to { stroke-dashoffset: -100; } }
        @keyframes dash-rev { to { stroke-dashoffset: 100; } }
        @keyframes fade-in { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
       `}</style>
        </div>
    );
});

export default MemoryLakeCore;
