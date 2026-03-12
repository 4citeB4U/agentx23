/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.DEPLOYMENTNEXUS.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = DeploymentNexus module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\DeploymentNexus.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

import React, { useState } from 'react';
import { Github, Cloud, Triangle } from 'lucide-react';
import { HUDFrame } from './UIModules';

const DeployButton: React.FC<{ 
  title: string; 
  description: string; 
  icon: React.ReactNode; 
  bgClass: string;
  borderClass: string;
  onClick?: () => void;
  disabled?: boolean;
}> = ({ title, description, icon, bgClass, borderClass, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`group relative w-full p-4 rounded-xl border ${borderClass} ${bgClass} flex items-center gap-4 transition-all hover:scale-[1.02] hover:brightness-110 active:scale-95 text-left ${disabled ? 'opacity-50 cursor-not-allowed hover:scale-100 active:scale-100' : ''}`}
  >
     <div className="p-3 bg-white/10 rounded-lg text-white">
       {icon}
     </div>
     <div className="flex-1">
       <span className="block text-sm font-bold text-white tracking-wide">{title}</span>
       <span className="block text-[10px] text-white/60 font-mono mt-1">{description}</span>
     </div>
     <div className="text-white/30 group-hover:text-white transition-colors">
        →
     </div>
  </button>
);

export const DeploymentNexus: React.FC = () => {
  const [statusLines, setStatusLines] = useState<string[]>([
    'System Health Check Passed',
    'Assets Optimized',
    'Waiting for deployment command...'
  ]);
  const [isDeploying, setIsDeploying] = useState(false);
  const handshake = (import.meta as any).env?.VITE_NEURAL_HANDSHAKE as string | undefined;

  const initiate = async (platform: 'github' | 'vercel' | 'fly') => {
    setIsDeploying(true);
    setStatusLines((prev) => [
      ...prev.slice(-6),
      `Initiating deployment: ${platform.toUpperCase()}...`
    ]);

    try {
      const response = await fetch('/api/deployment/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(handshake ? { 'x-neural-handshake': handshake } : {}),
          'ngrok-skip-browser-warning': '1'
        },
        body: JSON.stringify({ platform })
      });
      const text = await response.text();
      if (!response.ok) {
        setStatusLines((prev) => [
          ...prev.slice(-6),
          `Deployment failed (${response.status}): ${text.slice(0, 160)}`
        ]);
      } else {
        setStatusLines((prev) => [
          ...prev.slice(-6),
          `Deployment accepted: ${platform.toUpperCase()}`
        ]);
      }
    } catch (e) {
      setStatusLines((prev) => [
        ...prev.slice(-6),
        `Deployment error: ${String(e).slice(0, 160)}`
      ]);
    } finally {
      setIsDeploying(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 mb-6">
         <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <RocketIcon />
         </div>
         <div>
             <h2 className="text-lg font-bold text-white">Deploy Application</h2>
             <p className="text-xs text-gray-400">Choose a provider to launch Agent Lee</p>
         </div>
      </div>
      
      <div className="space-y-3">
        <DeployButton 
          title="Deploy to GitHub" 
          description="Push code to main branch"
          icon={<Github size={24} />}
          bgClass="bg-[#181717]"
          borderClass="border-gray-700"
          onClick={() => initiate('github')}
          disabled={isDeploying}
        />
        
        <DeployButton 
          title="Deploy to Vercel" 
          description="Best for frontend & edge functions"
          icon={<svg width="24" height="24" viewBox="0 0 76 65" fill="none" className="fill-white"><path d="M37.5274 0L75.0548 65H0L37.5274 0Z" /></svg>}
          bgClass="bg-black"
          borderClass="border-gray-800"
          onClick={() => initiate('vercel')}
          disabled={isDeploying}
        />
        
        <DeployButton 
          title="Deploy to Fly.io" 
          description="Deploy Docker containers globally"
          icon={<Cloud size={24} />}
          bgClass="bg-[#24185B]"
          borderClass="border-indigo-500/30"
          onClick={() => initiate('fly')}
          disabled={isDeploying}
        />
      </div>

      <HUDFrame accent="yellow" title="Build Logs" className="mt-8 bg-black/50">
         <div className="font-mono text-[10px] text-gray-400 space-y-2">
            {statusLines.slice(-6).map((line, idx) => (
              <div key={idx} className={`flex items-center gap-2 ${idx === statusLines.slice(-6).length - 1 && isDeploying ? 'animate-pulse' : ''}`}>
                <span className={line.toLowerCase().includes('fail') || line.toLowerCase().includes('error') ? 'text-red-500' : line.toLowerCase().includes('waiting') ? 'text-yellow-500' : 'text-green-500'}>
                  {line.toLowerCase().includes('waiting') ? '➜' : line.toLowerCase().includes('fail') || line.toLowerCase().includes('error') ? '!' : '✓'}
                </span>
                <span>{line}</span>
              </div>
            ))}
         </div>
      </HUDFrame>
    </div>
  );
};

const RocketIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"></path><path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"></path><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"></path><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"></path></svg>
);