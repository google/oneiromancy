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

import React, { useEffect, useState } from 'react';
import { OneiromancyProvider, useOneiromancy } from '@/context/OneiromancyContext';
import NavigationShell from '@/components/common/NavigationShell';
import OneiromancyDashboard from '@/components/screens/OneiromancyDashboard';
import CosmicBoard from '@/components/screens/CosmicBoard';
import MatchupsScreen from '@/components/screens/MatchupsScreen';
import LeagueScreen from '@/components/screens/LeagueScreen';
import SettingsDrawer from '@/components/settings/SettingsDrawer';
import OraclePanel from '@/components/oracle/OraclePanel';
import { DEFAULT_CHAOS_LAMBDA } from '@/lib/scoring';

function OneiromancyApp() {
  const {
    activeTab,
    setTab,
    statusType,
    statusText,
    isSettingsOpen,
    toggleSettings,
    mode,
    setMode,
    syncError,
    syncWarning,
    refreshDraft,
    draftState,
  } = useOneiromancy();

  const [isOracleOpen, setIsOracleOpen] = useState(false);

  // Legacy deep links to the old Scoring Model tab open the Oracle panel.
  useEffect(() => {
    if (activeTab === 'chaos' || activeTab === 'dial') {
      setIsOracleOpen(true);
      setTab('oneiromancy');
    }
  }, [activeTab, setTab]);

  // Screens open the Oracle panel in place via this event rather than switching tabs.
  useEffect(() => {
    const open = () => setIsOracleOpen(true);
    window.addEventListener('oneiromancy:open-oracle', open);
    if (typeof window !== 'undefined' && window.location?.search) {
      const tabParam = new URLSearchParams(window.location.search).get('tab')?.trim();
      if (tabParam === 'weights' || tabParam === 'oracle' || tabParam === 'chaos' || tabParam === 'dial') {
        setIsOracleOpen(true);
      }
    }
    return () => window.removeEventListener('oneiromancy:open-oracle', open);
  }, []);

  // In mock mode the live state holds the demo persona, not the owner's
  // account; read the real username from storage so the banner can offer a
  // one-click return.
  const [savedUsername, setSavedUsername] = useState<string | null>(null);
  useEffect(() => {
    try {
      setSavedUsername(localStorage.getItem('oneiromancy_active_username'));
    } catch {
      setSavedUsername(null);
    }
  }, [mode, draftState.settings?.sleeper_username]);

  return (
    <NavigationShell
      activeTab={activeTab}
      onTabChange={(tabId) => setTab(tabId as any)}
      statusText={statusText}
      statusType={statusType}
      onOpenSettings={() => toggleSettings(true)}
      mode={mode}
      onModeChange={setMode}
      syncError={syncError}
      syncWarning={syncWarning}
      onRetrySync={refreshDraft}
      sleeperUsername={
        mode === 'mock' ? savedUsername || '' : draftState.settings?.sleeper_username || ''
      }
      leagueId={draftState.settings?.league_id || '9000000000000000001'}
      draftId={draftState.draft_id}
      userAvatarUrl={draftState.user_avatar_url || draftState.avatar_url}
      oracleLambda={draftState.settings?.chaos_lambda ?? DEFAULT_CHAOS_LAMBDA}
      onOpenOracle={() => setIsOracleOpen(true)}
    >
      {/* 4 Consolidated Top-Level Sections: Roster, Matchup, Players, League */}
      <div className="w-full relative transition-all duration-200">
        {activeTab === 'oneiromancy' && <OneiromancyDashboard />}
        {(activeTab === 'matchups' || activeTab === 'matchup') && <MatchupsScreen />}
        {(activeTab === 'board' || activeTab === 'market' || activeTab === 'marketplace' || activeTab === 'trades') && (
          <CosmicBoard
            initialFilter={
              activeTab === 'market' || activeTab === 'marketplace'
                ? 'waivers'
                : activeTab === 'trades'
                  ? 'trades'
                  : 'all'
            }
          />
        )}
        {activeTab === 'league' && <LeagueScreen />}
      </div>

      <OraclePanel isOpen={isOracleOpen} onClose={() => setIsOracleOpen(false)} />

      <SettingsDrawer
        isOpen={isSettingsOpen}
        onClose={() => toggleSettings(false)}
      />
    </NavigationShell>
  );
}

export default function Home() {
  return (
    <OneiromancyProvider>
      <OneiromancyApp />
    </OneiromancyProvider>
  );
}
