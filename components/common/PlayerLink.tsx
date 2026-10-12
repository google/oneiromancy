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
import type { CosmicPlayer } from '@/types/oneiromancy';

/** What a player link opens: the player, and who they're being compared with. */
export interface InspectTarget {
  player: CosmicPlayer;
  vs: CosmicPlayer | null;
}

/**
 * A player's name that opens their extended view. Pass `vs` when the name
 * sits in a recommendation ("start X over Y") so the view compares the two.
 */
export const PlayerLink: React.FC<{
  player: CosmicPlayer;
  vs?: CosmicPlayer | null;
  onOpen: (target: InspectTarget) => void;
  className?: string;
}> = ({ player, vs = null, onOpen, className = '' }) => (
  <button
    type="button"
    onClick={() => onOpen({ player, vs })}
    aria-label={vs ? `Compare ${player.name} with ${vs.name}` : `View ${player.name} details`}
    className={`inline text-left underline decoration-dotted decoration-slate-500 underline-offset-2 hover:text-cyan-300 hover:decoration-cyan-400 ${className}`}
  >
    {player.name}
  </button>
);

export default PlayerLink;
