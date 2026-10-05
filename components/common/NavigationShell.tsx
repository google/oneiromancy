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
import { Sparkles, LayoutGrid, Compass, Scale, Settings, Swords } from 'lucide-react';

export type OneiromancyTab =
  | 'oneiromancy'
  | 'matchups'
  | 'board'
  | 'dial'
  | 'marketplace'
  | 'chaos'
  | 'market'
  | 'matchup';

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
}

interface TabItem {
  id: OneiromancyTab;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
}

const TABS: TabItem[] = [
  { id: 'oneiromancy', label: 'Oneiromancy', sublabel: 'Ascension', icon: Sparkles },
  { id: 'matchups', label: 'Matchups', sublabel: 'Head-to-Head', icon: Swords },
  { id: 'board', label: 'Player Board', sublabel: 'Data Grid', icon: LayoutGrid },
  { id: 'marketplace', label: 'Marketplace', sublabel: 'Free Agents', icon: Scale },
  { id: 'dial', label: 'Scoring Model', sublabel: 'Chaos λ', icon: Compass },
];

export function isTabActive(currentTab: string | undefined, tabId: OneiromancyTab): boolean {
  if (!currentTab) return tabId === 'oneiromancy';
  if (currentTab === tabId) return true;
  if ((tabId === 'dial' || tabId === 'chaos') && (currentTab === 'dial' || currentTab === 'chaos')) return true;
  if ((tabId === 'marketplace' || tabId === 'market') && (currentTab === 'marketplace' || currentTab === 'market')) return true;
  if ((tabId === 'matchups' || tabId === 'matchup') && (currentTab === 'matchups' || currentTab === 'matchup')) return true;
  return false;
}

export const NavigationShell: React.FC<NavigationShellProps> = ({
  activeTab = 'oneiromancy',
  onTabChange,
  children,
  statusText = 'LIVE • RD 3 PK 4',
  statusType = 'live',
  onOpenSettings,
  mode = 'live',
  onModeChange,
  syncError,
  syncWarning,
  onRetrySync,
  sleeperUsername = 'OneiroVanguard',
  leagueId = '9000000000000000001',
  draftId,
  userAvatarUrl,
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

  const statusGlow =
    statusType === 'live'
      ? 'shadow-[0_0_8px_rgba(16,185,129,0.8)]'
      : statusType === 'syncing'
      ? 'shadow-[0_0_8px_rgba(234,179,8,0.8)]'
      : '';

  return (
    <div className="min-h-screen flex flex-col bg-[#131318] text-slate-100 selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Sticky Header */}
      <header className="sticky top-0 z-30 bg-[#131318]/90 backdrop-blur-md border-b border-white/10 px-4 py-2 flex flex-wrap items-center justify-between gap-2 transition-colors">
        {/* Brand Title & Screen Tabs */}
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-lg select-none" aria-hidden="true">
            ✦
          </span>
          <h1 className="font-serif font-bold text-sm sm:text-base tracking-wider bg-gradient-to-r from-slate-100 via-slate-200 to-cyan-300 bg-clip-text text-transparent mr-2">
            ONEIROMANCY
          </h1>
          {/* Desktop Navigation Tabs */}
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
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500/50 shadow-[0_0_12px_rgba(6,182,212,0.3)] font-bold'
                      : 'bg-slate-900/80 text-slate-400 hover:text-slate-200 border border-white/10'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 1-Click Mode Switch: Live League vs Mock Oneiromancy Engine */}
        <div
          data-testid="mode-switch-container"
          className="flex items-center rounded-lg p-0.5 bg-slate-900/90 border border-white/10 text-xs font-mono order-3 sm:order-2"
        >
          <button
            type="button"
            data-testid="mode-live-btn"
            onClick={() => onModeChange?.('live')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'live'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.3)] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {userAvatarUrl ? (
              <span data-testid="active-user-nav-avatar" className="inline-flex items-center shrink-0">
                <UserAvatar
                  src={userAvatarUrl}
                  alt={`${sleeperUsername || 'User'} avatar`}
                  fallbackText={sleeperUsername || 'U'}
                  size="xs"
                  isUser={true}
                  testId="nav-user-avatar"
                  data-testid="nav-user-avatar"
                />
              </span>
            ) : (
              <span
                className={`w-2 h-2 rounded-full ${
                  mode === 'live' ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
                }`}
              />
            )}
            <span>Live ({sleeperUsername || 'OneiroVanguard'})</span>
          </button>
          <button
            type="button"
            data-testid="mode-mock-btn"
            onClick={() => onModeChange?.('mock')}
            className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
              mode === 'mock'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-[0_0_8px_rgba(168,85,247,0.3)] font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🔮 Mock</span>
          </button>
        </div>

        {/* Right side status & settings */}
        <div className="flex items-center gap-2 order-2 sm:order-3">
          {/* Live Draft Pulse Status */}
          <div
            data-testid="draft-status-indicator"
            className="flex items-center gap-2 px-2.5 py-1 rounded-full bg-slate-900/80 border border-white/10 text-[11px] font-mono"
          >
            <span className="relative flex h-2 w-2">
              {statusType === 'live' && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              )}
              <span
                className={`relative inline-flex rounded-full h-2 w-2 ${statusColor} ${statusGlow}`}
              />
            </span>
            <span className="text-slate-300 tracking-tight hidden xs:inline">{statusText}</span>
            <span className="text-slate-300 tracking-tight xs:hidden">
              {statusType === 'live' ? 'LIVE' : statusType === 'syncing' ? 'SYNC' : mode === 'mock' ? 'MOCK' : 'OFFLINE'}
            </span>
          </div>

          {/* Settings Action Button */}
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Draft Settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-cyan-400 hover:bg-slate-800/80 active:scale-95 transition-all border border-transparent hover:border-cyan-500/30"
          >
            <Settings className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Visible Error / Warning Notice Banner */}
      {syncError && (
        <div
          data-testid="sleeper-sync-error-banner"
          className="bg-amber-950/95 border-b border-amber-500/50 px-4 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 text-xs text-amber-200 animate-fadeIn"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-amber-400 text-base leading-none select-none">⚠️</span>
            <div className="space-y-0.5">
              <div className="font-bold text-amber-300">Sleeper API Live Sync Notice:</div>
              <div className="text-amber-200/90 font-mono text-[11px] break-all">{syncError}</div>
              {syncWarning && <div className="text-amber-300/80 text-[10px]">{syncWarning}</div>}
            </div>
          </div>
          <button
            type="button"
            data-testid="retry-sync-btn"
            onClick={onRetrySync}
            className="px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-200 border border-amber-500/40 text-xs font-mono font-semibold transition-all flex items-center gap-1.5 shrink-0 self-end sm:self-auto"
          >
            <span>🔄 Retry Live Sync</span>
          </button>
        </div>
      )}

      {/* Live State Sub-Banner when in live mode and synced without error */}
      {mode === 'live' && !syncError && (
        <div
          data-testid="sleeper-live-sync-banner"
          className="bg-emerald-950/40 border-b border-emerald-500/20 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-emerald-300/90"
        >
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>
              LIVE SYNC: {sleeperUsername || 'OneiroVanguard'} • League {leagueId || '9000000000000000001'}
            </span>
          </div>
          {draftId &&
            draftId !== 'mock_oneiromancy_draft_2025' &&
            draftId !== '9000000000000000002' && (
              <div className="text-slate-400 text-[10px] hidden sm:block">Draft ID: {draftId}</div>
            )}
        </div>
      )}

      {/* Mock Engine Sub-Banner when in mock mode */}
      {mode === 'mock' && (
        <div
          data-testid="sleeper-mock-banner"
          className="bg-purple-950/40 border-b border-purple-500/20 px-4 py-1.5 flex items-center justify-between text-[11px] font-mono text-purple-300/90"
        >
          <div className="flex items-center gap-2">
            <span>🔮 MOCK ONEIROMANCY ENGINE</span>
            <span className="text-purple-400/70 text-[10px]">• Offline Synthetic Data</span>
          </div>
          <button
            type="button"
            onClick={() => onModeChange?.('live')}
            className="text-[10px] text-cyan-400 hover:underline"
          >
            Switch to Live League →
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 w-full max-w-5xl mx-auto px-3 sm:px-6 pt-4 pb-24">
        {children}
      </main>

      {/* Fixed Bottom Mobile Tab Bar (<480px optimized) */}
      <nav
        role="navigation"
        aria-label="Bottom Draft Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 h-16 bg-[#161622]/95 backdrop-blur-xl border-t border-white/10 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="max-w-md mx-auto h-full grid grid-cols-5 items-center">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = isTabActive(activeTab, tab.id);

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabClick(tab.id)}
                data-testid={tab.id === 'matchups' ? 'nav-tab-matchups' : `nav-tab-${tab.id}`}
                aria-current={isActive ? 'page' : undefined}
                className={`relative flex flex-col items-center justify-center h-full w-full gap-0.5 transition-colors group ${
                  isActive ? 'text-cyan-400' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {/* Active Indicator Bar */}
                {isActive && (
                  <span
                    aria-hidden="true"
                    className="absolute top-0 h-0.5 w-8 bg-cyan-400 rounded-full shadow-[0_0_8px_#06b6d4] transition-all"
                  />
                )}

                <Icon
                  className={`w-5 h-5 transition-transform group-hover:scale-110 ${
                    isActive ? 'text-cyan-400 filter drop-shadow-[0_0_6px_rgba(6,182,212,0.6)]' : ''
                  }`}
                />
                <span className="text-[10px] font-mono tracking-tight font-medium">
                  {tab.label.split(' ')[0]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default NavigationShell;
