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

import React, { useEffect, useState } from 'react';
import { useOneiromancy } from '@/context/OneiromancyContext';
import UserAvatar from '@/components/common/UserAvatar';
import { resetRateLimit } from '@/lib/sleeper';
import { X, Settings, RefreshCw, Globe, Sparkles, ExternalLink } from 'lucide-react';

export interface SettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
}

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  isOpen,
  onClose,
  className = '',
}) => {
  const {
    draftState,
    isAutoUpdate,
    isLoading,
    toggleAutoUpdate,
    setPollInterval,
    setSleeperUsername,
    setLeagueId,
    updateChaosLambda,
    refreshDraft,
    loadMockData,
    setMode,
    syncError,
  } = useOneiromancy();

  const [isFirstLaunch, setIsFirstLaunch] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    try {
      const saved = localStorage.getItem('oneiromancy_active_username');
      return !saved || !saved.trim();
    } catch {
      return false;
    }
  });
  const hasConfiguredUsername =
    !isFirstLaunch && Boolean(draftState?.settings?.sleeper_username?.trim());
  const currentUsername = draftState?.settings?.sleeper_username || 'OneiroVanguard';
  const availableLeagues = hasConfiguredUsername
    ? draftState?.available_leagues || draftState?.settings?.available_leagues || []
    : [];
  const currentLeagueId = hasConfiguredUsername
    ? draftState?.settings?.league_id ||
      (availableLeagues.length > 0 ? availableLeagues[0].league_id : '')
    : '';
  const currentInterval = draftState?.settings?.poll_interval_ms ?? 5000;

  const [inputUsername, setInputUsername] = useState<string>(() =>
    isFirstLaunch ? '' : currentUsername
  );
  const [isFetchingLeagues, setIsFetchingLeagues] = useState<boolean>(false);
  const [manualLeagueId, setManualLeagueId] = useState<string>('');
  const [isEditing, setIsEditing] = useState<boolean>(false);

  // Detect very first browser launch when no Sleeper username is stored yet
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('oneiromancy_active_username');
      if (!saved || !saved.trim()) {
        setIsFirstLaunch(true);
        setInputUsername('');
      } else {
        setIsFirstLaunch(false);
        setInputUsername(saved.trim());
      }
    } catch {
      // Ignore localStorage access failures
    }
  }, []);

  // Sync internal state when draftState updates
  // Only update from draftState if the user is not actively editing and there is no active sync error
  useEffect(() => {
    if (isEditing || isFirstLaunch) return;
    if (syncError || draftState?.sync_error) return;
    if (draftState?.settings?.sleeper_username) {
      setInputUsername(draftState.settings.sleeper_username);
    }
  }, [draftState?.settings?.sleeper_username, syncError, draftState?.sync_error, isEditing, isFirstLaunch]);

  // Validation telemetry check
  const validatedUsername = inputUsername.trim();

  // Save handler triggered by Apply & Sync button
  const handleSave = async () => {
    const trimmedUsername = inputUsername.trim();
    if (!trimmedUsername) return;
    const wasFirstLaunch = isFirstLaunch;
    setInputUsername(trimmedUsername);
    setIsEditing(false);
    setIsFirstLaunch(false);
    setIsFetchingLeagues(true);
    resetRateLimit();
    if (setMode) {
      setMode('live');
    }
    if (setSleeperUsername) {
      setSleeperUsername(trimmedUsername);
    }
    try {
      if (refreshDraft) {
        await refreshDraft(trimmedUsername);
      }
      if (wasFirstLaunch && !draftState?.sync_error) {
        onClose();
      }
    } catch (saveErr) {
      console.warn('[SettingsDrawer] handleSave error:', saveErr);
    } finally {
      setIsFetchingLeagues(false);
    }
  };

  // Immediate league switch handler
  const handleLeagueChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newLeagueId = e.target.value;
    if (setLeagueId) {
      setLeagueId(newLeagueId);
    }
    if (refreshDraft) {
      await refreshDraft(undefined, newLeagueId);
    }
  };

  // Instant reset to canonical mock oneiromancy draft
  const handleLoadMockData = () => {
    const wasFirstLaunch = isFirstLaunch;
    if (loadMockData) {
      loadMockData();
    }
    setInputUsername('OneiroVanguard');
    setIsEditing(false);
    setIsFirstLaunch(false);
    if (wasFirstLaunch) {
      onClose();
    }
  };

  // Ensure telemetry polling interval is wired
  useEffect(() => {
    if (setPollInterval && currentInterval) {
      setPollInterval(currentInterval);
    }
  }, [setPollInterval, currentInterval]);

  // Keyboard Escape key dismissal listener
  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // Body scroll lock while modal is open
  useEffect(() => {
    if (!isOpen || typeof document === 'undefined') return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isOpen]);

  // Conditional render guard placed after all React hooks
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="settings-drawer-title"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl bg-[#161622] border border-cyan-500/30 p-5 sm:p-6 shadow-[0_0_30px_rgba(6,182,212,0.2)] space-y-5 ${className}`}
      >
        {/* Drawer Header */}
        <div className="flex justify-between items-center border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Settings className="w-4 h-4 text-cyan-400" />
            <h2
              id="settings-drawer-title"
              className="font-serif text-lg font-bold text-slate-100 tracking-wide"
            >
              Draft Telemetry Settings
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Settings"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* First-Launch Onboarding Prompt */}
        {isFirstLaunch && (
          <div
            id="first-launch-welcome-banner"
            data-testid="first-launch-welcome-banner"
            className="p-3.5 rounded-xl bg-gradient-to-r from-cyan-950/70 to-purple-950/70 border border-cyan-400/40 text-xs font-mono text-cyan-100 space-y-1 shadow-[0_0_20px_rgba(6,182,212,0.15)]"
          >
            <div className="font-bold text-cyan-300 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
              <span>Welcome to Oneiromancy</span>
            </div>
            <p className="text-[11px] text-slate-300 leading-relaxed font-sans">
              Enter your Sleeper username below to connect your fantasy league, or load the Mock Oneiromancy Engine to explore offline.
            </p>
          </div>
        )}

        {/* Active User Avatar & Identity Badge */}
        {hasConfiguredUsername && (draftState?.user_avatar_url || draftState?.avatar_url || draftState?.avatar) && (
          <div
            data-testid="settings-user-profile"
            className="flex items-center gap-3 p-3 rounded-xl bg-purple-950/30 border border-purple-500/30 font-mono text-xs"
          >
            <UserAvatar
              src={draftState.user_avatar_url || draftState.avatar_url}
              alt={`${currentUsername} avatar`}
              fallbackText={currentUsername}
              size="md"
              isUser={true}
              testId="settings-user-avatar"
              data-testid="settings-user-avatar"
            />
            <div>
              <span className="text-[10px] text-purple-300 font-bold block uppercase tracking-wider">
                Active Manager Profile
              </span>
              <span className="text-slate-100 font-bold text-sm">
                @{currentUsername}
              </span>
            </div>
          </div>
        )}

        {/* Sleeper Username Input */}
        <div className="space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <label htmlFor="username-input" className="text-slate-300 font-semibold block">
              Sleeper Username
            </label>
            <a
              href="https://docs.sleeper.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1 transition-colors"
              title="Sleeper public API is read-only, requires no auth token, and operates with rate limit guidance of <1,000 req/min"
            >
              <span>API Specs: docs.sleeper.com</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
          <div className="flex items-center gap-2">
            <input
              id="username-input"
              type="text"
              autoFocus={isFirstLaunch}
              value={inputUsername}
              onChange={(e) => {
                setInputUsername(e.target.value);
                setIsEditing(true);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave();
              }}
              placeholder="e.g. OneiroVanguard"
              className="flex-1 p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 transition-colors"
              aria-label="Sleeper Username"
            />
          </div>
          <span className="text-[10px] text-slate-400 block">
            Your Sleeper username. Leagues, drafts, and rosters are dynamically queried via Sleeper&apos;s unauthenticated read-only API (<a href="https://docs.sleeper.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">docs.sleeper.com</a>, rate limit &lt;1,000 req/min).
          </span>
          {/* Prominent Sync Error Banner */}
          {(syncError || draftState?.sync_error) && (
            <div
              id="sync-error-banner"
              className="p-3 rounded-xl bg-red-950/80 border border-red-500/50 text-red-200 text-xs font-mono flex items-start gap-2 shadow-[0_0_15px_rgba(239,68,68,0.25)] animate-fadeIn"
            >
              <span className="text-red-400 text-sm leading-none shrink-0 mt-0.5">⚠️</span>
              <div className="space-y-0.5 flex-1">
                <div className="font-bold text-red-300">Sync Warning / Error</div>
                <div className="text-[11px] text-red-200/90 break-words leading-relaxed">
                  {syncError || draftState?.sync_error}
                </div>
              </div>
            </div>
          )}
          {/* Real-time Dynamic Status Badge */}
          {(isFetchingLeagues || isLoading || syncError || (hasConfiguredUsername && availableLeagues.length > 0)) && (
            <div
              id="username-status-badge"
              className={`p-2 rounded-lg text-[11px] font-mono flex items-center gap-1.5 transition-all ${
                isFetchingLeagues || isLoading
                  ? 'bg-cyan-950/60 border border-cyan-500/30 text-cyan-300'
                  : syncError
                  ? 'bg-red-950/60 border border-red-500/30 text-red-300'
                  : 'bg-emerald-950/60 border border-emerald-500/30 text-emerald-300'
              }`}
            >
              {isFetchingLeagues || isLoading ? (
                <>
                  <RefreshCw className="w-3 h-3 animate-spin text-cyan-400 shrink-0" />
                  <span>Querying Sleeper for @{validatedUsername || currentUsername}...</span>
                </>
              ) : syncError ? (
                <>
                  <span className="shrink-0">⚠️</span>
                  <span className="break-all">{syncError}</span>
                </>
              ) : (
                <>
                  <span className="shrink-0 text-emerald-400">✓</span>
                  <span>
                    Found {availableLeagues.length} league{availableLeagues.length === 1 ? '' : 's'} on Sleeper
                  </span>
                </>
              )}
            </div>
          )}
        </div>

        {/* Dynamic League Selector */}
        <div className="space-y-1.5 font-mono text-xs">
          <div className="flex items-center justify-between">
            <label htmlFor="league-select" className="text-slate-300 font-semibold block">
              League Selector
            </label>
            {isLoading && (
              <div className="flex items-center gap-1 text-[10px] text-cyan-400">
                <RefreshCw className="w-3 h-3 animate-spin" />
                <span>Loading leagues...</span>
              </div>
            )}
          </div>
          <select
            id="league-select"
            aria-label="League Selector"
            value={currentLeagueId}
            onChange={handleLeagueChange}
            disabled={isLoading || !hasConfiguredUsername}
            className="w-full p-2.5 rounded-xl bg-slate-900/90 border border-cyan-500/30 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-400 transition-colors disabled:opacity-50"
          >
            {!hasConfiguredUsername ? (
              <option value="" disabled className="bg-slate-900 text-slate-400">
                Enter a Sleeper username above to load leagues
              </option>
            ) : availableLeagues.length === 0 ? (
              <option value="" disabled className="bg-slate-900 text-slate-400">
                No leagues found
              </option>
            ) : (
              availableLeagues.map((league) => (
                <option
                  key={league.league_id}
                  value={league.league_id}
                  className="bg-slate-900 text-slate-100"
                >
                  {league.name} - {league.season}
                </option>
              ))
            )}
          </select>
          <span className="text-[10px] text-slate-500 block">
            Dynamically queried from Sleeper API. Defaults to your first league.
          </span>
          {/* Fallback Manual League ID Input when availableLeagues is empty */}
          {hasConfiguredUsername && availableLeagues.length === 0 && (
            <div className="mt-2 p-2.5 rounded-xl bg-slate-900/60 border border-amber-500/30 space-y-2">
              <div className="text-[11px] text-amber-300 font-semibold flex items-center gap-1.5">
                <span>⚠️ No leagues detected for @{validatedUsername || currentUsername}</span>
              </div>
              <p className="text-[10px] text-slate-400">
                If your league is in an unlisted season or private, specify your Sleeper League ID directly:
              </p>
              <div className="flex gap-2">
                <input
                  id="manual-league-id-input"
                  type="text"
                  value={manualLeagueId}
                  onChange={(e) => setManualLeagueId(e.target.value)}
                  placeholder="e.g. 9000000000000000001"
                  className="flex-1 p-2 rounded-lg bg-slate-950 border border-slate-700 text-slate-200 text-xs font-mono focus:outline-none focus:border-cyan-400"
                  aria-label="Manual Sleeper League ID"
                />
                <button
                  type="button"
                  id="manual-league-apply-btn"
                  onClick={async () => {
                    const trimmed = manualLeagueId.trim();
                    if (trimmed && setLeagueId && refreshDraft) {
                      setLeagueId(trimmed);
                      if (setMode) setMode('live');
                      await refreshDraft(validatedUsername || undefined, trimmed);
                    }
                  }}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-mono font-bold transition-all shrink-0"
                >
                  Set League
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Chaos Lambda Slider */}
        <div className="space-y-1.5 font-mono text-xs">
          <div className="flex justify-between items-center">
            <label htmlFor="chaos-lambda-slider" className="text-slate-300 font-semibold block">
              Sacred Chaos Factor (λ)
            </label>
            <span className="text-purple-300 font-bold">
              {(draftState?.settings?.chaos_lambda ?? 0.65).toFixed(2)}
            </span>
          </div>
          <input
            id="chaos-lambda-slider"
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={draftState?.settings?.chaos_lambda ?? 0.65}
            onChange={(e) => updateChaosLambda && updateChaosLambda(parseFloat(e.target.value))}
            aria-label="Chaos Factor (λ) Slider"
            className="w-full accent-purple-500 cursor-pointer"
          />
          <span className="text-[10px] text-slate-500 block">
            Balances pure mathematical VOR (0.0) with sacred tarot and elemental divination (1.0).
          </span>
        </div>

        {/* Action Buttons: Apply & Sync and Load Mock Data */}
        <div className="space-y-2">
          <button
            type="button"
            id="apply-sync-btn"
            onClick={handleSave}
            disabled={isLoading}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-mono text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Apply & Sync Draft"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Syncing...' : 'Apply & Sync'}</span>
          </button>

          <button
            type="button"
            id="load-mock-btn"
            onClick={handleLoadMockData}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-mono text-xs font-bold tracking-wide flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.3)] transition-all active:scale-98"
            aria-label="Load Mock Oneiromancy Engine"
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-200" />
            <span>🔮 Load Mock Oneiromancy Engine</span>
          </button>
        </div>

        {/* Auto-Update Polling Status Switch */}
        <div className="p-3.5 rounded-xl bg-slate-900/70 border border-white/10 flex items-center justify-between">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 font-mono text-xs font-semibold text-slate-200">
              <RefreshCw
                className={`w-3.5 h-3.5 text-cyan-400 ${isAutoUpdate ? 'animate-spin' : ''}`}
              />
              <span>Real-Time Auto-Update</span>
            </div>
            <p className="text-[10px] text-slate-400 font-sans">
              Automatically poll Sleeper API for opponent picks and board updates.
            </p>
          </div>

          <button
            type="button"
            role="switch"
            aria-label="Toggle Real-Time Auto-Update"
            aria-checked={isAutoUpdate}
            onClick={toggleAutoUpdate}
            className={`w-12 h-6 rounded-full p-0.5 transition-colors duration-200 ease-in-out ${
              isAutoUpdate ? 'bg-cyan-500' : 'bg-slate-700'
            }`}
          >
            <div
              className={`w-5 h-5 rounded-full bg-slate-950 shadow-md transform transition-transform duration-200 ease-in-out ${
                isAutoUpdate ? 'translate-x-6' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {/* Polling Interval Selector (Read-Only) */}
        <div className="space-y-2 font-mono text-xs">
          <span id="polling-interval-label" className="text-slate-300 font-semibold block">
            Polling Frequency Interval
          </span>
          <div
            role="radiogroup"
            aria-labelledby="polling-interval-label"
            aria-label="Polling Frequency Interval"
            className="grid grid-cols-2 gap-2"
          >
            {[
              { label: '5 Seconds (High Priority)', value: 5000, desc: 'High Priority' },
              { label: '10 Seconds (Standard)', value: 10000, desc: 'Standard' },
            ].map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={currentInterval === option.value}
                onClick={() => setPollInterval && setPollInterval(option.value)}
                className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                  currentInterval === option.value
                    ? 'bg-cyan-950/80 border-cyan-400 text-cyan-300 shadow-[0_0_8px_rgba(6,182,212,0.3)]'
                    : 'bg-slate-900/60 border-white/10 text-slate-400 hover:border-white/20'
                }`}
              >
                <div className="font-bold flex items-center justify-between">
                  <span>{option.value / 1000}s Interval</span>
                  {currentInterval === option.value && (
                    <span className="text-[9px] px-1 py-0.2 bg-cyan-900/60 border border-cyan-500/30 rounded text-cyan-300">
                      ACTIVE
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-500">{option.desc}</div>
              </button>
            ))}
          </div>
          <span className="text-[10px] text-slate-500 block">
            Auto-throttles to 30s when application is in a background tab to preserve battery and
            bandwidth.
          </span>
        </div>

        {/* Read-Only System Configuration Badges */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/10 font-mono text-[11px] text-slate-300 space-y-2">
          <div className="flex justify-between items-center text-xs font-bold text-slate-200 border-b border-white/5 pb-1.5">
            <span className="flex items-center gap-1.5 text-cyan-400">
              <Settings className="w-3.5 h-3.5" />
              <span>Engine Calibration (Read-Only)</span>
            </span>
            <span className="text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-500/30 px-1.5 py-0.2 rounded">
              LOCKED
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400">Data Ingestion Engine:</span>
            <span className="text-cyan-300 font-bold">Python Pipeline SQLite Daemon</span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400">Chaos Factor (λ):</span>
            <span className="text-purple-300 font-bold">
              {draftState?.settings?.chaos_lambda ?? 0.65} (Canonical Oneiromancy)
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400">Canonical Sleeper User:</span>
            <span className="text-amber-300 font-bold">
              {hasConfiguredUsername
                ? (draftState?.settings?.sleeper_username ?? 'OneiroVanguard')
                : 'Not configured'}
            </span>
          </div>
          <div data-testid="settings-user-profile" className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400">Active Roster / Team:</span>
            <span id="active-team-badge" className="text-emerald-300 font-bold flex items-center gap-1.5">
              {hasConfiguredUsername ? (
                <>
                  <UserAvatar
                    src={draftState?.user_avatar_url || draftState?.avatar_url || draftState?.settings?.user_avatar_url}
                    alt={draftState?.settings?.sleeper_username || 'User'}
                    fallbackText={draftState?.settings?.sleeper_username || 'User'}
                    size="sm"
                    isUser={true}
                    testId="settings-user-avatar"
                  />
                  <span>
                    {draftState?.competitor_teams?.find(
                      (t) =>
                        t.is_user ||
                        (draftState?.settings?.user_id && t.owner_id === draftState.settings.user_id) ||
                        (draftState?.settings?.user_slot && t.slot === draftState.settings.user_slot)
                    )?.name ||
                      (draftState?.settings?.sleeper_username &&
                      !['oneirovanguard', 'oneirovangard'].includes(
                        draftState.settings.sleeper_username.toLowerCase()
                      )
                        ? `${draftState.settings.sleeper_username} (You)`
                        : 'AstralOracles (You)')}
                  </span>
                </>
              ) : (
                <span className="text-slate-500">Awaiting username...</span>
              )}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400">Active League ID:</span>
            <span className="text-cyan-300 font-mono">
              {hasConfiguredUsername
                ? (draftState?.settings?.league_id ?? '9000000000000000001')
                : 'None'}
            </span>
          </div>
          <div className="flex justify-between items-center text-[10px]">
            <span className="text-slate-400">Oracle Weight Pillars:</span>
            <span className="text-slate-300 font-mono">30 / 25 / 20 / 15 / 10 %</span>
          </div>
        </div>

        {/* Cloud Run & Outbound Egress Info */}
        <div className="p-3 rounded-xl bg-slate-950/80 border border-white/5 font-mono text-[11px] text-slate-400 space-y-1">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
              <Globe className="w-3.5 h-3.5" />
              <span>Outbound Egress Status</span>
            </div>
            <a
              href="https://docs.sleeper.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] text-cyan-400 hover:text-cyan-300 underline flex items-center gap-1"
            >
              <span>docs.sleeper.com</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          </div>
          <div>Target API: https://api.sleeper.app/v1/</div>
          <div>Specs &amp; Rate Limits: &lt;1,000 req/min (<a href="https://docs.sleeper.com/" target="_blank" rel="noopener noreferrer" className="text-cyan-400 underline hover:text-cyan-300">Official Docs</a>)</div>
          <div>Environment: Standalone Cloud Run / App Engine Container</div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="pt-2 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-mono text-slate-200 border border-white/10 active:scale-98 transition-all"
          >
            Close Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsDrawer;
