/*
LEEWAY HEADER — DO NOT REMOVE

REGION: UI
TAG: UI.COMPONENT.APPLIST.MAIN

COLOR_ONION_HEX:
NEON=#39FF14
FLUO=#0DFF94
PASTEL=#C7FFD8

ICON_ASCII:
family=lucide
glyph=file

5WH:
WHAT = AppList module
WHY = Part of UI region
WHO = LEEWAY Align Agent
WHERE = .Agent_Lee_OS\components\deployment\AppList.tsx
WHEN = 2026
HOW = Auto-aligned by LEEWAY align-agent

AGENTS:
ASSESS
ALIGN
AUDIT

LICENSE:
MIT
*/

// ── Agent Lee OS — App List ───────────────────────────────────────────────────

import { Search } from 'lucide-react';
import React, { useMemo, useState } from 'react';
import { AppCard } from './AppCard';
import { DeployedApp, AppStatus } from './appTypes';

interface Props {
  apps: DeployedApp[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onUpdate: (updated: DeployedApp) => void;
  onDelete: (id: string) => void;
}

type Filter = 'all' | AppStatus;

const FILTERS: Filter[] = ['all', 'running', 'stopped', 'error', 'degraded'];

export const AppList: React.FC<Props> = ({ apps, selectedId, onSelect, onUpdate, onDelete }) => {
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    let src = apps;
    if (filter !== 'all') src = src.filter((a) => a.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      src = src.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.subdomain.toLowerCase().includes(q) ||
          a.deploymentId.toLowerCase().includes(q),
      );
    }
    return src;
  }, [apps, filter, query]);

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter pills */}
        <div className="flex gap-1 flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={[
                'px-3 py-1 rounded-full text-[10px] font-mono uppercase font-semibold transition-all',
                filter === f
                  ? 'bg-white/15 text-white'
                  : 'bg-white/4 text-white/40 hover:bg-white/8 hover:text-white/70',
              ].join(' ')}
            >
              {f}
              {f !== 'all' && (
                <span className="ml-1 opacity-60">
                  ({apps.filter((a) => a.status === f).length})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative ml-auto">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/30" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search apps…"
            className="bg-white/6 border border-white/10 rounded-xl pl-7 pr-3 py-1.5 text-xs text-white placeholder-white/25 outline-none focus:border-white/25 w-44"
          />
        </div>
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="flex-1 flex items-center justify-center text-white/20 text-sm font-mono">
          {apps.length === 0 ? 'No apps deployed.' : 'No apps match the current filter.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto pb-2">
          {visible.map((app) => (
            <AppCard
              key={app.id}
              app={app}
              selected={app.id === selectedId}
              onSelect={onSelect}
              onUpdate={onUpdate}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};
