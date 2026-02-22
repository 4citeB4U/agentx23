import { Box, ChevronDown, ChevronRight, FileCode, FileText, Folder, Loader2, Menu, Play, RefreshCw, Save, Settings, Sparkles, X } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

// ==========================================
// 1. CYBER SNAKE (Fully Playable)
// ==========================================

const CyberSnake = () => {
    const [snake, setSnake] = useState([[5, 5], [4, 5], [3, 5]]);
    const [food, setFood] = useState([10, 10]);
    const [dir, setDir] = useState([1, 0]);
    const [score, setScore] = useState(0);
    const [status, setStatus] = useState<'IDLE' | 'PLAYING' | 'GAMEOVER'>('IDLE');
    const [highScore, setHighScore] = useState(0);
    const boardSize = 20;
    const speed = useRef(150);

    // Inputs
    useEffect(() => {
        const handleKey = (e: KeyboardEvent) => {
            if (status !== 'PLAYING') return;
            switch (e.key) {
                case 'ArrowUp': if (dir[1] === 0) setDir([0, -1]); break;
                case 'ArrowDown': if (dir[1] === 0) setDir([0, 1]); break;
                case 'ArrowLeft': if (dir[0] === 0) setDir([-1, 0]); break;
                case 'ArrowRight': if (dir[0] === 0) setDir([1, 0]); break;
            }
        };
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [dir, status]);

    // Game Loop
    useEffect(() => {
        if (status !== 'PLAYING') return;
        const move = setInterval(() => {
            setSnake(prev => {
                const head = [prev[0][0] + dir[0], prev[0][1] + dir[1]];
                // Collision Wall
                if (head[0] < 0 || head[0] >= boardSize || head[1] < 0 || head[1] >= boardSize) {
                    setStatus('GAMEOVER');
                    return prev;
                }
                // Collision Self
                if (prev.some(s => s[0] === head[0] && s[1] === head[1])) {
                    setStatus('GAMEOVER');
                    return prev;
                }
                // Eat Food
                if (head[0] === food[0] && head[1] === food[1]) {
                    setScore(s => s + 100);
                    setFood([Math.floor(Math.random() * boardSize), Math.floor(Math.random() * boardSize)]);
                    // Increase speed slightly
                    speed.current = Math.max(50, speed.current - 2);
                    return [head, ...prev];
                }
                return [head, ...prev.slice(0, -1)];
            });
        }, speed.current);
        return () => clearInterval(move);
    }, [dir, status, food]);

    useEffect(() => {
        if (status === 'GAMEOVER') {
            if (score > highScore) setHighScore(score);
            speed.current = 150;
        }
    }, [status]);

    const startGame = () => {
        setSnake([[5, 5], [4, 5], [3, 5]]);
        setDir([1, 0]);
        setScore(0);
        setFood([Math.floor(Math.random() * boardSize), Math.floor(Math.random() * boardSize)]);
        setStatus('PLAYING');
        speed.current = 150;
    };

    return (
        <div className="w-full h-full bg-[#050505] flex flex-col items-center justify-center relative select-none">
            {/* HUD */}
            <div className="absolute top-4 w-full px-8 flex justify-between items-center z-10">
                <div>
                    <h3 className="text-cyan-500 font-black italic text-xl tracking-tighter">CYBER SNAKE</h3>
                    <p className="text-[10px] text-gray-500 font-mono">NEURAL ENGINE V2</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl text-white font-mono font-bold">{score.toString().padStart(6, '0')}</div>
                    <div className="text-[10px] text-green-500">HIGH: {highScore}</div>
                </div>
            </div>

            {/* Game Board */}
            <div
                className="relative w-[320px] h-80 grid grid-cols-20 grid-rows-20 bg-gray-900/50 border-2 border-gray-800 rounded-xl overflow-hidden shadow-[0_0_50px_rgba(0,0,0,0.5)]"
            >
                {/* Overlay Screen */}
                {status !== 'PLAYING' && (
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-sm z-20 flex flex-col items-center justify-center">
                        {status === 'GAMEOVER' && <div className="text-red-500 font-black text-3xl mb-2 animate-pulse">GAME OVER</div>}
                        <button
                            onClick={startGame}
                            className="px-6 py-3 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-full shadow-[0_0_20px_rgba(8,145,178,0.5)] transition-all transform hover:scale-105"
                        >
                            {status === 'IDLE' ? 'START MISSION' : 'RETRY'}
                        </button>
                    </div>
                )}

                {/* Grid Cells */}
                {Array.from({ length: boardSize * boardSize }).map((_, i) => {
                    const x = i % boardSize;
                    const y = Math.floor(i / boardSize);
                    const isHead = snake[0][0] === x && snake[0][1] === y;
                    const isBody = snake.some((s, idx) => idx !== 0 && s[0] === x && s[1] === y);
                    const isFood = food[0] === x && food[1] === y;

                    let bg = '';
                    if (isHead) bg = 'bg-cyan-400 shadow-[0_0_15px_#22d3ee] z-10 scale-110 rounded-sm';
                    else if (isBody) bg = 'bg-cyan-900/80 border border-cyan-500/30 rounded-sm';
                    else if (isFood) bg = 'bg-red-500 shadow-[0_0_15px_#ef4444] animate-pulse rounded-full scale-75';

                    return <div key={i} className={`w-full h-full transition-all duration-100 ${bg}`} />;
                })}
            </div>

            {/* Mobile Controls */}
            <div className="mt-8 grid grid-cols-3 gap-2">
                <div />
                <button
                    type="button"
                    title="Move up"
                    aria-label="Move up"
                    className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center active:bg-cyan-900 transition-colors"
                    onClick={() => dir[1] === 0 && setDir([0, -1])}
                >
                    <span className="sr-only">Move up</span>
                    <div aria-hidden="true" className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-b-12 border-b-white" />
                </button>
                <div />
                <button
                    type="button"
                    title="Move left"
                    aria-label="Move left"
                    className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center active:bg-cyan-900 transition-colors"
                    onClick={() => dir[0] === 0 && setDir([-1, 0])}
                >
                    <span className="sr-only">Move left</span>
                    <div aria-hidden="true" className="w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-r-12 border-r-white" />
                </button>
                <button
                    type="button"
                    title="Move down"
                    aria-label="Move down"
                    className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center active:bg-cyan-900 transition-colors"
                    onClick={() => dir[1] === 0 && setDir([0, 1])}
                >
                    <span className="sr-only">Move down</span>
                    <div aria-hidden="true" className="w-0 h-0 border-l-8 border-l-transparent border-r-8 border-r-transparent border-t-12 border-t-white" />
                </button>
                <button
                    type="button"
                    title="Move right"
                    aria-label="Move right"
                    className="w-14 h-14 bg-gray-800 hover:bg-gray-700 rounded-xl flex items-center justify-center active:bg-cyan-900 transition-colors"
                    onClick={() => dir[0] === 0 && setDir([1, 0])}
                >
                    <span className="sr-only">Move right</span>
                    <div aria-hidden="true" className="w-0 h-0 border-t-8 border-t-transparent border-b-8 border-b-transparent border-l-12 border-l-white" />
                </button>
            </div>
        </div>
    );
};

// ==========================================
// 2. QUANTUM CHESS (Interactive Sandbox)
// ==========================================

const QuantumChess = () => {
    // Basic board representation. Upper case = White, Lower case = Black
    const initialBoard = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['', '', '', '', '', '', '', ''],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

    const [board, setBoard] = useState(initialBoard);
    const [selected, setSelected] = useState<[number, number] | null>(null);
    const [turn, setTurn] = useState<'White' | 'Black'>('White');
    const [captured, setCaptured] = useState<string[]>([]);

    const pieces: Record<string, string> = {
        'r': '♜', 'n': '♞', 'b': '♝', 'q': '♛', 'k': '♚', 'p': '♟',
        'R': '♖', 'N': '♘', 'B': '♗', 'Q': '♕', 'K': '♔', 'P': '♙'
    };

    const handleSquareClick = (r: number, c: number) => {
        // If selecting a piece
        if (!selected) {
            const piece = board[r][c];
            if (!piece) return;
            // Basic turn check (optional for sandbox feel, but good for structure)
            const isWhite = piece === piece.toUpperCase();
            if ((turn === 'White' && !isWhite) || (turn === 'Black' && isWhite)) return;

            setSelected([r, c]);
        } else {
            // Moving Logic
            const [prevR, prevC] = selected;
            if (prevR === r && prevC === c) {
                setSelected(null); // Deselect
                return;
            }

            const piece = board[prevR][prevC];
            const target = board[r][c];

            // Capture Logic
            if (target) {
                setCaptured(prev => [...prev, target]);
            }

            // Update Board
            const newBoard = board.map(row => [...row]);
            newBoard[r][c] = piece;
            newBoard[prevR][prevC] = '';

            setBoard(newBoard);
            setSelected(null);
            setTurn(prev => prev === 'White' ? 'Black' : 'White');
        }
    };

    return (
        <div className="w-full h-full bg-[#1a1a1a] flex flex-col items-center justify-center relative font-serif">
            <div className="mb-4 flex justify-between w-[320px] text-white">
                <div className={`px-3 py-1 rounded ${turn === 'White' ? 'bg-white text-black font-bold' : 'text-gray-500'}`}>White</div>
                <div className={`px-3 py-1 rounded ${turn === 'Black' ? 'bg-black border border-gray-600 font-bold' : 'text-gray-500'}`}>Black</div>
            </div>

            <div className="relative border-8 border-[#4a3b2a] rounded shadow-2xl">
                <div className="grid grid-cols-8 w-[320px] h-80">
                    {board.map((row, r) => (
                        row.map((cell, c) => {
                            const isBlackSquare = (r + c) % 2 === 1;
                            const isSelected = selected?.[0] === r && selected?.[1] === c;

                            return (
                                <div
                                    key={`${r}-${c}`}
                                    onClick={() => handleSquareClick(r, c)}
                                    className={`
                                        flex items-center justify-center text-3xl cursor-pointer transition-colors
                                        ${isBlackSquare ? 'bg-[#769656]' : 'bg-[#eeeed2]'}
                                        ${isSelected ? 'ring-inset ring-4 ring-yellow-400 bg-yellow-200' : ''}
                                        hover:opacity-90
                                    `}
                                >
                                    <span className={cell === cell.toUpperCase() ? 'text-white drop-shadow-[0_2px_2px_rgba(0,0,0,0.8)]' : 'text-black'}>
                                        {pieces[cell]}
                                    </span>
                                </div>
                            )
                        })
                    ))}
                </div>
            </div>

            <div className="mt-6 w-[320px] bg-gray-800/50 p-2 rounded min-h-10 flex flex-wrap gap-2 items-center">
                <span className="text-[10px] text-gray-400 mr-2 uppercase tracking-wider">Graveyard:</span>
                {captured.map((p, i) => (
                    <span key={i} className="text-lg text-gray-400">{pieces[p]}</span>
                ))}
                {captured.length === 0 && <span className="text-[10px] text-gray-600 italic">No casualties yet.</span>}
            </div>
        </div>
    );
};

// ==========================================
// 3. PARTICLE VORTEX (High Fidelity)
// ==========================================

const ParticleVortex = () => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const mouseRef = useRef({ x: 0, y: 0 });

    useEffect(() => {
        const cvs = canvasRef.current;
        if (!cvs) return;
        const ctx = cvs.getContext('2d');
        if (!ctx) return;

        let w = cvs.width = cvs.parentElement?.clientWidth || 300;
        let h = cvs.height = cvs.parentElement?.clientHeight || 300;

        const particles = Array.from({ length: 150 }).map(() => ({
            x: Math.random() * w,
            y: Math.random() * h,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            size: Math.random() * 2 + 1,
            color: `hsl(${Math.random() * 60 + 180}, 100%, 50%)` // Cyans and Blues
        }));

        const handleMove = (e: MouseEvent | TouchEvent) => {
            const rect = cvs.getBoundingClientRect();
            if ('touches' in e) {
                mouseRef.current = { x: (e as TouchEvent).touches[0].clientX - rect.left, y: (e as TouchEvent).touches[0].clientY - rect.top };
            } else {
                mouseRef.current = { x: (e as MouseEvent).clientX - rect.left, y: (e as MouseEvent).clientY - rect.top };
            }
        };
        cvs.addEventListener('mousemove', handleMove);
        cvs.addEventListener('touchmove', handleMove);

        let frame = 0;
        const loop = () => {
            frame = requestAnimationFrame(loop);
            // Trail effect
            ctx.fillStyle = 'rgba(5, 5, 10, 0.2)';
            ctx.fillRect(0, 0, w, h);

            particles.forEach(p => {
                // Physics
                p.x += p.vx;
                p.y += p.vy;

                // Wall bounce
                if (p.x < 0 || p.x > w) p.vx *= -1;
                if (p.y < 0 || p.y > h) p.vy *= -1;

                // Mouse interaction (Repulsion)
                const dx = p.x - mouseRef.current.x;
                const dy = p.y - mouseRef.current.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < 100) {
                    const angle = Math.atan2(dy, dx);
                    const force = (100 - dist) * 0.05;
                    p.vx += Math.cos(angle) * force;
                    p.vy += Math.sin(angle) * force;
                }

                // Drag (Friction)
                p.vx *= 0.99;
                p.vy *= 0.99;

                // Render
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fill();
            });

            // Connecting Lines
            ctx.strokeStyle = 'rgba(0, 240, 255, 0.05)';
            ctx.lineWidth = 0.5;
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const dx = particles[i].x - particles[j].x;
                    const dy = particles[i].y - particles[j].y;
                    const d = Math.sqrt(dx * dx + dy * dy);
                    if (d < 50) {
                        ctx.beginPath();
                        ctx.moveTo(particles[i].x, particles[i].y);
                        ctx.lineTo(particles[j].x, particles[j].y);
                        ctx.stroke();
                    }
                }
            }
        };
        loop();

        return () => {
            cancelAnimationFrame(frame);
            cvs.removeEventListener('mousemove', handleMove);
            cvs.removeEventListener('touchmove', handleMove);
        };
    }, []);

    return (
        <div className="w-full h-full bg-[#05050a] relative overflow-hidden">
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h3 className="text-cyan-400 font-bold text-lg">PARTICLE VORTEX</h3>
                <p className="text-[10px] text-blue-300/50">INTERACTIVE FLUID DYNAMICS</p>
            </div>
            <canvas ref={canvasRef} className="w-full h-full block cursor-crosshair touch-none" />
            <div className="absolute bottom-4 right-4 pointer-events-none text-[10px] text-gray-500">
                MOVE CURSOR TO INTERACT
            </div>
        </div>
    );
};

// --- FILE SYSTEM TYPES ---
type FsEntry = {
    name: string;
    relPath: string;
    type: 'file' | 'directory';
    sizeBytes: number;
    modifiedMs: number;
};

// --- HELPER COMPONENTS ---
const FileTreeItem = ({ entry, onSelect, activeFile, root = 'C', handshake }: { entry: FsEntry, onSelect: (path: string) => void, activeFile: string, root?: string, handshake?: string }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [children, setChildren] = useState<FsEntry[] | null>(null);
    const [loading, setLoading] = useState(false);

    const toggle = async () => {
        if (entry.type !== 'directory') {
            onSelect(entry.relPath);
            return;
        }
        setIsOpen(!isOpen);
        if (!children && !isOpen) {
            setLoading(true);
            try {
                const res = await fetch(`/api/fs/list?root=${encodeURIComponent(root)}&path=${entry.relPath}`, {
                    headers: { 'ngrok-skip-browser-warning': '1', ...(handshake ? { 'x-neural-handshake': handshake } : {}) }
                });
                if (res.ok) {
                    const data = await res.json();
                    setChildren(data.entries || []);
                }
            } catch { }
            setLoading(false);
        }
    };

    const isActive = activeFile === entry.relPath;

    return (
        <div>
            <div
                onClick={toggle}
                className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-white/5 transition-all text-[11px] group ${isActive ? 'bg-blue-600/10 text-blue-400' : 'text-gray-400'}`}
            >
                {entry.type === 'directory' ? (
                    <>
                        <div className="w-3 h-3 flex items-center justify-center">
                            {loading ? <Loader2 size={10} className="animate-spin" /> : (isOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />)}
                        </div>
                        <Folder size={14} className={`transition-colors ${isOpen ? 'text-yellow-400' : 'text-yellow-600/80'}`} />
                    </>
                ) : (
                    <>
                        <div className="w-3 h-3" />
                        <FileText size={14} className={`transition-colors group-hover:text-blue-400/60 ${isActive ? 'text-blue-400' : 'text-gray-600'}`} />
                    </>
                )}
                <span className="truncate flex-1">{entry.name}</span>
                {isActive && <div className="w-1 h-1 rounded-full bg-blue-500 shadow-[0_0_5px_#3b82f6]"></div>}
            </div>
            {isOpen && children && (
                <div className="ml-3 pl-1 border-l border-white/5">
                    {children.map(child => (
                        <FileTreeItem key={child.relPath} entry={child} onSelect={onSelect} activeFile={activeFile} root={root} handshake={handshake} />
                    ))}
                </div>
            )}
        </div>
    );
};

const Activity = ({ size, className }: { size: number, className: string }) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);

const DataDashboard = () => (
    <div className="w-full h-full p-8 bg-slate-900 overflow-y-auto custom-scrollbar">
        <h1 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
            <Activity size={24} className="text-blue-500" />
            Executive Overview
        </h1>

        <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t border-blue-500/50 hover:bg-slate-700 transition-colors cursor-pointer group">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Active Sessions</div>
                <div className="text-3xl font-black text-white group-hover:text-blue-400 transition-colors">12,402</div>
                <div className="text-[10px] text-green-400 mt-1 flex items-center gap-1">▲ 14% vs last hour</div>
            </div>
            <div className="bg-slate-800 p-4 rounded-xl shadow-lg border-t border-emerald-500/50 hover:bg-slate-700 transition-colors cursor-pointer group">
                <div className="text-xs text-slate-400 font-bold uppercase tracking-wider mb-2">Throughput</div>
                <div className="text-3xl font-black text-white group-hover:text-emerald-400 transition-colors">48.2 GB</div>
                <div className="text-[10px] text-emerald-400 mt-1">Stable Connection</div>
            </div>
        </div>

        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-sm font-bold text-gray-300">Live Traffic Analysis</h3>
                <div className="flex gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></span>
                    <span className="text-[10px] text-gray-500 uppercase">Real-time</span>
                </div>
            </div>

            <div className="h-32 flex items-end justify-between gap-1">
                {(['h-[34%]', 'h-[62%]', 'h-[48%]', 'h-[77%]', 'h-[59%]', 'h-[72%]', 'h-[45%]', 'h-[88%]', 'h-[66%]', 'h-[53%]', 'h-[81%]', 'h-[57%]', 'h-[69%]', 'h-[43%]', 'h-[75%]', 'h-[50%]', 'h-[84%]', 'h-[61%]', 'h-[70%]', 'h-[55%]']).map((barHeightClass, i) => (
                    <div
                        key={i}
                        className={`w-full ${barHeightClass} bg-blue-500/20 hover:bg-blue-500/60 transition-all rounded-t-sm relative group`}
                    >
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black text-white text-[9px] px-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity">
                            {Math.floor(Math.random() * 1000)}
                        </div>
                    </div>
                ))}
            </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-4">
            <button className="p-3 bg-slate-800 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700">EXPORT CSV</button>
            <button className="p-3 bg-slate-800 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white hover:bg-slate-700 transition-colors border border-slate-700">ANALYTICS</button>
            <button className="p-3 bg-blue-600 rounded-lg text-[10px] font-bold text-white hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20">REFRESH</button>
        </div>
    </div>
);

// --- APP REGISTRY ---

const APP_TEMPLATES: Record<string, { code: string, component: React.FC }> = {
    'snake_v1.tsx': {
        code: `import React, { useState, useEffect } from 'react';

// AGENT LEE: CYBER SNAKE MODULE
// Optimized for React 18 Concurrent Mode

export default function CyberSnake() {
  // Core State Logic
  const [snake, setSnake] = useState([[5,5], [4,5], [3,5]]);
  const [score, setScore] = useState(0);
  
  // High-Performance Game Loop
  // Collision Detection Algorithms
  // Rendering Engine (Grid-Based)
  
  return (
    <div className="cyber-container">
       {/* Game Canvas */}
    </div>
  );
}`,
        component: CyberSnake
    },
    'chess_engine.tsx': {
        code: `import React, { useState } from 'react';

// AGENT LEE: QUANTUM CHESS ENGINE
// Sandbox Mode Enabled

export const ChessBoard = () => {
   const [board, setBoard] = useState(initialFenString);
   const [turn, setTurn] = useState('white');

   // Move Validation Logic
   // Piece Rendering (Unicode High-Res)
   // Capture Mechanics

   return <Board layout={board} />;
}`,
        component: QuantumChess
    },
    'particles_gen.tsx': {
        code: `import React, { useRef, useEffect } from 'react';

// PARTICLE VORTEX PHYSICS
// 150 Entities / 60 FPS / HTML5 Canvas

export const Particles = () => {
   const canvasRef = useRef(null);

   useEffect(() => {
      // Fluid Dynamics Loop
      // Mouse/Touch Interaction Listeners
      // Color Cycling Shaders
   }, []);

   return <canvas />;
}`,
        component: ParticleVortex
    },
    'dashboard_layout.tsx': {
        code: `import React from 'react';

// EXECUTIVE DATA DASHBOARD
// Real-time WebSocket Simulation

export const Dashboard = () => {
  return (
    <div className="p-8 bg-slate-900">
       <h1>Analytics Overview</h1>
       {/* Dynamic Chart Components */}
       {/* Live Data Feed */}
    </div>
  );
}`,
        component: DataDashboard
    }
};

// --- MAIN COMPONENT ---

interface CodeStudioProps {
    simulationRequest?: { id: string; filename: string };
    buildPlan?: { steps: string[]; taskName: string } | null;
    onBuildComplete?: () => void;
}

export const CodeStudio: React.FC<CodeStudioProps> = ({ simulationRequest, buildPlan, onBuildComplete }) => {
    const [activeFile, setActiveFile] = useState('App.tsx');
    const [codeContent, setCodeContent] = useState<string>('');
    const [viewMode, setViewMode] = useState<'CODE' | 'PREVIEW'>('CODE');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationProgress, setGenerationProgress] = useState(0);
    const [buildProgress, setBuildProgress] = useState<{ current: number; status: string } | null>(null);
    const buildRunning = React.useRef(false);
    const [selectedDrive, setSelectedDrive] = useState<string>('C');
    const [availableDrives, setAvailableDrives] = useState<{ id: string; root: string; exists: boolean }[]>([]);

    const [drawerOpen, setDrawerOpen] = useState(false);
    const [explorerOpen, setExplorerOpen] = useState(true);
    const [templatesOpen, setTemplatesOpen] = useState(false);
    const [fileTree, setFileTree] = useState<FsEntry[] | null>(null);
    const [editorIdentity, setEditorIdentity] = useState<'VS_CODE' | 'ANTI_GRAVITY'>('VS_CODE');

    // ── Terminal panel
    const [terminalOpen, setTerminalOpen] = useState(false);
    const [termLines, setTermLines] = useState<string[]>(['[Agent Lee Terminal — connected to host shell]', '']);
    const [termInput, setTermInput] = useState('');
    const [termSessionId, setTermSessionId] = useState<string | null>(null);
    const termWsRef = useRef<WebSocket | null>(null);
    const termScrollRef = useRef<HTMLDivElement | null>(null);

    // ── File-open dialog
    const [fileDialog, setFileDialog] = useState<{path: string; name: string} | null>(null);
    const [fileViewMode, setFileViewMode] = useState<'editor' | 'view'>('editor');

    // ── Help modal
    const [helpTopic, setHelpTopic] = useState<string | null>(null);
    const [remoteText, setRemoteText] = useState('');
    const [vsCodeUrl, setVsCodeUrl] = useState<string>(() => {
        const env = (import.meta as any).env?.VITE_VSCODE_TUNNEL_URL as string | undefined;
        const saved = (() => {
            try { return localStorage.getItem('agentlee_vscode_tunnel_url'); } catch { return null; }
        })();
        return (saved || env || '').trim();
    });

    const [antiGravityUrl, setAntiGravityUrl] = useState<string>(() => {
        const env = (import.meta as any).env?.VITE_ANTIGRAVITY_REAL_URL as string | undefined;
        const saved = (() => {
            try { return localStorage.getItem('agentlee_antigravity_real_url'); } catch { return null; }
        })();
        return (saved || env || '').trim();
    });

    const handshake = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined;
    const accentBorder = editorIdentity === 'ANTI_GRAVITY' ? 'border-purple-500/60' : 'border-cyan-500/60';
    const accentText = editorIdentity === 'ANTI_GRAVITY' ? 'text-purple-300' : 'text-cyan-300';

    useEffect(() => {
        try {
            localStorage.setItem('agentlee_vscode_tunnel_url', vsCodeUrl.trim());
        } catch {
            // ignore
        }
    }, [vsCodeUrl]);

    useEffect(() => {
        try {
            localStorage.setItem('agentlee_antigravity_real_url', antiGravityUrl.trim());
        } catch {
            // ignore
        }
    }, [antiGravityUrl]);

    useEffect(() => {
        // Auto-load from runtime config written by bootstrap scripts (if present)
        const loadRuntime = async () => {
            try {
                const r = await fetch('/api/services/runtime', {
                    headers: {
                        ...(handshake ? { 'x-neural-handshake': handshake } : {}),
                        'ngrok-skip-browser-warning': '1'
                    }
                });
                if (!r.ok) return;
                const data = await r.json();
                const runtimeVs = String(data?.vscodeReal?.url || '').trim();
                const runtimeAg = String(data?.antiGravityReal?.url || '').trim();
                if (runtimeVs && !vsCodeUrl.trim()) setVsCodeUrl(runtimeVs);
                if (runtimeAg && !antiGravityUrl.trim()) setAntiGravityUrl(runtimeAg);
            } catch {
                // ignore
            }
        };
        loadRuntime();
        // run once
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const openRealVSCode = () => {
        const url = (vsCodeUrl || '').trim();
        if (!url) return;
        try {
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            // ignore
        }
    };

    const openRealAntiGravity = () => {
        const url = (antiGravityUrl || '').trim();
        if (!url) return;
        try {
            window.open(url, '_blank', 'noopener,noreferrer');
        } catch {
            // ignore
        }
    };

    // Initial Default
    const DEFAULT_CODE = `import React from 'react';

export const SampleCard = () => {
    return (
        <div className="card">
             <h1>Hello</h1>
             <p>Status: Ready</p>
        </div>
    );
};`;

    // --- GENERATION EFFECT ---
    useEffect(() => {
        if (simulationRequest && APP_TEMPLATES[simulationRequest.filename]) {
            const target = APP_TEMPLATES[simulationRequest.filename];
            setActiveFile(simulationRequest.filename);
            setCodeContent('');
            setIsGenerating(true);
            setViewMode('CODE');
            setGenerationProgress(0);

            let i = 0;
            const fullText = target.code;
            const interval = window.setInterval(() => {
                i += Math.floor(Math.random() * 5) + 1; // Type chunks
                if (i >= fullText.length) {
                    setCodeContent(fullText);
                    setIsGenerating(false);
                    setGenerationProgress(100);
                    window.clearInterval(interval);
                    handleSave();
                } else {
                    setCodeContent(fullText.slice(0, i));
                    setGenerationProgress((i / fullText.length) * 100);
                }
            }, 30); // Typing speed

            return () => window.clearInterval(interval);
        } else {
            setCodeContent(DEFAULT_CODE);
        }
    }, [simulationRequest]);

    const refreshExplorer = async (drive?: string) => {
        const root = drive || selectedDrive;
        try {
            const res = await fetch(`/api/fs/list?root=${encodeURIComponent(root)}&path=.`, {
                headers: { 'ngrok-skip-browser-warning': '1', ...(handshake ? { 'x-neural-handshake': handshake } : {}) }
            });
            if (res.ok) {
                const data = await res.json();
                setFileTree(data.entries || []);
            }
        } catch { }
    };

    useEffect(() => {
        // Fetch available drives/aliases from backend
        fetch('/api/fs/drives', { headers: { 'ngrok-skip-browser-warning': '1', ...(handshake ? { 'x-neural-handshake': handshake } : {}) } })
            .then(r => r.ok ? r.json() : null)
            .then(data => {
                if (data?.aliases) {
                    const alive = (data.aliases as { id: string; root: string; exists: boolean; blocked?: boolean }[]).filter(a => a.exists && !a.blocked);
                    setAvailableDrives(alive);
                    // Default to C if exists, otherwise first available
                    const firstId = alive.find(a => a.id === 'C')?.id || alive[0]?.id || 'LEE';
                    setSelectedDrive(firstId);
                    refreshExplorer(firstId);
                } else {
                    refreshExplorer();
                }
            })
            .catch(() => refreshExplorer());
    }, []);

    const handleSave = async () => {
        setIsGenerating(true);
        setGenerationProgress(10);
        try {
            // If path contains projects/, it's a template; otherwise it's a path from explorer
            const savePath = activeFile.includes('/') ? activeFile : `projects/${activeFile}`;
            const res = await fetch('/api/fs/write', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(handshake ? { 'x-neural-handshake': handshake } : {}),
                    'ngrok-skip-browser-warning': '1'
                },
                body: JSON.stringify({
                    root: 'LEE',
                    path: savePath,
                    content: codeContent
                })
            });
            if (res.ok) {
                setGenerationProgress(100);
                setTimeout(() => setIsGenerating(false), 1000);
                console.log("File saved to filesystem:", savePath);
            } else {
                const err = await res.json();
                alert(`Save failed: ${err.error || 'Unknown error'}`);
                setIsGenerating(false);
            }
        } catch (e) {
            alert(`Error connecting to backend: ${String(e)}`);
            setIsGenerating(false);
        }
    };

    const loadFromFile = async (path: string, drive?: string) => {
        try {
            const root = drive || selectedDrive;
            const res = await fetch(`/api/fs/read?root=${encodeURIComponent(root)}&path=${encodeURIComponent(path)}`, {
                headers: {
                    'ngrok-skip-browser-warning': '1',
                    ...(handshake ? { 'x-neural-handshake': handshake } : {})
                }
            });
            if (res.ok) {
                const text = await res.text();
                setCodeContent(text);
                setFileViewMode('editor');
            } else {
                // Silently show empty file if not found; don’t wipe existing content
                console.warn(`[fs] read ${root}:${path} → ${res.status}`);
            }
        } catch (e) {
            console.warn('[fs] loadFromFile error:', e);
        }
    };

    useEffect(() => {
        if (!isGenerating && activeFile && !APP_TEMPLATES[activeFile]) {
            loadFromFile(activeFile);
        }
    }, [activeFile]);

    const sendRemoteAction = async (body: Record<string, unknown>) => {
        try {
            await fetch('/api/device/act', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(handshake ? { 'x-neural-handshake': handshake } : {}),
                    'ngrok-skip-browser-warning': '1'
                },
                body: JSON.stringify(body)
            });
        } catch {
            // non-blocking
        }
    };

    const hotkey = async (...keys: string[]) => sendRemoteAction({ action: 'hotkey', keys });
    const sendTypedText = async () => {
        const value = remoteText.trim();
        if (!value) return;
        await sendRemoteAction({ action: 'type', text: value });
        setRemoteText('');
    };

    const loadTemplate = (filename: string) => {
        const template = APP_TEMPLATES[filename];
        if (!template) return;
        setActiveFile(filename);
        // We set content immediately, but the useEffect above will also try to load from disk
        // If disk has it, it will overwrite the template with real user data.
        setCodeContent(template.code);
        setViewMode('CODE');
        setIsGenerating(false);
        setGenerationProgress(0);
    };

    // --- MENU BAR EVENT BUS (driven by UIModules MenuBar dropdowns) ---
    useEffect(() => {
        const on = (name: string, fn: (e: Event) => void) => {
            window.addEventListener(`agentlee:${name}`, fn);
            return () => window.removeEventListener(`agentlee:${name}`, fn);
        };

        const callMcp = async (tool: string, args: Record<string, unknown> = {}) => {
            try {
                await fetch('/api/mcp/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(handshake ? { 'x-neural-handshake': handshake } : {}) },
                    body: JSON.stringify({ tool, args })
                });
            } catch { /* non-blocking */ }
        };

        const openTerminal = async () => {
            if (termWsRef.current) { setTerminalOpen(true); return; }
            try {
                const r = await fetch('/api/terminal/session', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', ...(handshake ? { 'x-neural-handshake': handshake } : {}) },
                    body: JSON.stringify({ mode: 'safe', cols: 120, rows: 30 })
                });
                if (!r.ok) { setTermLines(prev => [...prev, '[Error: could not create terminal session]']); setTerminalOpen(true); return; }
                const { sessionId } = await r.json();
                setTermSessionId(sessionId);
                const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const hs = handshake || '';
                const ws = new WebSocket(`${proto}//${window.location.host}/api/terminal/ws?sessionId=${sessionId}&handshake=${encodeURIComponent(hs)}`);
                ws.onmessage = (e) => {
                    try {
                        const msg = JSON.parse(e.data);
                        if (msg.type === 'output') {
                            // Strip common ANSI escape sequences for readability
                            const clean = msg.data.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');
                            setTermLines(prev => {
                                const lines = [...prev, ...clean.split('\n')];
                                return lines.slice(-800);
                            });
                            setTimeout(() => termScrollRef.current?.scrollTo(0, termScrollRef.current.scrollHeight), 20);
                        } else if (msg.type === 'policy_block') {
                            setTermLines(prev => [...prev, `[BLOCKED] ${msg.reason}`]);
                        }
                    } catch { /* non-json ignore */ }
                };
                ws.onerror = () => setTermLines(prev => [...prev, '[Terminal connection error]']);
                ws.onclose = () => setTermLines(prev => [...prev, '[Terminal disconnected]']);
                termWsRef.current = ws;
            } catch (e) {
                setTermLines(prev => [...prev, `[Terminal init failed: ${String(e)}]`]);
            }
            setTerminalOpen(true);
        };

        const closeTerminal = () => {
            termWsRef.current?.close();
            termWsRef.current = null;
            setTermSessionId(null);
            setTerminalOpen(false);
        };

        const HELP_CONTENT: Record<string, { title: string; body: string }> = {
            helpAbout: { title: 'About Agent Lee OS', body: `Agent Lee OS v1.0 — Built by Leeway Innovations\n\nYou are: The Creator / Sovereign\nAgent Lee is: Your personal AI sovereign, operating across UI, Telegram, and your local desktop.\n\nArchitecture:\n  • Backend API — Node.js port 8001\n  • Neural Router — Python FastAPI port 8004\n  • PocketTTS Voice — port 8007 (marius voice, locked)\n  • WebSocket Neural Bridge — port 8003\n  • Live View — remote desktop screenshot stream` },
            helpHome: { title: 'Home — Dashboard', body: `The HOME tab is your mission control.\n\nWhat you can do:\n  • See Agent Lee's VoxelCore avatar (3D morphing shapes)\n  • Send commands via the bottom Command Input\n  • Hear Agent Lee respond in voice\n  • View Telegram messages in the Messages tab\n  • Switch between tabs: Home, Code, Live View, Messages, Settings\n\nThe VoxelCore morphs into shapes as you interact.\nShapes: sphere, house, tree, dna, heart, star` },
            helpCode: { title: 'Code Studio', body: `CODE STUDIO — Full editing environment\n\nLeft panel: File Explorer\n  • Browse all drives (C:, D:, etc.)\n  • Click a file to open it in the editor\n  • Choose: Work on it (editable) or View only (read-only)\n  • All file types supported: code, images, video, audio, PDF\n\nEditor area: Write and edit code\nBottom: Terminal panel (CTRL+\` or Terminal menu)\nToolbar:\n  • EDITOR / PREVIEW toggle\n  • Save button\n  • Settings gear\n\nKeyboard shortcuts:\n  Ctrl+S — Save\n  Ctrl+Z / Ctrl+Y — Undo / Redo\n  Ctrl+\` — Open terminal\n\nTerminal:\n  • Real host shell (PowerShell)\n  • Type commands, press Enter to run\n  • Policy-gated for safety` },
            helpLive: { title: 'Live View — Remote Desktop', body: `LIVE VIEW — See and control your desktop\n\nUsage:\n  • The screen shows your desktop in real time\n  • Touch / click to interact directly with your desktop\n  • Pinch to zoom in/out on mobile\n  • Double-tap to double-click\n  • SCREEN 1 / SCREEN 2 / BOTH — multi-monitor support\n\nControls (bottom bar):\n  • AA CLICK — click at the last cursor position\n  • TRACKPAD mode — drag to move cursor, then tap to click\n  • Text input — type and press Enter to send keystrokes\n\nRequires the Desktop Agent (port 8005) to be running.` },
            helpMessages: { title: 'Messages — Telegram & Unified Inbox', body: `MESSAGES TAB — Agent Lee's unified inbox\n\nWhat you'll see:\n  • All Telegram messages forwarded here in real time\n  • Agent Lee's responses\n  • System notifications\n\nHow it works:\n  • Telegram → Backend polls every 3.5 seconds\n  • Messages flow into the WebSocket bridge\n  • UI receives and displays instantly\n  • Agent Lee auto-responds via voice + text\n\nYou can reply from any channel — UI or Telegram — and Agent Lee keeps one unified consciousness.` },
            helpSettings: { title: 'Settings & Voice Profile', body: `SETTINGS — Customize Agent Lee OS\n\nVoice:\n  • Current locked voice: marius (PocketTTS)\n  • Profile: motivational_architect\n  • Pitch ratio: 0.88 (deep baritone)\n  • To change: tell Agent Lee "change voice" and audition profiles\n\nEditor themes:\n  • VS CODE — classic blue\n  • ANTI-GRAVITY — quantum purple\n\nTerminal:\n  • Shell: PowerShell (pwsh)\n  • Policy modes: safe, build, admin\n\nTunnel:\n  • VS Code tunnel URL for real binary access\n  • Cloudflare tunnel: agentlee.rapidwebdevelop.com` },
            helpShortcuts: { title: 'Keyboard Shortcuts', body: `KEYBOARD SHORTCUTS\n\nEditor:\n  Ctrl+S         Save file\n  Ctrl+Shift+S   Save As\n  Ctrl+Z         Undo\n  Ctrl+Y         Redo\n  Ctrl+C         Copy\n  Ctrl+V         Paste\n  Ctrl+X         Cut\n\nNavigation:\n  Ctrl+Shift+E   Toggle Explorer\n  Ctrl+\`         Open/Close Terminal\n\nBuild & Run:\n  Ctrl+Shift+B   Run Build Task\n\nMenu:\n  Edit Menu      Undo, Redo, Find, Replace\n  Terminal Menu  New terminal, Kill terminal, Run tasks\n  Help Menu      This screen and full docs` },
        };

        const unsubs = [
            on('save', () => handleSave()),
            on('saveAs', () => {
                const name = window.prompt('Save As — enter filename:', activeFile);
                if (name) { setActiveFile(name); setTimeout(() => handleSave(), 50); }
            }),
            on('newFile', () => {
                const name = window.prompt('New File — enter filename:', 'untitled.tsx');
                if (name) { setActiveFile(name); setCodeContent(''); setViewMode('CODE'); }
            }),
            on('revertFile', () => loadFromFile(activeFile)),
            on('closeEditor', () => setCodeContent('')),
            on('toggleExplorer', () => setExplorerOpen(prev => !prev)),
            on('refreshExplorer', () => refreshExplorer()),
            on('appearance', () => setDrawerOpen(prev => !prev)),
            on('runActiveFile', () => callMcp('run_file', { path: activeFile, content: codeContent })),
            on('runBuildTask', () => callMcp('run_task', { task: 'build' })),
            on('runTask', () => {
                const task = window.prompt('Run Task — enter task name:', 'build');
                if (task) callMcp('run_task', { task });
            }),
            on('newTerminal', () => openTerminal()),
            on('killTerminal', () => closeTerminal()),
            on('zoomIn', () => {
                const current = parseFloat(document.documentElement.style.fontSize || '16');
                document.documentElement.style.fontSize = `${Math.min(current + 1, 24)}px`;
            }),
            on('zoomOut', () => {
                const current = parseFloat(document.documentElement.style.fontSize || '16');
                document.documentElement.style.fontSize = `${Math.max(current - 1, 10)}px`;
            }),
            on('resetZoom', () => { document.documentElement.style.fontSize = ''; }),
            on('about', () => setHelpTopic('helpAbout')),
            on('welcome', () => setHelpTopic('helpCode')),
            // Help menu items
            ...(['helpAbout','helpHome','helpCode','helpLive','helpMessages','helpSettings','helpShortcuts'] as const).map(
                (key) => on(key, () => setHelpTopic(key))
            ),
        ];

        // Keep terminal ws alive across re-renders
        return () => { unsubs.forEach(fn => fn()); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeFile, codeContent, handshake, terminalOpen]);

    // --- BUILD PLAN EXECUTOR ---
    useEffect(() => {
        if (!buildPlan || buildRunning.current) return;
        buildRunning.current = true;
        setBuildProgress({ current: 0, status: 'Initializing...' });

        // —— Parallel build engine: run steps in batches of PARALLEL_WORKERS simultaneously ——
        const PARALLEL_WORKERS = 4; // 8-12 total via overlapping batches
        const runBuild = async () => {
            const steps = buildPlan.steps;
            let lastCode = '';

            const runStep = async (i: number): Promise<void> => {
                setBuildProgress({ current: i, status: steps[i] });
                try {
                    const resp = await fetch('/api/chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...(handshake ? { 'x-neural-handshake': handshake } : {}) },
                        body: JSON.stringify({
                            text: `BUILD STEP ${i + 1}/${steps.length}: ${steps[i]}\n\nTask: ${buildPlan.taskName}\n\nGenerate ONLY the code, files, or actions needed for this specific step. Write any created files using the filesystem API. Be concise and focused. Show your work.`,
                            source: 'build',
                            id: `build-${Date.now()}-step-${i}`
                        })
                    });
                    if (resp.ok) {
                        const data = await resp.json();
                        if (data?.text) {
                            const codeMatch = data.text.match(/```(?:\w+)?\n([\s\S]+?)```/);
                            if (codeMatch) {
                                lastCode = codeMatch[1];
                                setCodeContent(codeMatch[1]);
                                setViewMode('CODE');
                            }
                        }
                    }
                } catch { /* continue even if a step fails */ }
            };

            // Fan out in batches of PARALLEL_WORKERS
            for (let batch = 0; batch < steps.length; batch += PARALLEL_WORKERS) {
                const batchSteps = Array.from(
                    { length: Math.min(PARALLEL_WORKERS, steps.length - batch) },
                    (_, k) => batch + k
                );
                setBuildProgress({ current: batch, status: `Running ${batchSteps.length} parallel tasks…` });
                await Promise.allSettled(batchSteps.map(i => runStep(i)));
                // Brief yield between batches so UI can update
                await new Promise(r => setTimeout(r, 600));
            }

            setBuildProgress({ current: steps.length, status: '✅ All tasks complete! Built by Agent Lee.' });
            if (lastCode) { setCodeContent(lastCode); setViewMode('CODE'); }
            setTimeout(() => {
                setBuildProgress(null);
                buildRunning.current = false;
                if (onBuildComplete) onBuildComplete();
            }, 3000);
        };

        runBuild();
    }, [buildPlan]);

    return (
        <div className="h-full flex flex-col bg-[#050505] relative">

            {/* ── FILE OPEN DIALOG ── */}
            {fileDialog && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6" onClick={() => setFileDialog(null)}>
                    <div className="bg-[#111] border border-gray-700 rounded-2xl p-6 max-w-sm w-full shadow-2xl" onClick={e => e.stopPropagation()}>
                        <div className="text-xs text-gray-500 font-mono mb-1 uppercase tracking-widest">Open File</div>
                        <div className="text-sm text-white font-bold mb-4 truncate">{fileDialog.name}</div>
                        <div className="flex flex-col gap-3">
                            <button
                                className="w-full py-3 bg-cyan-500/10 border border-cyan-500/50 text-cyan-300 rounded-xl text-sm font-bold hover:bg-cyan-500/20 transition-all"
                                onClick={() => {
                                    setActiveFile(fileDialog.path);
                                    setViewMode('CODE');
                                    setFileViewMode('editor');
                                    setFileDialog(null);
                                }}
                            >
                                ✏️  Work on this file
                            </button>
                            <button
                                className="w-full py-3 bg-gray-800/60 border border-gray-700 text-gray-300 rounded-xl text-sm font-bold hover:bg-gray-700/60 transition-all"
                                onClick={() => {
                                    setActiveFile(fileDialog.path);
                                    setViewMode('CODE');
                                    setFileViewMode('view');
                                    setFileDialog(null);
                                }}
                            >
                                👁️  View only (read-only)
                            </button>
                            <button
                                className="w-full py-2 text-gray-600 text-xs hover:text-gray-400 transition-colors"
                                onClick={() => setFileDialog(null)}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── HELP MODAL ── */}
            {helpTopic && (() => {
                const content = ({
                    helpAbout: { title: 'About Agent Lee OS', body: `Agent Lee OS v1.0 — Leeway Innovations\n\nYou are: The Creator / Sovereign\nAgent Lee: your personal AI, operating across UI, Telegram, and local desktop.\n\nServices running:\n  • Backend API — Node.js port 8001\n  • Neural Router — Python FastAPI port 8004\n  • PocketTTS Voice — port 8007 (marius, locked)\n  • WebSocket Bridge — port 8003\n  • Desktop Agent — port 8005` },
                    helpHome: { title: 'Home — Dashboard', body: `HOME TAB — Mission control\n\nWhat you can do:\n  • Talk to Agent Lee via Command Input (bottom)\n  • See Agent Lee\'s VoxelCore avatar morph in 3D\n  • Monitor live status cards\n  • View Telegram messages in Messages tab\n\nVoxelCore shapes: sphere, house, tree, dna, heart, star
Agent Lee speaks every response in his locked voice.` },
                    helpCode: { title: 'Code Studio', body: `CODE STUDIO — Full editing environment\n\nLeft panel: File Explorer\n  • Browse all drives (C:, D:, etc.)\n  • Tap a file → choose Work on it or View only\n  • Images show inline; Video/Audio/PDF need Preview tap\n\nEditor: Write and edit any text/code\nTerminal: Click TERMINAL in status bar or use Terminal menu\n  • Real host PowerShell\n  • Type command, press Enter\n\nKeyboard shortcuts:\n  Ctrl+S — Save\n  Ctrl+Z / Y — Undo/Redo` },
                    helpLive: { title: 'Live View', body: `LIVE VIEW — Remote desktop control\n\n  • Touch or click to interact with your desktop\n  • Pinch to zoom in/out (mobile)\n  • Double-tap = double-click\n  • SCREEN 1 / SCREEN 2 / BOTH — multi-monitor\n  • AA CLICK — click at last cursor position\n  • TRACKPAD mode — drag moves cursor\n  • Text input — send keystrokes to desktop\n\nRequires Desktop Agent running on port 8005.` },
                    helpMessages: { title: 'Messages', body: `MESSAGES — Unified inbox\n\n  • Telegram messages arrive in real time\n  • Agent Lee auto-responds with voice + text\n  • All channels sync: UI ↔ Telegram\n\nAgent Lee\'s rule: ONE consciousness, all channels.` },
                    helpSettings: { title: 'Settings & Voice', body: `SETTINGS\n\nVoice (LOCKED):\n  Voice: marius (PocketTTS)\n  Profile: motivational_architect\n  Pitch: 0.88 (deep baritone)\n  To change voice: say \'change voice\' to Agent Lee\n\nEditor theme: VS CODE or ANTI-GRAVITY\nTunnel URL: paste from cloudflared` },
                    helpShortcuts: { title: 'Keyboard Shortcuts', body: `SHORTCUTS\n\n  Ctrl+S         Save\n  Ctrl+Shift+S   Save As\n  Ctrl+Z         Undo\n  Ctrl+Y         Redo\n  Ctrl+C / V / X Copy / Paste / Cut\n  Ctrl+\`         Open/Close Terminal\n  Ctrl+Shift+B   Run Build Task\n  Ctrl+Shift+E   Toggle Explorer` },
                } as Record<string, {title: string; body: string}>)[helpTopic] || { title: helpTopic, body: '' };
                return (
                    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[200] flex items-center justify-center p-4" onClick={() => setHelpTopic(null)}>
                        <div className="bg-[#111] border border-gray-700 rounded-2xl p-6 max-w-md w-full shadow-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-4">
                                <div className="text-sm font-bold text-cyan-400 tracking-wide">{content.title}</div>
                                <button onClick={() => setHelpTopic(null)} className="text-gray-500 hover:text-white"><X size={16} /></button>
                            </div>
                            <pre className="text-[12px] text-gray-300 font-mono whitespace-pre-wrap leading-6 overflow-y-auto flex-1 custom-scrollbar">{content.body}</pre>
                        </div>
                    </div>
                );
            })()}
            <div className="flex-1 flex overflow-hidden relative">
                {/* EXPLORER SIDEBAR */}
                {explorerOpen && (
                    <div className="w-70 bg-[#0d0d0d] border-r border-gray-800 flex flex-col shrink-0 animate-[fade-in_0.3s_ease-out]">
                        <div className="p-3 border-b border-white/5 flex items-center justify-between">
                            <span className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">Explorer</span>
                            <div className="flex gap-2">
                                <button aria-label="Refresh explorer" title="Refresh explorer" onClick={() => refreshExplorer()} className="text-gray-500 hover:text-white"><RefreshCw size={12} /></button>
                                <button aria-label="Close explorer" title="Close explorer" onClick={() => setExplorerOpen(false)} className="text-gray-500 hover:text-white"><X size={12} /></button>
                            </div>
                        </div>
                        {/* Drive Selector */}
                        {availableDrives.length > 0 && (
                            <div className="flex flex-wrap gap-1 px-3 py-2 border-b border-white/5 bg-black/30">
                                {availableDrives.map(d => (
                                    <button
                                        key={d.id}
                                        onClick={() => { setSelectedDrive(d.id); setFileTree(null); refreshExplorer(d.id); }}
                                        title={d.root}
                                        className={`text-[9px] font-mono px-2 py-0.5 rounded border transition-colors ${
                                            selectedDrive === d.id
                                                ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                                                : 'border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                                        }`}
                                    >
                                        {d.id}:
                                    </button>
                                ))}
                            </div>
                        )}
                        <div className="flex-1 overflow-y-auto custom-scrollbar py-2">
                            {fileTree ? (
                                fileTree.map(entry => (
                                    <FileTreeItem
                                        key={entry.relPath}
                                        entry={entry}
                                        onSelect={(path) => {
                                            // Directories open directly; files show a dialog
                                            const ext = path.split('.').pop()?.toLowerCase() || '';
                                            const isDir = !ext || entry.type === 'directory';
                                            if (isDir) {
                                                setActiveFile(path);
                                                setViewMode('CODE');
                                            } else {
                                                setFileDialog({ path, name: path.split('/').pop() || path });
                                            }
                                        }}
                                        activeFile={activeFile}
                                        root={selectedDrive}
                                        handshake={handshake}
                                    />
                                ))
                            ) : (
                                <div className="p-4 text-center">
                                    <Loader2 size={16} className="animate-spin text-gray-600 mx-auto" />
                                    <span className="text-[10px] text-gray-600 mt-2 block font-mono">LOADING FILE SYSTEM...</span>
                                </div>
                            )}

                            {/* Templates section — collapsed by default so real files are accessible */}
                            <div className="mt-4 pt-4 border-t border-white/5">
                                <button
                                    onClick={() => setTemplatesOpen(o => !o)}
                                    className="flex items-center gap-1.5 px-3 py-1 w-full text-left hover:bg-white/5 transition-colors group"
                                >
                                    {templatesOpen
                                        ? <ChevronDown size={10} className="text-gray-500" />
                                        : <ChevronRight size={10} className="text-gray-500" />
                                    }
                                    <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest group-hover:text-gray-400 transition-colors">Templates</span>
                                </button>
                                {templatesOpen && (
                                    <div className="space-y-0.5 mt-1 px-3">
                                        {Object.keys(APP_TEMPLATES).map((name) => (
                                            <div
                                                key={name}
                                                onClick={() => loadTemplate(name)}
                                                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-white/5 text-[11px] ${activeFile === name ? 'text-blue-400 bg-blue-500/10' : 'text-gray-500'}`}
                                            >
                                                <Sparkles size={11} className="opacity-50" />
                                                {name}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* MAIN EDITOR AREA */}
                <div className="flex-1 flex flex-col min-h-0 relative">
                    {/* BUILD PROGRESS PANEL */}
                    {buildProgress && buildPlan && (
                        <div className="absolute top-0 right-0 bottom-0 w-75 bg-black/96 border-l border-blue-500/30 z-60 p-5 overflow-y-auto flex flex-col gap-3">
                            <div className="text-[10px] font-bold text-blue-400 tracking-[0.2em] mb-1">⚙️ BUILDING — {buildPlan.taskName.slice(0, 50)}</div>
                            {buildPlan.steps.map((step, i) => {
                                const isDone = i < buildProgress.current;
                                const isActive = i === buildProgress.current;
                                return (
                                    <div key={i} className={`flex gap-2 text-[11px] py-2 border-b border-white/5 leading-tight ${isActive ? 'text-white' : isDone ? 'text-green-400' : 'text-gray-600'}`}>
                                        <span className="shrink-0 mt-px">{isDone ? '✅' : isActive ? '🔄' : '⬜'}</span>
                                        <span>{step}</span>
                                    </div>
                                );
                            })}
                            {buildProgress.current >= buildPlan.steps.length && (
                                <div className="text-green-400 text-[11px] font-bold mt-2">{buildProgress.status}</div>
                            )}
                        </div>
                    )}
                    {/* Accessibility Drawer */}
                    {drawerOpen && (
                        <div className="absolute top-0 right-0 bottom-0 w-[320px] bg-black/95 border-l border-gray-800 backdrop-blur-3xl p-6 z-50 overflow-y-auto shadow-[-20px_0_50px_rgba(0,0,0,0.5)]">
                            <div className="flex items-center justify-between mb-6">
                                <div className="text-[14px] font-bold text-cyan-400 tracking-[0.2em]">ACCESSIBILITY CONTROL</div>
                                <X size={20} className="text-gray-500 cursor-pointer" onClick={() => setDrawerOpen(false)} />
                            </div>

                            <div className="mb-8">
                                <div className="text-[10px] text-gray-500 font-mono mb-4 uppercase tracking-widest">Editor Identity</div>
                                <div className="space-y-3">
                                    <button
                                        onClick={() => setEditorIdentity('VS_CODE')}
                                        className={`w-full px-4 py-3 text-[11px] font-bold rounded-xl border transition-all ${editorIdentity === 'VS_CODE' ? 'border-cyan-500/50 text-cyan-300 bg-cyan-500/10 shadow-[0_0_15px_rgba(6,182,212,0.1)]' : 'border-gray-800 text-gray-500 hover:border-gray-600'}`}
                                    >
                                        VS CODE (CLASSIC BLUE)
                                    </button>
                                    <button
                                        onClick={() => setEditorIdentity('ANTI_GRAVITY')}
                                        className={`w-full px-4 py-3 text-[11px] font-bold rounded-xl border transition-all ${editorIdentity === 'ANTI_GRAVITY' ? 'border-purple-500/50 text-purple-300 bg-purple-500/10 shadow-[0_0_15px_rgba(168,85,247,0.1)]' : 'border-gray-800 text-gray-500 hover:border-gray-600'}`}
                                    >
                                        ANTI-GRAVITY (QUANTUM PURPLE)
                                    </button>
                                </div>
                            </div>

                            {/* Identity-specific config preserved as requested */}
                            {editorIdentity === 'VS_CODE' && (
                                <div className="mb-6">
                                    <div className="text-[10px] text-gray-500 font-mono mb-2 uppercase tracking-widest">Real VS Code Tunnel</div>
                                    <input
                                        value={vsCodeUrl}
                                        onChange={(e) => setVsCodeUrl(e.target.value)}
                                        placeholder="Paste tunnel URL..."
                                        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-500/50 transition-all"
                                    />
                                    <button
                                        onClick={openRealVSCode}
                                        disabled={!vsCodeUrl.trim()}
                                        className="mt-3 w-full h-11 rounded-xl bg-blue-600/20 border border-blue-500/30 text-[11px] font-bold text-blue-400 hover:bg-blue-600/30 disabled:opacity-30 transition-all"
                                    >
                                        SYNC LOCAL BINARY
                                    </button>
                                </div>
                            )}

                            {editorIdentity === 'ANTI_GRAVITY' && (
                                <div className="mb-6">
                                    <div className="text-[10px] text-gray-500 font-mono mb-2 uppercase tracking-widest">Neural Link Interface</div>
                                    <input
                                        value={antiGravityUrl}
                                        onChange={(e) => setAntiGravityUrl(e.target.value)}
                                        placeholder="Paste link..."
                                        className="w-full h-11 px-4 rounded-xl bg-white/5 border border-white/5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-purple-500/50 transition-all"
                                    />
                                    <button
                                        onClick={openRealAntiGravity}
                                        disabled={!antiGravityUrl.trim()}
                                        className="mt-3 w-full h-11 rounded-xl bg-purple-600/20 border border-purple-500/30 text-[11px] font-bold text-purple-400 hover:bg-purple-600/30 disabled:opacity-30 transition-all"
                                    >
                                        INITIALIZE QUANTUM LINK
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* EDITOR TOOLBAR */}
                    <div className="h-12 border-b border-gray-800 flex items-center justify-between px-2 sm:px-4 bg-black/40 backdrop-blur-md overflow-x-auto shrink-0">
                        <div className="flex items-center gap-4">
                            {!explorerOpen && (
                                <button
                                    onClick={() => setExplorerOpen(true)}
                                    className="p-2 hover:bg-white/5 rounded transition-all text-gray-400 hover:text-white"
                                    title="Open Explorer"
                                >
                                    <Menu size={16} />
                                </button>
                            )}
                            <div className="flex items-center gap-2">
                                <FileCode size={16} className={isGenerating ? "text-cyan-400 animate-pulse" : accentText} />
                                <span className="text-xs font-bold text-gray-400 font-mono">{activeFile}</span>
                                {isGenerating && <div className="text-[10px] text-cyan-500 flex items-center gap-2 ml-4">
                                    <div className="h-1 w-20 bg-gray-900 rounded-full overflow-hidden">
                                        <div className="h-full bg-cyan-500 transition-all" style={{ width: `${generationProgress}%` } as React.CSSProperties}></div>
                                    </div>
                                    {Math.floor(generationProgress)}%
                                </div>}
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            <div className="bg-gray-900/60 p-1 rounded-lg flex gap-1 mr-4">
                                <button
                                    onClick={() => setViewMode('CODE')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${viewMode === 'CODE' ? 'bg-gray-800 text-white shadow-inner' : 'text-gray-500'}`}
                                >
                                    EDITOR
                                </button>
                                <button
                                    onClick={() => setViewMode('PREVIEW')}
                                    className={`px-4 py-1.5 text-[10px] font-bold rounded-md transition-all ${viewMode === 'PREVIEW' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-500'}`}
                                >
                                    PREVIEW
                                </button>
                            </div>

                            <button
                                onClick={handleSave}
                                className="p-2.5 bg-gray-900/40 text-gray-300 rounded-lg hover:bg-gray-800 border border-gray-800/50 hover:border-gray-600 transition-all"
                                title="Save File (Ctrl+S)"
                            >
                                <Save size={14} />
                            </button>
                            <button
                                className="p-2.5 bg-green-900/20 text-green-500 rounded-lg hover:bg-green-900/40 border border-green-900/50 transition-all"
                                title="Run Build"
                            >
                                <Play size={14} />
                            </button>
                            <button
                                onClick={() => setDrawerOpen(!drawerOpen)}
                                className={`p-2.5 rounded-lg border transition-all ${drawerOpen ? 'bg-cyan-900/20 border-cyan-500 text-cyan-400' : 'bg-gray-900/40 border-gray-800 text-gray-400 hover:bg-gray-800'}`}
                                title="Studio Settings"
                            >
                                <Settings size={14} />
                            </button>
                        </div>
                    </div>

                    {/* CONTENT AREA */}
                    <div className="flex-1 relative overflow-hidden flex bg-[#050505] min-h-0">
                        {viewMode === 'CODE' ? (() => {
                            const ext = activeFile.split('.').pop()?.toLowerCase() || '';
                            const isImage = ['png','jpg','jpeg','gif','webp','svg','bmp','ico'].includes(ext);
                            const isVideo = ['mp4','webm','ogg','mov','mkv'].includes(ext);
                            const isAudio = ['mp3','wav','ogg','flac','aac','m4a'].includes(ext);
                            const isPDF = ext === 'pdf';
                            const fileUrl = activeFile
                                ? `/api/fs/serve?root=${encodeURIComponent(selectedDrive)}&path=${encodeURIComponent(activeFile)}&handshake=${encodeURIComponent(handshake || '')}`
                                : '';
                            if (isImage && fileUrl) return (
                                <div className="absolute inset-0 flex items-center justify-center overflow-auto bg-black/80 p-4">
                                    <img src={fileUrl} alt={activeFile} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
                                </div>
                            );
                            if (isVideo && fileUrl) return (
                                <div className="absolute inset-0 flex items-center justify-center bg-black p-4">
                                    <video src={fileUrl} controls className="max-w-full max-h-full rounded-lg shadow-2xl" />
                                </div>
                            );
                            if (isAudio && fileUrl) return (
                                <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 bg-black/80 p-4">
                                    <div className="text-4xl">🎵</div>
                                    <div className="text-sm text-gray-400 font-mono">{activeFile.split('/').pop()}</div>
                                    <audio src={fileUrl} controls className="w-full max-w-md" />
                                </div>
                            );
                            if (isPDF && fileUrl) return (
                                <div className="absolute inset-0 flex flex-col overflow-hidden">
                                    <iframe src={fileUrl} className="flex-1 w-full border-0" title={activeFile} />
                                </div>
                            );
                            // Default: code / text editor
                            return (
                                <div className="absolute inset-0 p-0 font-mono text-sm overflow-hidden flex">
                                    {/* Line Numbers */}
                                    <div className="bg-black/60 text-gray-600 text-right py-4 pr-3 select-none border-r border-white/5 w-14 shrink-0 font-mono">
                                        {codeContent.split('\n').map((_, i) => <div key={i} className="h-7 leading-7 text-[12px] opacity-40">{i + 1}</div>)}
                                    </div>

                                    {/* Real Editable Area */}
                                    <div className="relative flex-1 h-full">
                                        {fileViewMode === 'view' && (
                                            <div className="absolute top-2 right-3 z-20 text-[9px] font-bold text-amber-500 bg-amber-500/10 border border-amber-500/40 px-2 py-0.5 rounded tracking-widest">READ-ONLY</div>
                                        )}
                                        <textarea
                                            value={codeContent}
                                            onChange={fileViewMode === 'view' ? undefined : (e) => setCodeContent(e.target.value)}
                                            readOnly={fileViewMode === 'view'}
                                            className={`absolute inset-0 w-full h-full bg-transparent text-gray-200 font-mono text-[16px] leading-7 p-4 resize-none outline-none selection:bg-blue-500/20 whitespace-pre overflow-auto scroll-smooth custom-scrollbar z-10 ${fileViewMode === 'view' ? 'cursor-default' : ''}`}
                                            spellCheck={false}
                                            placeholder="Start writing code..."
                                        />
                                        {/* Sub-background grid for editor feel */}
                                        <div className="absolute inset-0 pointer-events-none opacity-[0.02] bg-[radial-gradient(#fff_1px,transparent_1px)] bg-size-[20px_20px]"></div>
                                    </div>
                                </div>
                            );
                        })() : (
                            <div className="absolute inset-0 bg-[#0a0a0a] flex items-center justify-center overflow-hidden">
                                {APP_TEMPLATES[activeFile] ? (
                                    <div className="w-full h-full animate-[fade-in_0.5s_ease-out]">
                                        {React.createElement(APP_TEMPLATES[activeFile].component)}
                                    </div>
                                ) : (
                                    <div className="p-10 border border-white/5 rounded-3xl shadow-2xl bg-gray-900/40 text-center max-w-sm backdrop-blur-xl">
                                        <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
                                            <Sparkles className="text-blue-400" size={32} />
                                        </div>
                                        <h1 className="text-2xl font-black text-white mb-3 tracking-tight">Preview Active</h1>
                                        <p className="text-gray-400 text-sm leading-relaxed">Agent Lee has initialized the neural preview. You can interact with the rendered component here.</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Status Bar */}
                    <div className="h-7 border-t border-gray-800 bg-[#0a0a0a] flex items-center justify-between px-2 sm:px-4 text-[10px] text-gray-600 font-mono tracking-wide uppercase shrink-0 overflow-x-auto">
                        <div className="flex items-center gap-4">
                            <span className="flex items-center gap-1.5"><RefreshCw size={10} /> Sync: Online</span>
                            <span className="opacity-40">TypeScript React</span>
                        </div>
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => terminalOpen ? (termWsRef.current?.close(), termWsRef.current = null, setTerminalOpen(false)) : window.dispatchEvent(new CustomEvent('agentlee:newTerminal'))}
                                className={`text-[9px] px-2 py-0.5 rounded border transition-colors ${terminalOpen ? 'border-cyan-500/60 text-cyan-400 bg-cyan-500/10' : 'border-gray-700 text-gray-500 hover:border-gray-500'}`}
                            >
                                TERMINAL {terminalOpen ? '▼' : '▲'}
                            </button>
                            <span>UTF-8</span>
                            <span className={`transition-all ${isGenerating ? 'text-cyan-500' : ''}`}>{isGenerating ? 'WRITING TO BUFFER...' : 'READY'}</span>
                        </div>
                    </div>

                    {/* ── TERMINAL PANEL ── — VS Code style: always at the bottom right */}
                    {terminalOpen && (
                        <div className="h-56 border-t-2 border-cyan-500/40 bg-[#050505] flex flex-col shrink-0 relative z-30">
                            <div className="h-7 border-b border-gray-800 flex items-center justify-between px-3 bg-black/60">
                                <span className="text-[10px] font-bold text-cyan-400 tracking-widest">TERMINAL — PowerShell</span>
                                <button onClick={() => { termWsRef.current?.close(); termWsRef.current = null; setTerminalOpen(false); }} className="text-gray-500 hover:text-white"><X size={12} /></button>
                            </div>
                            <div ref={termScrollRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] text-green-300 bg-[#040404] custom-scrollbar select-text">
                                {termLines.map((line, i) => (
                                    <div key={i} className="leading-5 whitespace-pre-wrap break-all">{line || '\u00a0'}</div>
                                ))}
                            </div>
                            <div className="h-9 border-t border-gray-800 flex items-center px-2 gap-2 bg-black/80">
                                <span className="text-[11px] text-cyan-600 font-mono shrink-0">$</span>
                                <input
                                    className="flex-1 bg-transparent text-[12px] text-gray-200 font-mono outline-none placeholder-gray-600"
                                    placeholder="Type command and press Enter..."
                                    value={termInput}
                                    onChange={e => setTermInput(e.target.value)}
                                    onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            const cmd = termInput.trim();
                                            if (cmd && termWsRef.current?.readyState === WebSocket.OPEN) {
                                                termWsRef.current.send(JSON.stringify({ type: 'input', data: cmd + '\r\n' }));
                                            } else if (cmd) {
                                                setTermLines(prev => [...prev, `[Not connected — use Terminal menu to reconnect]`]);
                                            }
                                            setTermInput('');
                                        }
                                    }}
                                    autoComplete="off"
                                    spellCheck={false}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};


// Simple Syntax Highlighter for effect
const highlightSyntax = (code: string) => {
    return code
        .replace(/import|from|export|default|function|const|return/g, '<span style="color: #c586c0">$&</span>')
        .replace(/'[^']*'/g, '<span style="color: #ce9178">$&</span>')
        .replace(/\/\/.*/g, '<span style="color: #6a9955">$&</span>')
        .replace(/<[^>]*>/g, '<span style="color: #569cd6">$&</span>');
}