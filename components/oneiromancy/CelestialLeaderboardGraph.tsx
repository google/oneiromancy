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

import React, { useState, useMemo } from 'react';
import GlassCard from '@/components/common/GlassCard';
import UserAvatar from '@/components/common/UserAvatar';
import { CompetitorTeam, CosmicPlayer } from '@/types/oneiromancy';
import { calculateTeamCelestialMetrics, classifySpiritScoreTier, hasUserSuffix, stripUserSuffix } from '@/lib/scoring';
import { Trophy, ChevronDown, ChevronUp } from 'lucide-react';

export type LeaderboardMetric = 'overall' | 'spirit' | 'draft' | 'harmony';

export interface CelestialLeaderboardGraphProps {
  competitorTeams: CompetitorTeam[];
  cosmicBoard?: CosmicPlayer[];
  userSlot?: number;
  selectedRosterId?: number;
  onSelectTeam?: (rosterId: number) => void;
  className?: string;
}

export const CelestialLeaderboardGraph: React.FC<CelestialLeaderboardGraphProps> = ({
  competitorTeams,
  cosmicBoard = [],
  userSlot,
  selectedRosterId,
  onSelectTeam,
  className = '',
}) => {
  const [metric, setMetric] = useState<LeaderboardMetric>('overall');
  const [showAllTeams, setShowAllTeams] = useState<boolean>(true);

  const rankedTeams = useMemo(() => {
    const teamsWithMetrics = competitorTeams.map((team, idx) => {
      const slotNum = team.slot || team.roster_id || idx + 1;
      const isUser = team.is_user === true || hasUserSuffix(team.name);
      const metrics = calculateTeamCelestialMetrics(team, cosmicBoard);

      let sortValue = metrics.compositeScore;
      let value = Number(metrics.compositeScore.toFixed(1));
      let displayValue = value.toFixed(1);
      let metricUnit = 'PTS';

      if (metric === 'spirit') {
        sortValue = metrics.spiritScore;
        value = Number(metrics.spiritScore.toFixed(1));
        displayValue = value.toFixed(1);
        metricUnit = 'SPIRIT';
      } else if (metric === 'draft') {
        sortValue = metrics.draftScore;
        value = Number(metrics.draftScore.toFixed(1));
        displayValue = value.toFixed(1);
        metricUnit = 'DRAFT';
      } else if (metric === 'harmony') {
        sortValue = metrics.harmonyScore;
        value = Math.round(metrics.harmonyScore);
        displayValue = `${value}%`;
        metricUnit = 'HARMONY';
      } else {
        sortValue = metrics.compositeScore;
        value = Number(metrics.compositeScore.toFixed(1));
        displayValue = value.toFixed(1);
        metricUnit = 'COMPOSITE';
      }

      const cleanName = stripUserSuffix(team.name, 'Team');

      return {
        team,
        slotNum,
        cleanName,
        isUser,
        metrics,
        sortValue,
        value,
        displayValue,
        metricUnit,
      };
    });

    return teamsWithMetrics.sort((a, b) => b.sortValue - a.sortValue);
  }, [competitorTeams, cosmicBoard, userSlot, metric]);

  const displayedTeams = showAllTeams ? rankedTeams : rankedTeams.slice(0, 5);

  const getRankBadge = (rank: number) => {
    if (rank === 1) {
      return (
        <span
          data-testid="leaderboard-row-rank-1"
          className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-400/80 text-amber-300 font-bold text-[11px] flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(251,191,36,0.5)]"
        >
          🥇
        </span>
      );
    }
    if (rank === 2) {
      return (
        <span className="w-5 h-5 rounded-full bg-slate-400/20 border border-slate-300/80 text-slate-200 font-bold text-[11px] flex items-center justify-center shrink-0">
          🥈
        </span>
      );
    }
    if (rank === 3) {
      return (
        <span className="w-5 h-5 rounded-full bg-amber-700/20 border border-amber-600/80 text-amber-400 font-bold text-[11px] flex items-center justify-center shrink-0">
          🥉
        </span>
      );
    }
    return (
      <span className="w-5 h-5 rounded-full bg-slate-900 border border-white/10 text-slate-400 font-mono text-[10px] flex items-center justify-center shrink-0">
        #{rank}
      </span>
    );
  };

  return (
    <GlassCard
      variant="panel"
      data-testid="celestial-leaderboard"
      className={`p-4 sm:p-6 space-y-4 border-amber-500/20 shadow-[0_0_20px_rgba(245,158,11,0.05)] ${className}`}
    >
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-white/10 pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-amber-950/60 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <Trophy className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-serif text-lg font-bold text-slate-100 flex items-center gap-2">
              <span>Celestial Leaderboard & Standings</span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-950/80 border border-amber-500/40 text-amber-300 font-normal">
                12-TEAM MATRIX
              </span>
            </h3>
            <p className="text-[11px] font-sans text-slate-400">
              Comparative rankings across Oracle, Stars, Stats, and Harmony metrics. Click any team to inspect their lineup.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 p-1 rounded-lg bg-slate-950/80 border border-white/10 text-xs font-mono self-stretch sm:self-auto justify-between sm:justify-start">
          <button
            type="button"
            data-testid="leaderboard-toggle-overall"
            onClick={() => setMetric('overall')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all font-bold ${
              metric === 'overall'
                ? 'bg-amber-500 text-slate-950 shadow-[0_0_8px_rgba(245,158,11,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Oracle
          </button>
          <button
            type="button"
            data-testid="leaderboard-toggle-spirit"
            onClick={() => setMetric('spirit')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all font-bold ${
              metric === 'spirit'
                ? 'bg-purple-500 text-slate-950 shadow-[0_0_8px_rgba(168,85,247,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Stars
          </button>
          <button
            type="button"
            data-testid="leaderboard-toggle-draft"
            onClick={() => setMetric('draft')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all font-bold ${
              metric === 'draft'
                ? 'bg-cyan-500 text-slate-950 shadow-[0_0_8px_rgba(6,182,212,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Stats
          </button>
          <button
            type="button"
            data-testid="leaderboard-toggle-harmony"
            onClick={() => setMetric('harmony')}
            className={`px-2.5 py-1 rounded text-[11px] transition-all font-bold ${
              metric === 'harmony'
                ? 'bg-emerald-500 text-slate-950 shadow-[0_0_8px_rgba(16,185,129,0.4)]'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Harmony
          </button>
        </div>
      </div>

      <div className="space-y-2">
        {displayedTeams.map((item, index) => {
          const rank = index + 1;
          const isRankOne = rank === 1;
          const barWidth = Math.min(100, Math.max(15, ((item.value - 50) / 50) * 100));
          const rowTier = classifySpiritScoreTier(item.value);

          return (
            <div
              key={item.slotNum}
              onClick={() => onSelectTeam?.(item.team.roster_id)}
              data-testid={
                item.isUser
                  ? 'leaderboard-user-team'
                  : isRankOne
                  ? 'leaderboard-row-rank-1'
                  : `leaderboard-row-slot-${item.slotNum}`
              }
              className={`p-2.5 rounded-xl border text-xs font-mono transition-all relative overflow-hidden ${
                onSelectTeam ? 'cursor-pointer' : ''
              } ${
                item.isUser
                  ? 'bg-purple-950/40 border-purple-400 ring-2 ring-purple-500/70 shadow-lg shadow-purple-500/20'
                  : selectedRosterId === item.team.roster_id
                  ? 'bg-cyan-950/30 border-cyan-400/60 ring-1 ring-cyan-400/40'
                  : isRankOne
                  ? 'bg-amber-950/20 border-amber-500/30'
                  : 'bg-slate-900/60 border-white/5 hover:border-white/10'
              }`}
            >
              <div className="flex items-center justify-between gap-2 relative z-10">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getRankBadge(rank)}
                  <UserAvatar
                    src={item.team.avatar_url || item.team.avatar}
                    alt={`${item.cleanName} avatar`}
                    fallbackText={item.cleanName}
                    size="sm"
                    isUser={item.isUser}
                    testId={`leaderboard-avatar-slot-${item.slotNum}`}
                    data-testid={`leaderboard-avatar-slot-${item.slotNum}`}
                  />
                  <div className="truncate flex items-center gap-1.5 min-w-0">
                    <span className="text-[10px] text-slate-500 font-mono shrink-0">
                      Slot {item.slotNum}
                    </span>
                    <span
                      className={`font-bold truncate ${
                        item.isUser
                          ? 'text-purple-200 font-extrabold drop-shadow-[0_0_6px_rgba(168,85,247,0.4)]'
                          : isRankOne
                          ? 'text-amber-200'
                          : 'text-slate-200'
                      }`}
                    >
                      {item.cleanName}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded-full border whitespace-nowrap hidden sm:inline ${
                      rowTier.tier === 'Favorable'
                        ? 'bg-emerald-950/60 border-emerald-500/30 text-emerald-300'
                        : rowTier.tier === 'Discordant'
                        ? 'bg-rose-950/60 border-rose-500/30 text-rose-300'
                        : 'bg-sky-950/60 border-sky-500/30 text-sky-300'
                    }`}
                  >
                    {rowTier.badgeLabel}
                  </span>

                  <span
                    className={`font-mono font-bold text-xs px-2 py-0.5 rounded ${
                      item.isUser
                        ? 'bg-purple-900/60 text-amber-300 border border-amber-400/40'
                        : isRankOne
                        ? 'bg-amber-950/60 text-amber-300 border border-amber-500/40'
                        : 'bg-slate-950/80 text-cyan-300 border border-white/5'
                    }`}
                  >
                    {item.displayValue}
                  </span>
                </div>
              </div>

              <div
                title="75.0 Equilibrium Baseline"
                className="w-full h-1.5 bg-slate-950/80 rounded-full overflow-hidden mt-2 border border-white/5"
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    item.isUser
                      ? 'bg-gradient-to-r from-purple-500 via-amber-400 to-purple-400 shadow-[0_0_8px_rgba(234,179,8,0.5)]'
                      : isRankOne
                      ? 'bg-gradient-to-r from-amber-500 to-emerald-400'
                      : metric === 'spirit'
                      ? 'bg-gradient-to-r from-purple-600 to-sky-400'
                      : metric === 'harmony'
                      ? 'bg-gradient-to-r from-emerald-500 to-cyan-400'
                      : 'bg-gradient-to-r from-cyan-600 to-sky-400'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="text-center pt-1 border-t border-white/5">
        <button
          type="button"
          onClick={() => setShowAllTeams((prev) => !prev)}
          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 transition-colors px-3 py-1 rounded bg-slate-900/60 border border-white/5"
        >
          <span>{showAllTeams ? 'Collapse to Top 5 Teams' : 'Show All 12 Teams'}</span>
          {showAllTeams ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
        </button>
      </div>
    </GlassCard>
  );
};

export default CelestialLeaderboardGraph;
