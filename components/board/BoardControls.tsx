/**
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
import { Search, X, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

export type BoardSortField =
  | 'draft_score'
  | 'projected_points'
  | 'spirit_score'
  | 'market_vor'
  | 'harmony_score'
  | 'favorability_score'
  | 'adp';
export type BoardSortDirection = 'asc' | 'desc';
export type PositionFilterValue = 'ALL' | 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX';

export interface BoardControlsProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  positionFilter: PositionFilterValue;
  onPositionFilterChange: (position: PositionFilterValue) => void;
  sortField: BoardSortField;
  sortDirection: BoardSortDirection;
  onSortChange: (field: BoardSortField, direction?: BoardSortDirection) => void;
  hideDrafted: boolean;
  onToggleHideDrafted: (hide: boolean) => void;
  positionCounts?: Record<PositionFilterValue, number>;
  totalVisibleCount?: number;
  className?: string;
}

export const BoardControls: React.FC<BoardControlsProps> = ({
  searchQuery,
  onSearchChange,
  positionFilter,
  onPositionFilterChange,
  sortField,
  sortDirection,
  onSortChange,
  hideDrafted,
  onToggleHideDrafted,
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
    <div className={`space-y-3 w-full ${className}`}>
      {/* Top Controls Row: Search Input & Hide Drafted Toggle */}
      <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
        {/* Search Box */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search celestial player or team..."
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

        {/* Sort Dropdown */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              value={sortField}
              onChange={(e) => {
                const field = e.target.value as BoardSortField;
                const dir = field === 'adp' ? 'asc' : 'desc';
                onSortChange(field, dir);
              }}
              aria-label="Sort players by"
              className="appearance-none pl-8 pr-8 py-2 rounded-xl bg-slate-900/90 border border-white/10 text-xs font-mono text-slate-200 focus:outline-none focus:border-cyan-500/60 cursor-pointer"
            >
              <option value="draft_score">DraftScore (Recommended)</option>
              <option value="favorability_score">Wk Favorability (Matchup)</option>
              <option value="projected_points">Projected Pts (Sleeper)</option>
              <option value="spirit_score">Spirit Score (Cosmic)</option>
              <option value="market_vor">Market VOR (Analytics)</option>
              <option value="harmony_score">Harmony Score (Synergy)</option>
              <option value="adp">Rank / ADP</option>
            </select>
            <ArrowUpDown className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
          </div>

          {/* Hide Drafted Switch */}
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
            <span>Available Only</span>
          </button>
        </div>
      </div>

      {/* Positional Filter Chips Row */}
      <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 scrollbar-none">
        <div className="flex items-center gap-1.5">
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
