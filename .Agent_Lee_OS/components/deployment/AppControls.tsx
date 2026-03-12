/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.APPCONTROLS.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = AppControls module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\AppControls.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — App Controls ───────────────────────────────────────────────

import { AlertTriangle, Play, RefreshCw, Shield, Square, Trash2, Wrench } from 'lucide-react';
import React, { useState } from 'react';
import { appAction, deleteApp } from './useAppMetrics';
import { AppStatus, DeployedApp } from './appTypes';

interface Props {
  app: DeployedApp;
  onUpdate: (updated: DeployedApp) => void;
  onDelete: (id: string) => void;
  onDiagnostics: () => void;
  compact?: boolean;
}

const Btn: React.FC<{
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger' | 'success' | 'warning' | 'purple';
  spinning?: boolean;
  compact?: boolean;
}> = ({ icon, label, onClick, disabled, variant = 'default', spinning, compact }) => {
  const variants: Record<string, string> = {
    default:  'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white',
    success:  'bg-emerald-500/10 hover:bg-emerald-500/20 border-emerald-500/30 text-emerald-400',
    danger:   'bg-red-500/10 hover:bg-red-500/20 border-red-500/30 text-red-400',
    warning:  'bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30 text-amber-400',
    purple:   'bg-purple-500/10 hover:bg-purple-500/20 border-purple-500/30 text-purple-400',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono tracking-wide
        transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${disabled ? '' : 'hover:scale-[1.03]'}`}
    >
      <span className={spinning ? 'animate-spin' : ''}>{icon}</span>
      {!compact && <span>{label}</span>}
    </button>
  );
};

export const AppControls: React.FC<Props> = ({ app, onUpdate, onDelete, onDiagnostics, compact }) => {
  const [busy, setBusy] = useState<'toggle' | 'restart' | 'repair' | 'delete' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isRunning = app.status === 'running';
  const isBusy = app.status === 'restarting' || app.status === 'repairing' || busy !== null;

  const run = async (action: 'toggle' | 'restart' | 'repair') => {
    setBusy(action);
    try {
      const updated = await appAction(app.id, action);
      onUpdate(updated);
    } catch {
      // optimistic UI for demo fallback
      const fakePatch: Partial<DeployedApp> = {
        toggle:  { status: isRunning ? 'stopped' : 'running' as AppStatus, lastUpdated: new Date().toISOString() },
        restart: { status: 'restarting' as AppStatus, lastUpdated: new Date().toISOString() },
        repair:  { status: 'repairing' as AppStatus, lastUpdated: new Date().toISOString() },
      }[action] ?? {};
      onUpdate({ ...app, ...fakePatch });
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); setTimeout(() => setConfirmDelete(false), 4000); return; }
    setBusy('delete');
    try {
      await deleteApp(app.id);
    } catch {/* ignore */} finally {
      onDelete(app.id);
      setBusy(null);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Toggle */}
      <Btn
        icon={isRunning ? <Square size={12} /> : <Play size={12} />}
        label={isRunning ? 'Stop' : 'Start'}
        variant={isRunning ? 'warning' : 'success'}
        onClick={() => run('toggle')}
        disabled={isBusy}
        compact={compact}
      />

      {/* Restart */}
      <Btn
        icon={<RefreshCw size={12} />}
        label="Restart"
        variant="default"
        onClick={() => run('restart')}
        disabled={isBusy}
        spinning={busy === 'restart' || app.status === 'restarting'}
        compact={compact}
      />

      {/* Repair */}
      <Btn
        icon={<Wrench size={12} />}
        label="Repair"
        variant="purple"
        onClick={() => run('repair')}
        disabled={isBusy}
        spinning={busy === 'repair' || app.status === 'repairing'}
        compact={compact}
      />

      {/* Diagnostics */}
      <Btn
        icon={<Shield size={12} />}
        label="Diag"
        variant="default"
        onClick={onDiagnostics}
        compact={compact}
      />

      {/* Delete */}
      <Btn
        icon={confirmDelete ? <AlertTriangle size={12} /> : <Trash2 size={12} />}
        label={confirmDelete ? 'Confirm?' : 'Delete'}
        variant="danger"
        onClick={handleDelete}
        disabled={busy === 'delete'}
        spinning={busy === 'delete'}
        compact={compact}
      />
    </div>
  );
};
