/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use client';

import React from 'react';
import { Search, X, ArrowUpDown } from 'lucide-react';

export type BoardSortField =
  | 'oracle'
  | 'stars'
  | 'draft_score'
  | 'projected_points'
  | 'spirit_score'
  | 'market_vor'
  | 'harmony_score'
  | 'favorability_score'
  | 'adp';
export type BoardSortDirection = 'asc' | 'desc';
export type PositionFilterValue = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX';
export type BoardModeFilter = 'all' | 'waivers' | 'trades' | 'my_team';

export interface BoardControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  positionFilter: PositionFilterValue;
  onPositionFilterChange: (position: PositionFilterValue) => void;
  sortField: BoardSortField;
  sortDirection: BoardSortDirection;
  onSortChange: (field: BoardSortField, direction?: BoardSortDirection) => void;
  hideDrafted?: boolean;
  onToggleHideDrafted?: (hide: boolean) => void;
  modeFilter?: BoardModeFilter;
  onModeFilterChange?: (mode: BoardModeFilter) => void;
  positionCounts?: Record<PositionFilterValue, number>;
  totalVisibleCount?: number;
  className?: string;
}

const MODE_PILLS: Array<{ id: BoardModeFilter; label: string }> = [
  { id: 'all', label: 'All Players' },
  { id: 'waivers', label: 'Waivers' },
  { id: 'trades', label: 'Trades' },
  { id: 'my_team', label: 'My Roster' },
];

export const BoardControls: React.FC<BoardControlsProps> = ({
  searchQuery,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  sortField,
  onSortChange,
  hideDrafted = false,
  onToggleHideDrafted,
  modeFilter = 'all',
  onModeFilterChange,
  positionCounts,
  totalVisibleCount,
  className = '',
}) => {
  const positions: PositionFilterValue[] = ['ALL', 'QB', 'RB', 'WR', 'TE', 'FLEX'];

  const getPositionChipStyle = (pos: PositionFilterValue, isActive: boolean) => {
    if (!isActive) {
      return 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/10';
    }
    switch (pos) {
      case 'QB':
        return 'bg-red-500/20 text-red-300 border-red-400 shadow-[0_0_10px_rgba(239,68,68,0.4)]';
      case 'RB':
        return 'bg-teal-500/20 text-teal-300 border-teal-400 shadow-[0_0_10px_rgba(20,184,166,0.4)]';
      case 'WR':
        return 'bg-sky-500/20 text-sky-300 border-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.4)]';
      case 'TE':
        return 'bg-amber-500/20 text-amber-300 border-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.4)]';
      case 'FLEX':
        return 'bg-rose-500/20 text-rose-300 border-rose-400 shadow-[0_0_10px_rgba(244,63,94,0.4)]';
      default:
        return 'bg-cyan-500 text-slate-950 font-bold shadow-[0_0_10px_rgba(6,182,212,0.4)]';
    }
  };

  return (
    <div className={`space-y-3 w-full min-w-0 ${className}`}>
      {/* Mode Filter Pills (All Players | Waivers | Trades | My Roster) */}
      {onModeFilterChange && (
        <div
          data-testid="board-mode-pills"
          className="flex items-center gap-1.5 overflow-x-auto pb-0.5 scrollbar-none"
        >
          {MODE_PILLS.map((pill) => {
            const active = modeFilter === pill.id;
            const isMyTeamPill = pill.id === 'my_team';
            return (
              <button
                key={pill.id}
                type="button"
                data-testid={`board-mode-${pill.id}`}
                onClick={() => onModeFilterChange(pill.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-mono font-bold transition-all whitespace-nowrap border ${
                  active
                    ? isMyTeamPill
                      ? 'bg-purple-950/80 border-purple-500/60 text-purple-200 shadow-[0_0_10px_rgba(168,85,247,0.3)]'
                      : 'bg-cyan-950/80 border-cyan-500/50 text-cyan-200 shadow-[0_0_10px_rgba(6,182,212,0.25)]'
                    : 'bg-slate-900/70 border-white/10 text-slate-400 hover:text-slate-200'
                }`}
              >
                {pill.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Search Input, 3-Metric Sort Dropdown & Free Agents Toggle */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search player or team..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-9 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs font-mono text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500/60 focus:ring-1 focus:ring-cyan-500/30"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              aria-label="Clear Search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Strictly 3 Canonical Metrics Sort Dropdown (Oracle, Stats, Stars) */}
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative flex-1 min-w-0 sm:flex-none">
            <select
              value={
                sortField === 'projected_points' || sortField === 'stars'
                  ? sortField
                  : 'oracle'
              }
              onChange={(e) => {
                const field = e.target.value as BoardSortField;
                onSortChange(field, 'desc');
              }}
              aria-label="Sort players by"
              className="w-full truncate appearance-none pl-8 pr-8 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/60 cursor-pointer"
            >
              <option value="oracle">Oracle: blended score</option>
              <option value="projected_points">Stats: projected points</option>
              <option value="stars">Stars: this week</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
          </div>

          {onToggleHideDrafted && modeFilter === 'all' && (
            <button
              type="button"
              onClick={() => onToggleHideDrafted(!hideDrafted)}
              className={`px-3 py-2 rounded-xl text-xs font-mono border transition-all flex items-center gap-2 whitespace-nowrap active:scale-95 ${
                hideDrafted
                  ? 'bg-cyan-950/80 border-cyan-500/40 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/80 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  hideDrafted ? 'bg-cyan-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
              <span>Free agents only</span>
            </button>
          )}
        </div>
      </div>

      {/* Positional Filter Chips Row */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none min-w-0 max-w-full">
        <div className="flex items-center gap-1.5 shrink-0">
          {positions.map((pos) => {
            const isActive = positionFilter === pos;
            const count = positionCounts ? positionCounts[pos] : undefined;

            return (
              <button
                key={pos}
                type="button"
                onClick={() => onPositionFilterChange(pos)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all ${getPositionChipStyle(
                  pos,
                  isActive
                )}`}
              >
                {pos}
                {count !== undefined && <span className="ml-1 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>

        {totalVisibleCount !== undefined && (
          <span className="text-[11px] font-mono text-slate-500 whitespace-nowrap hidden sm:inline">
            {totalVisibleCount} players
          </span>
        )}
      </div>
    </div>
  );
};

export default BoardControls;
