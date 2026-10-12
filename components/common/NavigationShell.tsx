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
import UserAvatar from '@/components/common/UserAvatar';
import { Sparkles, Scale, Settings, ArrowRightLeft, Trophy, Compass } from 'lucide-react';

export type OneiromancyTab =
  | 'oneiromancy'
  | 'matchups'
  | 'board'
  | 'dial'
  | 'marketplace'
  | 'chaos'
  | 'market'
  | 'matchup'
  | 'trades'
  | 'league';

export interface NavigationShellProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  children?: React.ReactNode;
  statusText?: string;
  statusType?: 'live' | 'syncing' | 'offline';
  onOpenSettings?: () => void;
  mode?: 'live' | 'mock';
  onModeChange?: (mode: 'live' | 'mock') => void;
  syncError?: string | null;
  syncWarning?: string | null;
  onRetrySync?: () => void;
  sleeperUsername?: string;
  leagueId?: string;
  draftId?: string;
  userAvatarUrl?: string | null;
  /** Current chaos λ, shown on the Oracle chip. */
  oracleLambda?: number;
  onOpenOracle?: () => void;
}

interface TabItem {
  id: OneiromancyTab;
  label: string;
  /** Short label for the phone tab bar. */
  short: string;
  icon: React.ComponentType<{ className?: string }>;
}

/** The manager's four weekly calls: positioning, acquiring (x2), context. */
const TABS: TabItem[] = [
  { id: 'oneiromancy', label: 'This Week', short: 'Week', icon: Sparkles },
  { id: 'market', label: 'Waivers', short: 'Waivers', icon: Scale },
  { id: 'trades', label: 'Trades', short: 'Trades', icon: ArrowRightLeft },
  { id: 'league', label: 'League', short: 'League', icon: Trophy },
];

const TAB_ALIASES: Record<string, OneiromancyTab> = {
  oneiromancy: 'oneiromancy',
  matchups: 'oneiromancy',
  matchup: 'oneiromancy',
  dial: 'oneiromancy',
  chaos: 'oneiromancy',
  market: 'market',
  marketplace: 'market',
  board: 'market',
  trades: 'trades',
  league: 'league',
};

export function isTabActive(currentTab: string | undefined, tabId: OneiromancyTab): boolean {
  const resolved = TAB_ALIASES[currentTab || 'oneiromancy'] ?? 'oneiromancy';
  return resolved === (TAB_ALIASES[tabId] ?? tabId);
}

/** Plain-language description of where λ sits. */
export function oracleLeaning(lambda: number): string {
  if (lambda < 0.15) return 'stats only';
  if (lambda < 0.5) return 'mostly stats';
  if (lambda < 0.85) return 'mostly stars';
  return 'stars only';
}

export const NavigationShell: React.FC<NavigationShellProps> = ({
  activeTab = 'oneiromancy',
  onTabChange,
  children,
  statusText = 'LIVE',
  statusType = 'live',
  onOpenSettings,
  mode = 'live',
  onModeChange,
  syncError,
  syncWarning,
  onRetrySync,
  sleeperUsername = '',
  userAvatarUrl,
  oracleLambda,
  onOpenOracle,
}) => {
  const handleTabClick = (tabId: string) => {
    if (onTabChange) {
      onTabChange(tabId);
    }
  };

  const statusColor =
    statusType === 'live'
      ? 'bg-emerald-500'
      : statusType === 'syncing'
      ? 'bg-amber-500'
      : 'bg-slate-500';
  // The original's glow on the status dot (live = emerald).
  const statusGlow =
    statusType === 'live'
      ? 'shadow-[0_0_8px_rgba(16,185,129,0.8)]'
      : statusType === 'syncing'
      ? 'shadow-[0_0_8px_rgba(245,158,11,0.8)]'
      : '';

  return (
    <div className="min-h-screen flex flex-col bg-[#131318] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#131318]/90 backdrop-blur-md border-b border-white/10 px-4 py-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-purple-400 text-lg select-none" aria-hidden="true">
            ✦
          </span>
          <h1 className="font-serif font-bold text-sm sm:text-base tracking-wider bg-gradient-to-r from-slate-100 via-slate-200 to-cyan-300 bg-clip-text text-transparent mr-2">
            ONEIROMANCY
          </h1>
          {/* Desktop tabs; phones use the bottom bar instead */}
          <div className="hidden md:flex items-center gap-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = isTabActive(activeTab, tab.id);
              return (
                <button
                  key={`desktop-${tab.id}`}
                  type="button"
                  data-testid={`desktop-nav-tab-${tab.id}`}
                  onClick={() => handleTabClick(tab.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-cyan-950/90 text-cyan-200 border border-cyan-500/50 font-bold'
                      : 'text-slate-400 hover:text-slate-200 border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Oracle chip: how much the stars move every recommendation */}
          {onOpenOracle && (
            <button
              type="button"
              data-testid="oracle-chip"
              onClick={onOpenOracle}
              aria-label={`Oracle settings, lambda ${(oracleLambda ?? 0).toFixed(2)}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-purple-500/40 bg-purple-950/40 text-purple-200 text-[11px] font-mono hover:border-purple-400 transition-colors"
            >
              <Compass className="w-3.5 h-3.5" />
              <span>λ {(oracleLambda ?? 0).toFixed(2)}</span>
              <span className="hidden sm:inline text-purple-300/70">· {oracleLeaning(oracleLambda ?? 0)}</span>
            </button>
          )}

          {/* Single sync indicator */}
          <div
            data-testid="draft-status-indicator"
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[11px] font-mono"
          >
            <span className="relative flex h-2 w-2">
              {statusType === 'syncing' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              )}
              <span className={`relative inline-flex rounded-full h-2 w-2 ${statusColor} ${statusGlow}`} />
            </span>
            <span className="text-slate-300 tracking-tight hidden sm:inline">{statusText}</span>
            <span className="text-slate-300 tracking-tight sm:hidden">
              {statusType === 'live' ? 'LIVE' : statusType === 'syncing' ? 'SYNC' : mode === 'mock' ? 'MOCK' : 'OFFLINE'}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Draft Settings"
            className="p-1 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 transition-all border border-transparent hover:border-cyan-500/30"
          >
            {userAvatarUrl && mode === 'live' ? (
              <UserAvatar
                src={userAvatarUrl}
                alt={`${sleeperUsername || 'User'} avatar`}
                fallbackText={sleeperUsername || 'U'}
                size="xs"
                isUser={true}
                testId="nav-user-avatar"
                data-testid="nav-user-avatar"
              />
            ) : (
              <Settings className="w-5 h-5" />
            )}
          </button>
        </div>
      </header>

      {/* Sync problem notice */}
      {syncError && (
        <div
          data-testid="sleeper-sync-error-banner"
          className="bg-amber-950/95 border-b border-amber-500/50 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-200"
        >
          <div className="space-y-0.5 min-w-0">
            <div className="font-bold text-amber-300">Couldn&apos;t reach Sleeper</div>
            <div className="text-amber-200/90 font-mono text-[11px] break-all">{syncError}</div>
            {syncWarning && <div className="text-amber-300/80 text-[10px]">{syncWarning}</div>}
          </div>
          <button
            type="button"
            data-testid="retry-sync-btn"
            onClick={onRetrySync}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-500/40 text-xs font-mono font-semibold shrink-0"
          >
            Retry sync
          </button>
        </div>
      )}

      {/* Mock mode is always labelled, with a way back */}
      {mode === 'mock' && (
        <div
          data-testid="sleeper-mock-banner"
          className="bg-purple-950/40 border-b border-purple-500/20 px-4 py-1.5 flex items-center justify-between gap-2 text-[11px] font-mono text-purple-300/90"
        >
          <span>🔮 Mock league · sample data, not your Sleeper account</span>
          {sleeperUsername ? (
            <button
              type="button"
              onClick={() => onModeChange?.('live')}
              className="text-[11px] text-cyan-400 hover:underline shrink-0"
            >
              Back to {sleeperUsername} →
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSettings}
              className="text-[11px] text-cyan-400 hover:underline shrink-0"
            >
              Connect your Sleeper account →
            </button>
          )}
        </div>
      )}

      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 pt-4 pb-24 md:pb-10">
        {children}
      </main>

      {/* Phone tab bar */}
      <nav
        role="navigation"
        aria-label="Bottom Draft Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#161622]/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-md mx-auto h-full grid grid-cols-4 items-center">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = isTabActive(activeTab, tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                data-testid={`nav-tab-${tab.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center h-full w-full gap-0.5 transition-colors ${
                  isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {isActive && (
                  <span aria-hidden="true" className="absolute top-0 h-0.5 w-8 bg-cyan-400 rounded-full shadow-[0_0_8px_#06b6d4] transition-all" />
                )}
                <Icon className="w-5 h-5" />
                <span className="text-[10px] font-mono tracking-tight font-medium">{tab.short}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default NavigationShell;
