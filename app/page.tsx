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
import { OneiromancyProvider, useOneiromancy } from '@/context/OneiromancyContext';
import NavigationShell from '@/components/common/NavigationShell';
import OneiromancyDashboard from '@/components/screens/OneiromancyDashboard';
import CosmicBoard from '@/components/screens/CosmicBoard';
import ChaosDial from '@/components/screens/ChaosDial';
import PlayerMarketplace from '@/components/screens/PlayerMarketplace';
import MatchupsScreen from '@/components/screens/MatchupsScreen';
import SettingsDrawer from '@/components/settings/SettingsDrawer';

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
      sleeperUsername={draftState.settings?.sleeper_username || 'OneiroVanguard'}
      leagueId={draftState.settings?.league_id || '9000000000000000001'}
      draftId={draftState.draft_id}
      userAvatarUrl={draftState.user_avatar_url || draftState.avatar_url}
    >
      {/* Screen Router with responsive transition container */}
      <div className="w-full relative transition-all duration-200">
        {activeTab === 'oneiromancy' && <OneiromancyDashboard />}
        {(activeTab === 'matchups' || activeTab === 'matchup') && <MatchupsScreen />}
        {activeTab === 'board' && <CosmicBoard />}
        {(activeTab === 'market' || activeTab === 'marketplace') && <PlayerMarketplace />}
        {(activeTab === 'dial' || activeTab === 'chaos') && <ChaosDial />}
      </div>

      {/* Global Slide-up Settings Modal / Drawer */}
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
