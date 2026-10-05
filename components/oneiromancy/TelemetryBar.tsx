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
import GlassCard from '@/components/common/GlassCard';
import { TrendingUp, BarChart2, Flame, Droplet, Wind, Mountain, Layers } from 'lucide-react';

export interface TelemetryBarProps {
  totalProjectedPoints?: number;
  totalVOR?: number;
  elementalDistribution?: {
    Fire: number;
    Earth: number;
    Air: number;
    Water: number;
  };
  activeStacks?: {
    team: string;
    multiplier: number;
    bonusPoints?: number;
    bonus_points?: number;
    description?: string;
    type?: string;
    qb_name?: string;
    pass_catcher_names?: string[];
  }[];
  className?: string;
}

export const TelemetryBar: React.FC<TelemetryBarProps> = ({
  totalProjectedPoints = 898.6,
  totalVOR = 211.3,
  elementalDistribution = { Fire: 2, Earth: 1, Air: 1, Water: 3 },
  activeStacks = [
    {
      team: 'CIN',
      multiplier: 3.0,
      bonus_points: 18.0,
      description: 'CIN 3.0x QB/WR Stack (+18.0 pts)',
      qb_name: 'Joe Burrow',
      pass_catcher_names: ["Ja'Marr Chase"],
    },
  ],
  className = '',
}) => {
  // Elemental resonance calculation
  const fire = elementalDistribution.Fire ?? 0;
  const earth = elementalDistribution.Earth ?? 0;
  const air = elementalDistribution.Air ?? 0;
  const water = elementalDistribution.Water ?? 0;

  const hasQuadBalance = fire >= 1 && earth >= 1 && air >= 1 && water >= 1;
  const trines: { name: string; element: string; bonus: number }[] = [];
  if (water >= 3) trines.push({ name: 'Water Trine', element: '💧', bonus: water >= 4 ? 18.0 : 12.0 });
  if (fire >= 3) trines.push({ name: 'Fire Trine', element: '🔥', bonus: fire >= 4 ? 18.0 : 12.0 });
  if (earth >= 3) trines.push({ name: 'Earth Trine', element: '🌍', bonus: earth >= 4 ? 18.0 : 12.0 });
  if (air >= 3) trines.push({ name: 'Air Trine', element: '💨', bonus: air >= 4 ? 18.0 : 12.0 });

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-3 w-full ${className}`}>
      {/* 1. Total Projected Output */}
      <GlassCard variant="panel" glowColor="cyan" className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Projected Output
          </span>
          <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
        </div>
        <div className="my-1">
          <span className="font-mono text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
            {totalProjectedPoints.toFixed(1)}
          </span>
          <span className="text-[11px] font-mono text-cyan-400 ml-1">pts</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 truncate">
          Total Expected PPR
        </span>
      </GlassCard>

      {/* 2. Total Accumulated VOR */}
      <GlassCard variant="panel" glowColor="green" className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Total VOR
          </span>
          <BarChart2 className="w-3.5 h-3.5 text-emerald-400" />
        </div>
        <div className="my-1">
          <span className="font-mono text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">
            {totalVOR >= 0 ? `+${totalVOR.toFixed(1)}` : totalVOR.toFixed(1)}
          </span>
          <span className="text-[11px] font-mono text-emerald-500 ml-1">VOR</span>
        </div>
        <span className="text-[10px] font-mono text-slate-500 truncate">
          Net Value Over Replacement
        </span>
      </GlassCard>

      {/* 3. Squad Alchemy & Western Trines */}
      <GlassCard variant="panel" glowColor="purple" className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-purple-400">
            Squad Alchemy
          </span>
          <span className="text-[10px] font-mono text-purple-300">Western Trines</span>
        </div>
        <div className="my-1 flex items-center justify-between text-xs font-mono">
          <span className="flex items-center gap-0.5 text-rose-400" title="Fire">
            <Flame className="w-3 h-3 inline" /> {fire}
          </span>
          <span className="flex items-center gap-0.5 text-emerald-400" title="Earth">
            <Mountain className="w-3 h-3 inline" /> {earth}
          </span>
          <span className="flex items-center gap-0.5 text-cyan-400" title="Air">
            <Wind className="w-3 h-3 inline" /> {air}
          </span>
          <span className="flex items-center gap-0.5 text-blue-400" title="Water">
            <Droplet className="w-3 h-3 inline" /> {water}
          </span>
        </div>
        <div className="flex items-center gap-1 overflow-hidden truncate">
          {trines.length > 0 ? (
            <span className="text-[9px] font-mono font-bold text-cyan-300 bg-cyan-950/60 px-1.5 py-0.5 rounded border border-cyan-500/30 truncate">
              {trines[0].element} {trines[0].name} (+{trines[0].bonus})
            </span>
          ) : hasQuadBalance ? (
            <span className="text-[9px] font-mono font-bold text-amber-300 bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-500/30 truncate">
              ✦ Quad-Balance (+10.0)
            </span>
          ) : (
            <span className="text-[10px] font-mono text-slate-500 truncate">
              Seeking Trine (3x)
            </span>
          )}
        </div>
      </GlassCard>

      {/* 4. Active Correlation Stacks */}
      <GlassCard variant="panel" glowColor="gold" className="p-3.5 flex flex-col justify-between">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400">
            Active Stacks
          </span>
          <Layers className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div className="my-1">
          {activeStacks.length > 0 ? (
            <div className="flex items-baseline gap-1.5">
              <span className="font-mono text-lg sm:text-xl font-bold text-amber-300">
                {activeStacks[0].team} {activeStacks[0].multiplier.toFixed(1)}x
              </span>
              <span className="text-[10px] font-mono text-emerald-400">
                (+{(activeStacks[0].bonus_points ?? (activeStacks[0] as any).bonusPoints ?? 18.0).toFixed(1)})
              </span>
            </div>
          ) : (
            <span className="font-mono text-sm text-slate-400 block py-1">
              No Stacks
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-slate-500 truncate">
          {activeStacks.length > 0
            ? activeStacks[0].description || `${activeStacks[0].qb_name || 'QB'} ↔ Stack`
            : 'Drafting QB/WR correlation'}
        </span>
      </GlassCard>
    </div>
  );
};

export default TelemetryBar;
