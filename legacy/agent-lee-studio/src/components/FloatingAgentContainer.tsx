import React, { useEffect, useRef, useState } from 'react';
import { VoxelCore, VoxelCoreRef } from './VoxelCore';

/**
 * FLOATING AGENT CONTAINER (V3)
 * A draggable, physics-aware container for the Agent Lee hologram.
 * Features: Context-aware positioning, mood reactions, and interactive states.
 */

interface Message {
    id: string;
    role: 'user' | 'model';
    text: string;
}

interface AgentProps {
    activeTab: string;
    messages: Message[];
}

export const FloatingAgentContainer: React.FC<AgentProps> = ({ activeTab, messages }) => {
    const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 120 });
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef({ x: 0, y: 0 });
    const agentRef = useRef<HTMLDivElement>(null);
    const voxelRef = useRef<VoxelCoreRef>(null);

    useEffect(() => {
        if (!agentRef.current) return;
        agentRef.current.style.left = `${position.x}px`;
        agentRef.current.style.top = `${position.y}px`;
    }, [position]);

    // --- Smart Positioning Logic ---
    useEffect(() => {
        // Trigger "Thinking" mood during transit
        if (voxelRef.current) {
            voxelRef.current.setMood('thinking');
            setTimeout(() => voxelRef.current?.setMood('neutral'), 1500);
        }

        const targetPos = getVantagePoint(activeTab);
        setPosition(targetPos);
    }, [activeTab]);

    // --- Reaction Logic ---
    useEffect(() => {
        if (messages.length === 0) return;
        const lastMsg = messages[messages.length - 1];

        if (voxelRef.current) {
            if (lastMsg.role === 'user') {
                // User spoke -> Agent thinks
                voxelRef.current.setMood('thinking');
            } else if (lastMsg.role === 'model') {
                // Agent replied
                if (lastMsg.text.includes('ERROR') || lastMsg.text.includes('unstable')) {
                    voxelRef.current.setMood('angry'); // System Alert
                    setTimeout(() => voxelRef.current?.setMood('neutral'), 3000);
                } else {
                    voxelRef.current.setMood('happy'); // Successful reply
                    setTimeout(() => voxelRef.current?.setMood('neutral'), 2000);
                }
            }
        }
    }, [messages]);

    const getVantagePoint = (tab: string) => {
        const padding = 40;
        const width = 300;
        const height = 300;

        switch (tab) {
            case 'matrix':
                // Bottom-Left: Watching the screen like an operator
                return { x: padding + 60, y: window.innerHeight - height - padding };

            case 'files':
                // Top-Right-ish: float near the content, away from the left sidebar
                return { x: 380, y: 100 };

            case 'settings':
                // Top-Center: Presiding over the control tower
                return { x: window.innerWidth / 2 - (width / 2), y: 100 };

            case 'dashboard':
            default:
                // Top-Right: Standard assistant position
                return { x: window.innerWidth - width - padding, y: 100 };
        }
    };

    // --- Interaction Logic ---
    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        dragStart.current = {
            x: e.clientX - position.x,
            y: e.clientY - position.y
        };
        // Reaction
        voxelRef.current?.setMood('happy');
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;
        setPosition({
            x: e.clientX - dragStart.current.x,
            y: e.clientY - dragStart.current.y
        });
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        voxelRef.current?.setMood('neutral');
    };

    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging]);

    return (
        <div
            ref={agentRef}
            className={`
                fixed z-[100] w-[300px] h-[300px] left-0 top-0
                ${isDragging ? 'scale-105 cursor-grabbing' : 'transition-all duration-1000 cubic-bezier(0.23, 1, 0.32, 1)'}
                pointer-events-none
            `}
        >
            {/* Holographic Container - Captures events for dragging */}
            <div
                className="relative w-full h-full group cursor-move pointer-events-auto"
                onMouseDown={handleMouseDown}
            >

                {/* Agent Voxel Core */}
                <div className="absolute inset-0 z-10 pointer-events-none flex items-center justify-center">
                    <VoxelCore ref={voxelRef} />
                </div>

                {/* Interaction Ring (Visible on hover/drag) */}
                <div className={`
                    absolute inset-0 rounded-full border transition-all duration-500
                    ${isDragging ? 'border-accent-cyan/50 shadow-[0_0_30px_rgba(0,240,255,0.2)]' : 'border-white/5 group-hover:border-accent-cyan/30'}
                `}></div>

                {/* Status Indicator */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2 shadow-xl transition-opacity opacity-0 group-hover:opacity-100">
                    <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${activeTab === 'matrix' ? 'bg-red-500' : 'bg-accent-cyan'}`}></div>
                    <span className={`text-[9px] font-mono uppercase tracking-widest font-bold ${activeTab === 'matrix' ? 'text-red-400' : 'text-accent-cyan'}`}>
                        {activeTab === 'matrix' ? 'NEURAL_LINK_ACTIVE' : 'AWAITING_INPUT'}
                    </span>
                </div>

                {/* Decorative Data Lines */}
                <div className="absolute -inset-4 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none">
                    <div className="absolute top-1/2 left-0 w-2 h-[1px] bg-accent-cyan/30"></div>
                    <div className="absolute top-1/2 right-0 w-2 h-[1px] bg-accent-cyan/30"></div>
                    <div className="absolute top-0 left-1/2 h-2 w-[1px] bg-accent-cyan/30"></div>
                    <div className="absolute bottom-0 left-1/2 h-2 w-[1px] bg-accent-cyan/30"></div>
                </div>
            </div>
        </div>
    );
};
